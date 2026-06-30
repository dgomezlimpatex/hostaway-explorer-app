import type { PlanningV2PropertyRef, PropertyGroupingResult } from '../../types/planningV2';

const CODE_PREFIX_PATTERN = /^([A-Z]+\d+)(?:[.\-_\s/]+.+|[A-Z]+)$/i;

export function normalizePropertyCode(code: string | null | undefined): string {
  return (code ?? '').trim().replace(/\s+/g, '').toUpperCase();
}

export function deriveBuildingCode(propertyCode: string | null | undefined): {
  buildingCode: string;
  kind: PropertyGroupingResult['kind'];
  confidence: number;
  reasons: string[];
} {
  const normalizedCode = normalizePropertyCode(propertyCode);

  if (!normalizedCode) {
    return {
      buildingCode: 'UNKNOWN',
      kind: 'unknown',
      confidence: 0,
      reasons: ['Código de propiedad vacío: no se puede derivar edificio/grupo.'],
    };
  }

  const commonPrefixMatch = normalizedCode.match(CODE_PREFIX_PATTERN);
  if (commonPrefixMatch?.[1]) {
    return {
      buildingCode: commonPrefixMatch[1],
      kind: 'building',
      confidence: 0.95,
      reasons: [`Prefijo común detectado (${commonPrefixMatch[1]}) desde código ${normalizedCode}.`],
    };
  }

  return {
    buildingCode: normalizedCode,
    kind: 'single_property',
    confidence: 0.85,
    reasons: [`Sin prefijo común claro: el apartamento ${normalizedCode} forma su propio grupo.`],
  };
}

export function groupPropertyByCode(property: PlanningV2PropertyRef): PropertyGroupingResult {
  const derived = deriveBuildingCode(property.code);
  const normalizedCode = normalizePropertyCode(property.code);
  const buildingGroupId = `${property.sedeId}:${derived.buildingCode}`;

  return {
    propertyId: property.id,
    propertyCode: normalizedCode,
    workCenterId: property.id,
    buildingGroupId,
    buildingCode: derived.buildingCode,
    kind: derived.kind,
    confidence: derived.confidence,
    reasons: [
      'Centro de trabajo = propiedad individual.',
      ...derived.reasons,
      `Grupo acotado a sede (${property.sedeId}) para evitar intercambio entre sedes.`,
    ],
  };
}

export function groupPropertiesByBuilding(properties: PlanningV2PropertyRef[]): Record<string, PropertyGroupingResult[]> {
  return properties.reduce<Record<string, PropertyGroupingResult[]>>((groups, property) => {
    const grouping = groupPropertyByCode(property);
    groups[grouping.buildingGroupId] = [...(groups[grouping.buildingGroupId] ?? []), grouping];
    return groups;
  }, {});
}
