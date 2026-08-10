import { supabase } from '@/integrations/supabase/client';
import type { CleaningFeatureCounts, CleaningTimeTemplate } from './cleaningTimeEstimator';
import type { TouristLogisticsInput } from './logisticsCalculator';

export type BudgetStatus = 'draft' | 'review' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'archived';

export interface BudgetTotalsSnapshot {
  totalCost: number;
  totalRevenue: number;
  contribution: number;
  marginPercentage: number;
  monthlyCost: number;
  monthlyRevenue: number;
  monthlyContribution: number;
}

export interface BudgetItemDraft {
  propertyId?: string | null;
  propertyCode?: string;
  propertyName: string;
  propertyAddress?: string;
  featureCounts: CleaningFeatureCounts;
  timeInput: CleaningTimeTemplate;
  logisticsInput?: TouristLogisticsInput;
  serviceLines: {
    laundry: { cost: number; salePrice: number };
    amenities: { cost: number; salePrice: number };
    other: { cost: number; salePrice: number };
  };
  resultSnapshot: Record<string, unknown>;
  activationAction?: 'create' | 'update';
}

export interface BudgetSnapshot {
  clientName: string;
  propertyName: string;
  monthlyRotations: number;
  rates: Record<string, number>;
  featureCounts: CleaningFeatureCounts;
  timeTemplate: CleaningTimeTemplate;
  items?: BudgetItemDraft[];
  logistics?: TouristLogisticsInput;
}

