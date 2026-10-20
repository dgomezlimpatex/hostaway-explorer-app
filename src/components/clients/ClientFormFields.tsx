import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { UseFormReturn } from 'react-hook-form';
import { AlertTriangle, Contact, Lock, Receipt, Settings2, ToggleRight, UserRound } from 'lucide-react';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { entityDetailPath } from '@/components/navigation/entityLinks';
import type { Client } from '@/types/client';
import { CLIENT_SERVICE_LABELS } from './clientPresentation';
import { AmenitiesManagementField } from './forms/AmenitiesManagementField';
import { CLIENT_PAYMENT_LABELS, findPossibleDuplicates, isFiscalField, missingBillingData, supervisorSuggestions, type ClientFormValues } from './clientRules';

type TextFieldName = 'nombre' | 'cifNif' | 'telefono' | 'email' | 'codigoPostal' | 'ciudad' | 'supervisor';

interface ClientFormFieldsProps {
  form: UseFormReturn<ClientFormValues>;
  mode: 'create' | 'edit';
  /** Valores con los que se abrió el formulario (para avisos de inactivación y facturación). */
  initial: ClientFormValues;
  clients: readonly Client[];
  clientId?: string;
  canEditFiscal: boolean;
  /** Propiedades del cliente que heredan su estado (sin estado propio). */
  inheritingProperties?: number;
  ownStateProperties?: number;
  onOpenClient?: () => void;
}

