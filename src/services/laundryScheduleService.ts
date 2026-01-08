import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export interface BuildingGroup {
  buildingCode: string;
  buildingName: string;
  apartments: LaundryApartment[];
  totalApartments: number;
}

export interface LaundryApartment {
  taskId: string;
  propertyId: string;
  propertyCode: string;
  propertyName: string;
  address: string;
  date: string;
  serviceTime: string;
  cleaner?: string;
  textiles: {
    sheets: number;
    sheetsSmall: number;
    sheetsSuite: number;
    pillowCases: number;
    towelsLarge: number;
    towelsSmall: number;
    bathMats: number;
  };
  collectionStatus: 'pending' | 'collected';
  deliveryStatus: 'pending' | 'prepared' | 'delivered';
}

/**
 * Extract building code from property code
 * Examples: 
 * - "CAL-1A" -> "CAL"
 * - "SOL 201" -> "SOL"
 * - "MARINA-B3" -> "MARINA"
 */
export const extractBuildingCode = (propertyCode: string): string => {
  if (!propertyCode) return 'SIN EDIFICIO';
  
  // Try to split by common separators and get first part
  const separators = ['-', ' ', '_', '.'];
  
  for (const sep of separators) {
    if (propertyCode.includes(sep)) {
      const parts = propertyCode.split(sep);
      // Return the first part if it's mostly letters
      const firstPart = parts[0].trim();
      if (firstPart && /^[A-Za-z]+/.test(firstPart)) {
        return firstPart.toUpperCase();
      }
    }
  }
  
  // If no separator found, try to extract letters from the beginning
  const match = propertyCode.match(/^([A-Za-z]+)/);
  if (match) {
    return match[1].toUpperCase();
  }
  
  return propertyCode.toUpperCase();
};

/**
 * Group apartments by building
 */
export const groupApartmentsByBuilding = (apartments: LaundryApartment[]): BuildingGroup[] => {
  const groups: Map<string, LaundryApartment[]> = new Map();

  apartments.forEach(apt => {
    const buildingCode = extractBuildingCode(apt.propertyCode);
    if (!groups.has(buildingCode)) {
      groups.set(buildingCode, []);
    }
    groups.get(buildingCode)!.push(apt);
  });

  // Convert to array and sort
  return Array.from(groups.entries())
    .map(([buildingCode, apts]) => ({
      buildingCode,
      buildingName: `Edificio ${buildingCode}`,
      apartments: apts.sort((a, b) => 
        a.propertyCode.localeCompare(b.propertyCode, 'es', { numeric: true })
      ),
      totalApartments: apts.length,
    }))
    .sort((a, b) => a.buildingCode.localeCompare(b.buildingCode));
};

/**
 * Fetch tasks for specific dates (collection dates)
 */
export const fetchTasksForDates = async (
  dates: string[],
  sedeId?: string
): Promise<LaundryApartment[]> => {
  let query = supabase
    .from('tasks')
    .select(`
      id,
      property,
      address,
      date,
      start_time,
      end_time,
      cleaner,
      propiedad_id,
      properties:propiedad_id (
        id,
        codigo,
        nombre,
        linen_control_enabled,
        is_active,
        numero_sabanas,
        numero_sabanas_pequenas,
        numero_sabanas_suite,
        numero_fundas_almohada,
        numero_toallas_grandes,
        numero_toallas_pequenas,
        numero_alfombrines,
        cliente_id,
        clients:cliente_id (
          id,
          linen_control_enabled,
          is_active
        )
      )
    `)
    .in('date', dates)
    .eq('type', 'mantenimiento-airbnb');

  if (sedeId) {
    query = query.eq('sede_id', sedeId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }

  // Filter by linen control enabled and active
  const filtered = (data || []).filter(task => {
    const property = task.properties as any;
    if (!property) return false;

    // Check active status
    const clientIsActive = property.clients?.is_active !== false;
    const isEffectivelyActive = property.is_active !== null ? property.is_active : clientIsActive;
    if (!isEffectivelyActive) return false;

    // Check linen control
    const propertyLinenEnabled = property.linen_control_enabled;
    const clientLinenEnabled = property.clients?.linen_control_enabled ?? false;
    const effectiveLinenValue = propertyLinenEnabled !== null ? propertyLinenEnabled : clientLinenEnabled;
    
    return effectiveLinenValue === true;
  });

  // Map to LaundryApartment
  return filtered.map(task => {
    const prop = task.properties as any;
    return {
      taskId: task.id,
      propertyId: prop?.id || '',
      propertyCode: prop?.codigo || task.property,
      propertyName: prop?.nombre || task.property,
      address: task.address,
      date: task.date,
      serviceTime: `${task.start_time} - ${task.end_time}`,
      cleaner: task.cleaner || undefined,
      textiles: {
        sheets: prop?.numero_sabanas || 0,
        sheetsSmall: prop?.numero_sabanas_pequenas || 0,
        sheetsSuite: prop?.numero_sabanas_suite || 0,
        pillowCases: prop?.numero_fundas_almohada || 0,
        towelsLarge: prop?.numero_toallas_grandes || 0,
        towelsSmall: prop?.numero_toallas_pequenas || 0,
        bathMats: prop?.numero_alfombrines || 0,
      },
      collectionStatus: 'pending',
      deliveryStatus: 'pending',
    };
  });
};

/**
 * Format delivery day header
 */
export const formatDeliveryDayHeader = (
  deliveryDate: Date,
  collectionDates: Date[]
): { title: string; subtitle: string } => {
  const title = `Reparto ${format(deliveryDate, "EEEE d 'de' MMMM", { locale: es })}`;
  
  let subtitle = '';
  if (collectionDates.length === 1) {
    subtitle = `Servicios del ${format(collectionDates[0], "EEEE d", { locale: es })}`;
  } else if (collectionDates.length > 1) {
    const first = collectionDates[0];
    const last = collectionDates[collectionDates.length - 1];
    subtitle = `Servicios del ${format(first, "EEE d", { locale: es })} al ${format(last, "EEE d", { locale: es })}`;
  }

  return { title, subtitle };
};

/**
 * Calculate totals for a list of apartments
 */
export const calculateTotals = (apartments: LaundryApartment[]) => {
  return apartments.reduce(
    (acc, apt) => ({
      sheets: acc.sheets + apt.textiles.sheets,
      sheetsSmall: acc.sheetsSmall + apt.textiles.sheetsSmall,
      sheetsSuite: acc.sheetsSuite + apt.textiles.sheetsSuite,
      pillowCases: acc.pillowCases + apt.textiles.pillowCases,
      towelsLarge: acc.towelsLarge + apt.textiles.towelsLarge,
      towelsSmall: acc.towelsSmall + apt.textiles.towelsSmall,
      bathMats: acc.bathMats + apt.textiles.bathMats,
    }),
    {
      sheets: 0,
      sheetsSmall: 0,
      sheetsSuite: 0,
      pillowCases: 0,
      towelsLarge: 0,
      towelsSmall: 0,
      bathMats: 0,
    }
  );
};
