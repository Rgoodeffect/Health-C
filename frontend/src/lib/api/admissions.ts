import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frappe } from "./frappe-client";

export interface ServiceUnit {
  name: string;
  healthcare_service_unit_name: string;
  service_unit_type: string;
  parent_healthcare_service_unit: string | null;
  is_bed?: 0 | 1;
  occupancy_status?: string;
}

export function useServiceUnits(onlyBeds = false) {
  return useQuery({
    queryKey: ["service-units", onlyBeds],
    queryFn: () => frappe.get<ServiceUnit[]>("healthcare_erp.api.admissions.list_service_units", { only_beds: onlyBeds }),
  });
}

export interface WardOccupancy {
  ward: string;
  total: number;
  occupied: number;
}

export function useBedOccupancySummary() {
  return useQuery({
    queryKey: ["bed-occupancy"],
    queryFn: () => frappe.get<WardOccupancy[]>("healthcare_erp.api.admissions.bed_occupancy_summary"),
    refetchInterval: 30_000,
  });
}

export interface Admission {
  name: string;
  patient: string;
  patient_name: string;
  status: string;
  scheduled_date?: string;
  admitted_datetime?: string;
  expected_discharge?: string;
  practitioner?: string;
  service_unit?: string;
}

export function useAdmissions(status?: string) {
  return useQuery({
    queryKey: ["admissions", status],
    queryFn: () => frappe.get<Admission[]>("healthcare_erp.api.admissions.list_admissions", { status }),
    refetchInterval: 20_000,
  });
}

export function useCreateAdmissionRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { patient: string; practitioner?: string; admission_reason?: string; service_unit?: string }) =>
      frappe.post("healthcare_erp.api.admissions.create_admission_request", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admissions"] }),
  });
}

export function useOccupyBed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { inpatient_record: string; service_unit: string }) => frappe.post("healthcare_erp.api.admissions.occupy_bed", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admissions"] });
      qc.invalidateQueries({ queryKey: ["bed-occupancy"] });
    },
  });
}

export function useRequestTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { inpatient_record: string; to_service_unit: string; reason?: string }) =>
      frappe.post("healthcare_erp.api.admissions.request_transfer", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admissions"] }),
  });
}

export function useDischargePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { inpatient_record: string; discharge_notes?: string }) => frappe.post("healthcare_erp.api.admissions.discharge_patient", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admissions"] });
      qc.invalidateQueries({ queryKey: ["bed-occupancy"] });
    },
  });
}

export interface NursingNoteItem {
  name: string;
  shift: string | null;
  note: string;
  recorded_by: string;
  recorded_on: string;
}

export function useNursingNotes(patient?: string) {
  return useQuery({
    queryKey: ["nursing-notes", patient],
    queryFn: () => frappe.get<NursingNoteItem[]>("healthcare_erp.api.admissions.list_nursing_notes", { patient }),
    enabled: Boolean(patient),
  });
}

export function useAddNursingNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { patient: string; note: string; inpatient_record?: string; shift?: string }) =>
      frappe.post("healthcare_erp.api.admissions.add_nursing_note", vars),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["nursing-notes", vars.patient] }),
  });
}