export interface BudgetRecord {
  id: string;
  sede_id: string;
  client_id: string | null;
  quote_number: string;
  title: string;
  prospect_name: string | null;
  status: BudgetStatus;
  validity_date: string | null;
  current_version_number: number;
  monthly_rotations: number;
  total_cost: number;
  total_revenue: number;
  contribution: number;
  margin_percentage: number;
  monthly_cost: number;
  monthly_revenue: number;
  monthly_contribution: number;
  commercial_notes: string | null;
  internal_notes: string | null;
  terms: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetVersionRecord {
  id: string;
  budget_id: string;
  version_number: number;
  input_snapshot: BudgetSnapshot;
  totals_snapshot: BudgetTotalsSnapshot;
  change_reason: string | null;
  created_at: string;
  items: BudgetItemDraft[];
}

export interface BudgetProfileVersionInput {
  laborCostPerHour: number;
  routeAllocationPerHour: number;
  cleaningSalePricePerHour: number;
  logisticsMode: 'provisional-hourly' | 'activity-based';
  targetMarginPercentage?: number;
  minimumMarginPercentage?: number;
  timeTemplate: CleaningTimeTemplate;
  logisticsConfig: Record<string, unknown>;
  defaultLines: Record<string, unknown>;
  commercialTerms: Record<string, unknown>;
}

export interface BudgetRateProfileRecord {
  id: string;
  sede_id: string;
  client_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  versions?: Array<Record<string, unknown>>;
}

// The database types are generated from the remote schema. New tables are deliberately
// isolated here until the reviewed migration is applied and types are regenerated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const database = supabase as any;

const unwrap = <T>(result: { data: T; error: { message?: string } | null }) => {
  if (result.error) throw new Error(result.error.message || 'Error de base de datos');
  return result.data;
};

const itemToRpcPayload = (item: BudgetItemDraft) => ({
  propertyId: item.propertyId ?? null,
  propertyCode: item.propertyCode ?? '',
  propertyName: item.propertyName,
  propertyAddress: item.propertyAddress ?? '',
  featureCounts: item.featureCounts,
  timeInput: item.timeInput,
  logisticsInput: item.logisticsInput ?? {},
  serviceLines: item.serviceLines,
  resultSnapshot: item.resultSnapshot,
  activationAction: item.activationAction ?? (item.propertyId ? 'update' : 'create'),
  durationMinutes: Number(item.resultSnapshot.durationMinutes ?? 0),
  salePrice: Number(item.resultSnapshot.salePrice ?? 0),
  bedrooms: item.featureCounts.bedrooms,
  bathrooms: item.featureCounts.bathrooms,
  beds: item.featureCounts.doubleBeds + item.featureCounts.singleBeds + item.featureCounts.bunkBeds * 2,
});

const totalsToRpcPayload = (totals: BudgetTotalsSnapshot) => ({
  totalCost: totals.totalCost,
  totalRevenue: totals.totalRevenue,
  contribution: totals.contribution,
  marginPercentage: totals.marginPercentage,
  monthlyCost: totals.monthlyCost,
  monthlyRevenue: totals.monthlyRevenue,
  monthlyContribution: totals.monthlyContribution,
});

export async function listTouristBudgets(sedeId: string): Promise<BudgetRecord[]> {
  const result = await database
    .from('tourist_budgets')
    .select('*')
    .eq('sede_id', sedeId)
    .order('updated_at', { ascending: false });
  return unwrap<BudgetRecord[]>(result) || [];
}

export async function getTouristBudget(budgetId: string): Promise<BudgetVersionRecord> {
  const budgetResult = await database.from('tourist_budgets').select('*').eq('id', budgetId).single();
  const budget = unwrap<BudgetRecord>(budgetResult);
  const versionResult = await database
    .from('tourist_budget_versions')
    .select('*')
    .eq('budget_id', budgetId)
    .eq('version_number', budget.current_version_number)
    .single();
  const version = unwrap<BudgetVersionRecord>(versionResult);
  const itemsResult = await database
    .from('tourist_budget_items')
    .select('*')
    .eq('budget_version_id', version.id)
    .order('sort_order', { ascending: true });
  const rows = unwrap<Array<Record<string, unknown>>>(itemsResult) || [];
  return {
    ...version,
    items: rows.map((row) => ({
      propertyId: (row.property_id as string | null) ?? null,
      propertyCode: String(row.property_code ?? ''),
      propertyName: String(row.property_name ?? ''),
      propertyAddress: String(row.property_address ?? ''),
      featureCounts: (row.feature_counts as CleaningFeatureCounts) || {
        kitchens: 1, bathrooms: 1, bedrooms: 1, doubleBeds: 1, singleBeds: 0, bunkBeds: 0, terraces: 0,
      },
      timeInput: (row.time_input as CleaningTimeTemplate) || {
        fixed: 15, kitchen: 20, bathroom: 15, bedroom: 10, doubleBed: 10, singleBed: 7, terrace: 10,
      },
      logisticsInput: (row.logistics_input as TouristLogisticsInput) || undefined,
      serviceLines: (row.service_lines as BudgetItemDraft['serviceLines']) || {
        laundry: { cost: 0, salePrice: 0 }, amenities: { cost: 0, salePrice: 0 }, other: { cost: 0, salePrice: 0 },
      },
      resultSnapshot: (row.result_snapshot as Record<string, unknown>) || {},
    })),
  };
}

export async function createTouristBudget(input: {
  sedeId: string;
  clientId?: string | null;
  title: string;
  prospectName?: string;
  validityDate?: string;
  snapshot: BudgetSnapshot;
  totals: BudgetTotalsSnapshot;
  items: BudgetItemDraft[];
  commercialNotes?: string;
  internalNotes?: string;
  terms?: string;
  sourceProfileVersionId?: string | null;
}) {
  const result = await database.rpc('create_tourist_budget', {
    p_sede_id: input.sedeId,
    p_client_id: input.clientId ?? null,
    p_title: input.title,
    p_prospect_name: input.prospectName ?? null,
    p_validity_date: input.validityDate || null,
    p_snapshot: input.snapshot,
    p_totals: totalsToRpcPayload(input.totals),
    p_items: input.items.map(itemToRpcPayload),
    p_commercial_notes: input.commercialNotes ?? null,
    p_internal_notes: input.internalNotes ?? null,
    p_terms: input.terms ?? null,
    p_source_profile_version_id: input.sourceProfileVersionId ?? null,
  });
  return unwrap<{ budgetId: string; versionId: string; quoteNumber: string }>(result);
}

export async function saveTouristBudgetVersion(input: {
  budgetId: string;
  snapshot: BudgetSnapshot;
  totals: BudgetTotalsSnapshot;
  items: BudgetItemDraft[];
  changeReason?: string;
  sourceProfileVersionId?: string | null;
}) {
  const result = await database.rpc('save_tourist_budget_version', {
    p_budget_id: input.budgetId,
    p_snapshot: input.snapshot,
    p_totals: totalsToRpcPayload(input.totals),
    p_items: input.items.map(itemToRpcPayload),
    p_change_reason: input.changeReason ?? null,
    p_source_profile_version_id: input.sourceProfileVersionId ?? null,
  });
  return unwrap<{ budgetId: string; versionId: string; versionNumber: number }>(result);
}

export async function transitionTouristBudget(budgetId: string, status: BudgetStatus, note?: string) {
  const result = await database.rpc('transition_tourist_budget', {
    p_budget_id: budgetId,
    p_to_status: status,
    p_note: note ?? null,
  });
  return unwrap<{ budgetId: string; fromStatus: BudgetStatus; toStatus: BudgetStatus }>(result);
}

export async function activateTouristBudget(input: {
  budgetId: string;
  versionId: string;
  items: BudgetItemDraft[];
}) {
  const result = await database.rpc('activate_tourist_budget', {
    p_budget_id: input.budgetId,
    p_version_id: input.versionId,
    p_items: input.items.map(itemToRpcPayload),
  });
  return unwrap<{ activationRunId: string; idempotent: boolean; items?: number }>(result);
}

export async function listBudgetRateProfiles(sedeId: string, clientId?: string | null) {
  let query = database
    .from('budget_rate_profiles')
    .select('*, budget_rate_profile_versions(*)')
    .eq('sede_id', sedeId)
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (clientId) query = query.or(`client_id.eq.${clientId},client_id.is.null`);
  const result = await query;
  const rows = unwrap<Array<BudgetRateProfileRecord & { budget_rate_profile_versions?: Array<Record<string, unknown>> }>>(result) || [];
  return rows.map((row) => ({
    ...row,
    versions: row.versions ?? row.budget_rate_profile_versions ?? [],
  }));
}

export async function createBudgetRateProfile(input: {
  sedeId: string;
  clientId?: string | null;
  name: string;
  description?: string;
  version: BudgetProfileVersionInput;
}) {
  const profileResult = await database.from('budget_rate_profiles').insert({
    sede_id: input.sedeId,
    client_id: input.clientId ?? null,
    name: input.name.trim(),
    description: input.description?.trim() || null,
  }).select().single();
  const profile = unwrap<{ id: string }>(profileResult);
  const versionResult = await database.from('budget_rate_profile_versions').insert({
    profile_id: profile.id,
    version_number: 1,
    labor_cost_per_hour: input.version.laborCostPerHour,
    route_allocation_per_hour: input.version.routeAllocationPerHour,
    cleaning_sale_price_per_hour: input.version.cleaningSalePricePerHour,
    logistics_mode: input.version.logisticsMode,
    target_margin_percentage: input.version.targetMarginPercentage ?? null,
    minimum_margin_percentage: input.version.minimumMarginPercentage ?? null,
    time_template: input.version.timeTemplate,
    logistics_config: input.version.logisticsConfig,
    default_lines: input.version.defaultLines,
    commercial_terms: input.version.commercialTerms,
  }).select().single();
  if (versionResult.error) {
    await database.from('budget_rate_profiles').delete().eq('id', profile.id);
  }
  return { profile, version: unwrap(versionResult) };
}

export async function createBudgetRateProfileVersion(input: {
  profileId: string;
  versionNumber: number;
  version: BudgetProfileVersionInput;
}) {
  const result = await database.from('budget_rate_profile_versions').insert({
    profile_id: input.profileId,
    version_number: input.versionNumber,
    labor_cost_per_hour: input.version.laborCostPerHour,
    route_allocation_per_hour: input.version.routeAllocationPerHour,
    cleaning_sale_price_per_hour: input.version.cleaningSalePricePerHour,
    logistics_mode: input.version.logisticsMode,
    target_margin_percentage: input.version.targetMarginPercentage ?? null,
    minimum_margin_percentage: input.version.minimumMarginPercentage ?? null,
    time_template: input.version.timeTemplate,
    logistics_config: input.version.logisticsConfig,
    default_lines: input.version.defaultLines,
    commercial_terms: input.version.commercialTerms,
  }).select().single();
  return unwrap(result);
}

export async function registerBudgetPdf(input: {
  budgetId: string;
  versionId: string;
  fileName: string;
  storagePath?: string;
  contentSha256?: string;
}) {
  const result = await database.from('tourist_budget_documents').insert({
    budget_id: input.budgetId,
    version_id: input.versionId,
    document_type: 'commercial_pdf',
    file_name: input.fileName,
    storage_path: input.storagePath ?? null,
    content_sha256: input.contentSha256 ?? null,
  }).select().single();
  return unwrap(result);
}

export async function uploadBudgetPdf(input: {
  budgetId: string;
  versionId: string;
  quoteNumber: string;
  fileName: string;
  blob: Blob;
}) {
  const storagePath = `${input.budgetId}/${input.versionId}/${input.fileName}`;
  const uploadResult = await supabase.storage
    .from('tourist-budget-documents')
    .upload(storagePath, input.blob, { contentType: 'application/pdf', upsert: true });
  if (uploadResult.error) throw new Error(uploadResult.error.message || 'No se pudo subir el PDF a Storage');

  const digest = await crypto.subtle.digest('SHA-256', await input.blob.arrayBuffer());
  const contentSha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  try {
    await registerBudgetPdf({
      budgetId: input.budgetId,
      versionId: input.versionId,
      fileName: input.fileName,
      storagePath,
      contentSha256,
    });
  } catch (error) {
    await supabase.storage.from('tourist-budget-documents').remove([storagePath]);
    throw error;
  }
  return { storagePath, contentSha256, quoteNumber: input.quoteNumber };
}
