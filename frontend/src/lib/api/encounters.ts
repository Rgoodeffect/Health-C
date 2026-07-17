import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frappe } from "./frappe-client";

export interface EncounterListItem {
  name: string;
  patient: string;
  practitioner: string;
  encounter_date: string;
  docstatus: 0 | 1 | 2;
  chief_complaint: string | null;
  primary_diagnosis_code: string | null;
  follow_up_date: string | null;
}

export function useEncounters(patient: string | undefined) {
  return useQuery({
    queryKey: ["encounters", patient],
    queryFn: () => frappe.get<EncounterListItem[]>("healthcare_erp.api.encounters.list_encounters", { patient }),
    enabled: Boolean(patient),
  });
}

export interface CreateEncounterPayload {
  patient: string;
  practitioner: string;
  chief_complaint?: string;
  history?: string;
  examination?: string;
  diagnosis_code?: string;
  treatment_plan?: string;
  follow_up_date?: string;
  clinical_notes?: string;
}

export function useCreateEncounter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEncounterPayload) =>
      frappe.post("healthcare_erp.api.encounters.create_encounter", payload as unknown as Record<string, unknown>),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["encounters", vars.patient] }),
  });
}

export function useSubmitEncounter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => frappe.post("healthcare_erp.api.encounters.submit_encounter", { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["encounters"] }),
  });
}

export interface Icd10Result {
  code: string;
  title: string;
  category: string | null;
}

export function useIcd10Search(query: string) {
  return useQuery({
    queryKey: ["icd10-search", query],
    queryFn: () => frappe.get<Icd10Result[]>("healthcare_erp.api.encounters.icd10_search", { query }),
    enabled: query.length >= 2,
  });
}

export interface TimelineEvent {
  kind: "consultation" | "appointment" | "lab" | "admission";
  date: string;
  label: string;
  reference: string;
}

export function useMedicalTimeline(patient: string | undefined) {
  return useQuery({
    queryKey: ["medical-timeline", patient],
    queryFn: () => frappe.get<TimelineEvent[]>("healthcare_erp.api.encounters.medical_timeline", { patient }),
    enabled: Boolean(patient),
  });
}

export interface ClinicalAlertItem {
  name: string;
  patient: string;
  patient_name: string;
  severity: "Info" | "Warning" | "Critical";
  message: string;
  raised_on: string;
  acknowledged: 0 | 1;
}

export function useClinicalAlerts(patient?: string) {
  return useQuery({
    queryKey: ["clinical-alerts", patient],
    queryFn: () => frappe.get<ClinicalAlertItem[]>("healthcare_erp.api.encounters.list_clinical_alerts", { patient, acknowledged: 0 }),
    refetchInterval: 30_000,
  });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => frappe.post("healthcare_erp.api.encounters.acknowledge_alert", { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clinical-alerts"] }),
  });
}
