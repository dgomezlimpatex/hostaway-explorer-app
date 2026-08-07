const HOURS_KEYS = [
  'contract_hours_per_week',
  'contracted_weekly_hours',
  'weekly_hours',
  'hours_per_week',
  'contractHoursPerWeek',
  'contractedWeeklyHours',
  'weeklyHours',
  'hoursPerWeek',
];

const PHONE_KEYS = ['phone', 'telefono', 'mobile_phone', 'phone_number'];

const numberFromValue = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string' || value.trim() === '') return undefined;

  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const candidateValues = (employee, keys, includeNestedHours = false) => {
  const values = [];
  for (const key of keys) {
    if (employee && employee[key] !== undefined && employee[key] !== null && employee[key] !== '') {
      values.push(employee[key]);
    }
  }

  if (includeNestedHours) {
    for (const contract of [employee?.contract, employee?.employment]) {
      if (!contract || typeof contract !== 'object') continue;
      for (const key of HOURS_KEYS) {
        if (contract[key] !== undefined && contract[key] !== null && contract[key] !== '') {
          values.push(contract[key]);
        }
      }
    }
  }

  return values;
};

/** Normalize known REGISTRO field spellings while keeping absent distinct from zero. */
export const getContractHoursPerWeek = (employee) => {
  for (const value of candidateValues(employee, HOURS_KEYS, true)) {
    const parsed = numberFromValue(value);
    if (parsed !== undefined && parsed >= 0 && parsed <= 80) return parsed;
  }
  return undefined;
};

export const getRegistroEmail = (employee) => {
  const value = employee?.email;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized || undefined;
};

export const getRegistroPhone = (employee) => {
  for (const value of candidateValues(employee, PHONE_KEYS)) {
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return undefined;
};
