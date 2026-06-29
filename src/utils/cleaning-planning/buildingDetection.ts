import { BuildingDetectionRule, DetectedBuilding } from '../../types/cleaningPlanning';

export const normalizePropertyCode = (code?: string | null): string => (code || '')
  .trim()
  .toUpperCase()
  .replace(/\s+/g, '');

const ruleMatchesCode = (code: string, rule: BuildingDetectionRule): boolean => {
  const pattern = normalizePropertyCode(rule.pattern);
  if (!pattern) return false;

  switch (rule.matchType) {
    case 'exact':
      return code === pattern;
    case 'prefix':
      return code.startsWith(pattern);
    case 'contains':
      return code.includes(pattern);
    case 'regex': {
      try {
        return new RegExp(rule.pattern, 'i').test(code);
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
};

export const detectBuildingFromCode = (
  propertyCode: string | null | undefined,
  rules: BuildingDetectionRule[] = [],
): DetectedBuilding => {
  const normalizedCode = normalizePropertyCode(propertyCode);

  if (!normalizedCode) {
    return {
      status: 'not_detected',
      reason: 'La propiedad no tiene código operativo para detectar edificio.',
    };
  }

  const matches = rules
    .filter((rule) => rule.isActive)
    .filter((rule) => ruleMatchesCode(normalizedCode, rule))
    .sort((a, b) => a.priority - b.priority || normalizePropertyCode(b.pattern).length - normalizePropertyCode(a.pattern).length);

  if (matches.length === 0) {
    return {
      status: 'not_detected',
      reason: `No hay regla activa para el código ${normalizedCode}.`,
    };
  }

  const best = matches[0];
  const samePriorityMatches = matches.filter((rule) => rule.priority === best.priority);

  if (samePriorityMatches.length > 1) {
    return {
      status: 'ambiguous',
      reason: `El código ${normalizedCode} coincide con varias reglas de edificio.`,
    };
  }

  return {
    status: 'detected',
    propertyGroupId: best.propertyGroupId,
    propertyGroupName: best.propertyGroupName,
    matchedRuleId: best.id,
    matchedPattern: best.pattern,
    reason: `Edificio detectado automáticamente por regla ${best.matchType} “${best.pattern}”.`,
  };
};
