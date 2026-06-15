import type { CreatePropertyData, Property } from '@/types/property';
import type { StockProduct, StockPropertyConsumptionRule } from '@/types/stock';
import type { UseFormSetValue } from 'react-hook-form';
import type { PropertyFormData } from './PropertyFormSchema';

type LegacyStockField =
  | 'numeroSabanas'
  | 'numeroSabanasRequenas'
  | 'numeroSabanasSuite'
  | 'numeroToallasGrandes'
  | 'numeroTotallasPequenas'
  | 'numeroAlfombrines'
  | 'numeroFundasAlmohada'
  | 'kitAlimentario'
  | 'amenitiesBano'
  | 'amenitiesCocina'
  | 'cantidadRollosPapelHigienico'
  | 'cantidadRollosPapelCocina'
  | 'bayetasCocina'
  | 'bolsasBasura';

export type StockConsumptionValues = Record<string, number>;

export type PropertyConsumptionCharacteristics = Pick<
  CreatePropertyData,
  'numeroCamas' | 'numeroCamasPequenas' | 'numeroCamasSuite' | 'numeroSofasCama' | 'numeroBanos' | 'numeroCocinas'
>;

const legacyStockFields: LegacyStockField[] = [
  'numeroSabanas',
  'numeroSabanasRequenas',
  'numeroSabanasSuite',
  'numeroToallasGrandes',
  'numeroTotallasPequenas',
  'numeroAlfombrines',
  'numeroFundasAlmohada',
  'kitAlimentario',
  'amenitiesBano',
  'amenitiesCocina',
  'cantidadRollosPapelHigienico',
  'cantidadRollosPapelCocina',
  'bayetasCocina',
  'bolsasBasura',
];

export const normalizeStockName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const getLegacyFieldForStockProduct = (product: Pick<StockProduct, 'name'>): LegacyStockField | null => {
  const name = normalizeStockName(product.name);

  if (name.includes('fundas') && name.includes('almohada')) return 'numeroFundasAlmohada';
  if (name.includes('sabanas') && name.includes('suite')) return 'numeroSabanasSuite';
  if (name.includes('sabanas') && (name.includes('individual') || name.includes('pequena'))) return 'numeroSabanasRequenas';
  if (name.includes('sabanas') && (name.includes('matrimonio') || name.includes('grande'))) return 'numeroSabanas';
  if (name.includes('toallas') && name.includes('grande')) return 'numeroToallasGrandes';
  if (name.includes('toallas') && (name.includes('pequena') || name.includes('pequenas'))) return 'numeroTotallasPequenas';
  if (name.includes('alfombr')) return 'numeroAlfombrines';
  if (name.includes('alimentacion') || name.includes('alimentario')) return 'kitAlimentario';
  if (name.includes('amenities') && name.includes('bano')) return 'amenitiesBano';
  if (name.includes('amenities') && name.includes('cocina')) return 'amenitiesCocina';
  if (name.includes('papel') && name.includes('higienico')) return 'cantidadRollosPapelHigienico';
  if (name.includes('papel') && name.includes('cocina')) return 'cantidadRollosPapelCocina';
  if ((name.includes('panos') || name.includes('bayetas')) && name.includes('cocina')) return 'bayetasCocina';
  if (name.includes('bolsas') && name.includes('basura')) {
    if (name.includes('10l') || name.includes('10 l')) return null;
    if (name.includes('30l') || name.includes('30 l') || name === 'bolsas basura' || name === 'bolsas de basura') {
      return 'bolsasBasura';
    }
  }

  return null;
};

export const calculateDefaultPropertyConsumptions = (
  characteristics: PropertyConsumptionCharacteristics
): Partial<Record<LegacyStockField, number>> => {
  const doubleBeds = Number(characteristics.numeroCamas) || 0;
  const singleBeds = Number(characteristics.numeroCamasPequenas) || 0;
  const suiteBeds = Number(characteristics.numeroCamasSuite) || 0;
  const sofaBeds = Number(characteristics.numeroSofasCama) || 0;
  const bathrooms = Number(characteristics.numeroBanos) || 0;
  const kitchens = Number(characteristics.numeroCocinas) || 0;
  const doubleBedEquivalent = doubleBeds + sofaBeds;

  return {
    numeroSabanas: (doubleBedEquivalent * 3) + (singleBeds * 3),
    numeroSabanasRequenas: 0,
    numeroSabanasSuite: suiteBeds * 3,
    numeroFundasAlmohada: (doubleBedEquivalent * 2) + singleBeds + (suiteBeds * 2),
    numeroToallasGrandes: (doubleBedEquivalent * 2) + singleBeds + (suiteBeds * 2),
    numeroTotallasPequenas: (doubleBedEquivalent * 2) + singleBeds + (suiteBeds * 2),
    numeroAlfombrines: bathrooms,
    amenitiesBano: bathrooms,
    cantidadRollosPapelHigienico: bathrooms * 2,
    kitAlimentario: kitchens,
    amenitiesCocina: kitchens,
    bayetasCocina: kitchens,
    bolsasBasura: kitchens,
    cantidadRollosPapelCocina: 0,
  };
};

export const buildDefaultStockConsumptions = (
  products: StockProduct[],
  characteristics: PropertyConsumptionCharacteristics
): StockConsumptionValues => {
  const defaults = calculateDefaultPropertyConsumptions(characteristics);

  return products.reduce<StockConsumptionValues>((values, product) => {
    const legacyField = getLegacyFieldForStockProduct(product);
    values[product.id] = legacyField ? defaults[legacyField] || 0 : 0;
    return values;
  }, {});
};

export const applyDefaultPropertyConsumptionsToForm = (
  setValue: UseFormSetValue<PropertyFormData>,
  products: StockProduct[],
  characteristics: PropertyConsumptionCharacteristics,
  options: { shouldDirty?: boolean; shouldTouch?: boolean } = {}
) => {
  const shouldDirty = options.shouldDirty ?? true;
  const shouldTouch = options.shouldTouch ?? false;
  const defaults = calculateDefaultPropertyConsumptions(characteristics);
  const stockConsumptions = buildDefaultStockConsumptions(
    products.filter((product) => product.is_consumable),
    characteristics
  );

  legacyStockFields.forEach((field) => {
    setValue(field, defaults[field] || 0, { shouldDirty, shouldTouch });
  });

  setValue('stockConsumptions', stockConsumptions, { shouldDirty, shouldTouch });
};

export const buildInitialStockConsumptions = (
  products: StockProduct[],
  rules: StockPropertyConsumptionRule[],
  property?: Property | null
): StockConsumptionValues => {
  const ruleByProduct = new Map(rules.map((rule) => [rule.product_id, rule.quantity_per_cleaning]));

  return products.reduce<StockConsumptionValues>((values, product) => {
    const ruleValue = ruleByProduct.get(product.id);

    if (ruleValue != null) {
      values[product.id] = Number(ruleValue) || 0;
      return values;
    }

    const legacyField = property ? getLegacyFieldForStockProduct(product) : null;
    values[product.id] = legacyField ? Number(property[legacyField]) || 0 : 0;
    return values;
  }, {});
};

export const deriveLegacyStockFields = (
  products: StockProduct[],
  consumptions: StockConsumptionValues = {}
): Partial<Record<LegacyStockField, number>> => {
  return products.reduce<Partial<Record<LegacyStockField, number>>>((fields, product) => {
    const legacyField = getLegacyFieldForStockProduct(product);
    if (!legacyField) return fields;

    const quantity = Number(consumptions[product.id]) || 0;
    fields[legacyField] = (fields[legacyField] || 0) + quantity;
    return fields;
  }, {});
};
