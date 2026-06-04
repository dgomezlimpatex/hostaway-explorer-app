import type { Property } from '@/types/property';
import type { StockProduct, StockPropertyConsumptionRule } from '@/types/stock';

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
  if (name === 'bolsas basura' || name === 'bolsas de basura') return 'bolsasBasura';

  return null;
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