/** Formulario único de alta y edición de clientes. */
export function ClientFormFields({ form, mode, initial, clients, clientId, canEditFiscal, inheritingProperties = 0, ownStateProperties = 0, onOpenClient }: ClientFormFieldsProps) {
  const suggestionsId = useId();
  const values = form.watch();
  // En edición solo se avisa si cambia el nombre o el CIF/NIF, para no repetir el aviso en cada cambio operativo.
  const identityChanged = mode === 'create' || values.nombre.trim() !== initial.nombre.trim() || values.cifNif.trim() !== initial.cifNif.trim();
  const duplicates = identityChanged ? findPossibleDuplicates({ nombre: values.nombre, cifNif: values.cifNif }, clients, clientId) : [];
  const missingBilling = missingBillingData(values);
  const enablingInvoice = values.factura && (mode === 'create' || !initial.factura);
  const deactivating = mode === 'edit' && initial.isActive && !values.isActive;
  const locked = (field: string) => !canEditFiscal && isFiscalField(field);

  const text = (name: TextFieldName, label: string, props: { type?: string; autoComplete?: string; inputMode?: 'tel' | 'email' | 'numeric' | 'text'; list?: string } = {}) => (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem className="min-w-0">
        <FormLabel>{label}{locked(name) && <Lock aria-label="Solo lectura" className="ml-1 inline h-3 w-3 text-slate-400" />}</FormLabel>
        <FormControl><Input {...field} {...props} disabled={locked(name)} className="rounded-xl" /></FormControl>
        <FormMessage />
      </FormItem>
    )} />
  );

  return (
    <div className="min-w-0 space-y-5">
      {!canEditFiscal && <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />El nombre y los datos fiscales (CIF/NIF, dirección de facturación, código postal, método de pago y factura) solo los modifica administración o gerencia.</p>}

      <Section icon={<UserRound className="h-4 w-4 text-[#310984]" />} title="Identificación">
        {text('nombre', 'Nombre', { autoComplete: 'organization' })}
        {text('cifNif', 'CIF/NIF')}
      </Section>

      {duplicates.length > 0 && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4 shrink-0" />Posible cliente duplicado en esta sede</p>
          <p className="mt-1 text-xs">Revisa si ya existe antes de guardar. Puedes continuar si son clientes distintos.</p>
          <ul className="mt-2 space-y-1">
            {duplicates.slice(0, 5).map(({ client, reasons }) => (
              <li key={client.id} className="flex flex-wrap items-center gap-x-2 text-xs">
                <span className="font-semibold">{client.nombre}</span>
                <span>· coincide {reasons.map(reason => reason === 'cif' ? 'el CIF/NIF' : 'el nombre').join(' y ')}{client.isActive === false ? ' · inactivo' : ''}</span>
                <Link to={entityDetailPath('client', client.id)} onClick={onOpenClient} className="font-bold text-[#310984] underline underline-offset-2">Ver ficha</Link>
              </li>
            ))}
          </ul>
          {duplicates.length > 5 && <p className="mt-1 text-xs">Y {duplicates.length - 5} más con los mismos datos.</p>}
        </div>
      )}

      <Section icon={<Contact className="h-4 w-4 text-[#310984]" />} title="Contacto">
        {text('telefono', 'Teléfono', { type: 'tel', inputMode: 'tel', autoComplete: 'tel' })}
        {text('email', 'Email', { type: 'email', inputMode: 'email', autoComplete: 'email' })}
      </Section>

      <Section icon={<Receipt className="h-4 w-4 text-[#310984]" />} title="Facturación">
        <FormField control={form.control} name="direccionFacturacion" render={({ field }) => (
          <FormItem className="min-w-0 sm:col-span-2">
            <FormLabel>Dirección de facturación{locked('direccionFacturacion') && <Lock aria-label="Solo lectura" className="ml-1 inline h-3 w-3 text-slate-400" />}</FormLabel>
            <FormControl><Textarea {...field} rows={2} disabled={locked('direccionFacturacion')} className="rounded-xl" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        {text('codigoPostal', 'Código postal', { inputMode: 'numeric', autoComplete: 'postal-code' })}
        {text('ciudad', 'Ciudad', { autoComplete: 'address-level2' })}
        <FormField control={form.control} name="metodoPago" render={({ field }) => (
          <FormItem className="min-w-0">
            <FormLabel>Método de pago{locked('metodoPago') && <Lock aria-label="Solo lectura" className="ml-1 inline h-3 w-3 text-slate-400" />}</FormLabel>
            <Select value={field.value || undefined} onValueChange={field.onChange} disabled={locked('metodoPago')}>
              <FormControl><SelectTrigger className="rounded-xl"><SelectValue placeholder="Sin indicar" /></SelectTrigger></FormControl>
              <SelectContent>{Object.entries(CLIENT_PAYMENT_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <CheckField form={form} name="factura" label="Emite factura" disabled={locked('factura')} />
        {missingBilling.length > 0 && !enablingInvoice && (
          <p role="status" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 sm:col-span-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Faltan datos de facturación: {missingBilling.join(', ')}. Puedes guardar otros cambios, pero complétalos antes de facturar.</span>
          </p>
        )}
      </Section>

      <Section icon={<Settings2 className="h-4 w-4 text-[#310984]" />} title="Servicio">
        <FormField control={form.control} name="tipoServicio" render={({ field }) => (
          <FormItem className="min-w-0">
            <FormLabel>Tipo de servicio</FormLabel>
            <Select value={field.value || undefined} onValueChange={field.onChange}>
              <FormControl><SelectTrigger className="rounded-xl"><SelectValue placeholder="Sin indicar" /></SelectTrigger></FormControl>
              <SelectContent>{Object.entries(CLIENT_SERVICE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <div className="min-w-0">
          {text('supervisor', 'Supervisor', { list: suggestionsId, autoComplete: 'off' })}
          <datalist id={suggestionsId}>{supervisorSuggestions(clients).map(name => <option key={name} value={name} />)}</datalist>
          <p className="mt-1 text-xs text-slate-500">Elige uno de la lista para que los informes lo agrupen igual.</p>
        </div>
        <CheckField form={form} name="linenControlEnabled" label="Control de mudas" hint="Seguimiento de la ropa limpia de sus propiedades." />
        <div className="min-w-0"><AmenitiesManagementField control={form.control} /></div>
        <CheckField form={form} name="photosVisibleToClient" label="Fotos visibles para el cliente" hint="Si está desactivado, el cliente ve el reporte de limpieza sin las fotografías." className="sm:col-span-2" />
      </Section>

      <Section icon={<ToggleRight className="h-4 w-4 text-[#310984]" />} title="Estado">
        <CheckField form={form} name="isActive" label="Cliente activo" hint="Un cliente inactivo deja de ofrecerse al crear tareas. No se borra nada y puede reactivarse." className="sm:col-span-2" />
        {deactivating && <InactivationNotice inheriting={inheritingProperties} ownState={ownStateProperties} className="sm:col-span-2" />}
      </Section>
    </div>
  );
}

export function InactivationNotice({ inheriting, ownState, className = '' }: { inheriting: number; ownState: number; className?: string }) {
  return (
    <p role="status" className={`rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 ${className}`}>
      {inheriting > 0
        ? `${inheriting} ${inheriting === 1 ? 'propiedad sin estado propio pasará' : 'propiedades sin estado propio pasarán'} a mostrarse como ${inheriting === 1 ? 'inactiva' : 'inactivas'} y dejarán de ofrecerse al crear tareas.`
        : 'Ninguna propiedad hereda el estado de este cliente.'}
      {ownState > 0 && ` ${ownState} con estado propio no cambian.`}
      {' '}Las tareas ya creadas y el histórico se conservan.
    </p>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="flex items-center gap-2 text-sm font-black text-slate-950">{icon}{title}</h3>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function CheckField({ form, name, label, hint, disabled, className = '' }: { form: UseFormReturn<ClientFormValues>; name: 'factura' | 'linenControlEnabled' | 'photosVisibleToClient' | 'isActive'; label: string; hint?: string; disabled?: boolean; className?: string }) {
  return (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem className={`flex min-w-0 flex-row items-start gap-3 space-y-0 ${className}`}>
        <FormControl><Checkbox checked={field.value === true} onCheckedChange={checked => field.onChange(checked === true)} disabled={disabled} /></FormControl>
        <div className="min-w-0 space-y-1 leading-none">
          <FormLabel>{label}{disabled && <Lock aria-label="Solo lectura" className="ml-1 inline h-3 w-3 text-slate-400" />}</FormLabel>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </FormItem>
    )} />
  );
}
