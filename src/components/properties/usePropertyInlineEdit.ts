import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUpdateProperty } from '@/hooks/useProperties';
import { usePropertyStockConsumptionRules, useSavePropertyStockConsumptionRules, useStockProducts } from '@/hooks/useStock';
import type { Property } from '@/types/property';
import { propertySchema, type PropertyFormData } from './forms/PropertyFormSchema';
import { buildInitialStockConsumptions, deriveLegacyStockFields } from './forms/propertyStockConsumption';
import { propertyEditValues } from './propertyEditValues';

export function usePropertyInlineEdit(property: Property) {
  const products = useStockProducts();
  const rules = usePropertyStockConsumptionRules(property.id);
  const update = useUpdateProperty();
  const saveRules = useSavePropertyStockConsumptionRules();
  const form = useForm<PropertyFormData>({ resolver: zodResolver(propertySchema), defaultValues: propertyEditValues(property) });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [ready, setReady] = useState(false);
  const locked = useRef(false);
  const baseline = useRef(propertyEditValues(property));
  const latestSource = useRef({ property, products: products.data, rules: rules.data });
  latestSource.current = { property, products: products.data, rules: rules.data };
  const hydratedSource = useRef<typeof latestSource.current | null>(null);
  const dirty = form.formState.isDirty;
  const loadError = products.isError || rules.isError;

  useEffect(() => {
    if (dirty && (message === 'Cambios guardados.' || message === 'Cambios pendientes descartados.')) setMessage('');
  }, [dirty, message]);

  useEffect(() => {
    // Background refreshes must never replace an edited draft or a partial save.
    if (dirty || locked.current || !products.isSuccess || !rules.isSuccess) return;
    const previous = hydratedSource.current;
    if (previous?.property === property && previous.products === products.data && previous.rules === rules.data) return;
    hydratedSource.current = latestSource.current;
    baseline.current = {
      ...propertyEditValues(property),
      stockConsumptions: buildInitialStockConsumptions(products.data.filter(p => p.is_consumable), rules.data, property),
    };
    form.reset(baseline.current);
    setReady(true);
  }, [property, products.data, products.isSuccess, rules.data, rules.isSuccess, dirty, form]);

  useEffect(() => {
    if (!dirty && !saving) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, saving]);

  const save = form.handleSubmit(async data => {
    if (locked.current || !ready || loadError) return;
    locked.current = true;
    setSaving(true);
    setMessage('');
    let consumptionsSaved = false;
    try {
      const changedProducts = (products.data || []).filter(p => p.is_consumable && data.stockConsumptions[p.id] !== baseline.current.stockConsumptions[p.id]);
      const { stockConsumptions: _stock, ...fields } = data;
      const updates = Object.fromEntries(Object.entries(fields).filter(([key, value]) => value !== baseline.current[key as keyof PropertyFormData]));
      if (changedProducts.length) {
        // Send only changed products and preserve their existing notes/warehouse.
        await saveRules.mutateAsync({ propertyId: property.id, rules: changedProducts.map(p => ({
          product_id: p.id,
          quantity_per_cleaning: data.stockConsumptions[p.id],
          notes: rules.data?.find(rule => rule.product_id === p.id)?.notes ?? undefined,
        })) });
        consumptionsSaved = true;
        const legacy = deriveLegacyStockFields((products.data || []).filter(p => p.is_consumable), data.stockConsumptions);
        const changedLegacy = deriveLegacyStockFields(changedProducts, data.stockConsumptions);
        for (const key of Object.keys(changedLegacy)) updates[key] = legacy[key as keyof typeof legacy];
      }
      if (Object.keys(updates).length) await update.mutateAsync({ id: property.id, updates });
      baseline.current = data;
      // Do not reset back to an old query snapshot while invalidations refetch.
      hydratedSource.current = latestSource.current;
      form.reset(data);
      setMessage('Cambios guardados.');
    } catch {
      setMessage(consumptionsSaved
        ? 'Los consumos se han guardado, pero faltan los datos de la ficha. Pulsa Guardar cambios para reintentar.'
        : 'No se han podido guardar los cambios. El borrador se conserva para reintentar.');
    } finally {
      locked.current = false;
      setSaving(false);
    }
  }, () => setMessage('Revisa los campos marcados en Ficha, Consumos o Checklist antes de guardar.'));

  const discard = useCallback(() => {
    if (locked.current) return;
    // The latest server data also includes any successful part of a partial save.
    const values = { ...propertyEditValues(property), stockConsumptions: buildInitialStockConsumptions((products.data || []).filter(p => p.is_consumable), rules.data || [], property) };
    baseline.current = values;
    hydratedSource.current = latestSource.current;
    form.reset(values);
    setMessage('Cambios pendientes descartados.');
  }, [property, products.data, rules.data, form]);

  return { form, dirty, saving, ready, loadError, message, save, discard,
    retry: () => { void products.refetch(); void rules.refetch(); } };
}
