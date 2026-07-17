import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frappe } from "./frappe-client";

export interface DrugSearchResult {
  item_code: string;
  item_name: string;
  item_group: string;
  stock_uom: string;
}

export function useDrugSearch(query: string) {
  return useQuery({
    queryKey: ["drug-search", query],
    queryFn: () => frappe.get<DrugSearchResult[]>("healthcare_erp.api.prescriptions.drug_search", { query }),
    enabled: query.length >= 2,
  });
}

export interface AllergyConflict {
  conflict: boolean;
  matches: Array<{ allergen: string; reaction: string; severity: string }>;
}

export function useAllergyConflict(patient?: string, drug?: string) {
  return useQuery({
    queryKey: ["allergy-conflict", patient, drug],
    queryFn: () => frappe.get<AllergyConflict>("healthcare_erp.api.prescriptions.check_allergy_conflict", { patient, drug }),
    enabled: Boolean(patient && drug),
  });
}

export interface DrugInteraction {
  name: string;
  drug_a: string;
  drug_b: string;
  severity: "Minor" | "Moderate" | "Major";
  description: string;
}

export function useDrugInteractions(drugs: string[]) {
  return useQuery({
    queryKey: ["drug-interactions", drugs],
    queryFn: () => frappe.get<DrugInteraction[]>("healthcare_erp.api.prescriptions.check_drug_interactions", { drugs: JSON.stringify(drugs) }),
    enabled: drugs.length >= 2,
  });
}

export function usePrescribe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      encounter: string;
      drug: string;
      dosage: string;
      frequency: string;
      duration?: string;
      refills_allowed?: number;
      comment?: string;
    }) => frappe.post("healthcare_erp.api.prescriptions.prescribe", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prescriptions"] }),
  });
}

export interface PrescriptionItem {
  name: string;
  drug: string;
  drug_name: string;
  dosage: string;
  frequency: string;
  refills_allowed: number;
  refills_used: number;
  last_refill_date: string | null;
  next_refill_due: string | null;
  status: "Active" | "Completed" | "Cancelled";
  original_encounter: string;
}

export function usePrescriptions(patient: string | undefined) {
  return useQuery({
    queryKey: ["prescriptions", patient],
    queryFn: () => frappe.get<PrescriptionItem[]>("healthcare_erp.api.prescriptions.list_prescriptions", { patient }),
    enabled: Boolean(patient),
  });
}

export function useRequestRefill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => frappe.post("healthcare_erp.api.prescriptions.request_refill", { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prescriptions"] }),
  });
}

export interface PrintablePrescription {
  encounter: string;
  encounter_date: string;
  patient_name: string;
  patient_mrn: string;
  patient_age_sex: string;
  practitioner_name: string;
  diagnosis: string | null;
  drugs: Array<{ drug_name: string; dosage: string; period: string | null; comment: string | null }>;
}

export async function fetchPrintablePrescription(encounter: string) {
  return frappe.get<PrintablePrescription>("healthcare_erp.api.prescriptions.printable_prescription", { encounter });
}
