import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frappe } from "./frappe-client";

export interface RadiologyOrder {
  name: string;
  patient: string;
  patient_name: string;
  practitioner: string | null;
  modality: string;
  body_part: string | null;
  priority: "Routine" | "Urgent" | "STAT";
  order_date: string;
  scheduled_datetime: string | null;
  status: string;
  critical_finding: 0 | 1;
}

export function useRadiologyOrders(status?: string) {
  return useQuery({
    queryKey: ["radiology-orders", status],
    queryFn: () => frappe.get<RadiologyOrder[]>("healthcare_erp.api.radiology.list_orders", { status }),
    refetchInterval: 20_000,
  });
}

export function useCreateRadiologyOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { patient: string; modality: string; body_part?: string; practitioner?: string; priority?: string; clinical_indication?: string }) =>
      frappe.post("healthcare_erp.api.radiology.create_order", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["radiology-orders"] }),
  });
}

export function useScheduleRadiologyOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string; scheduled_datetime: string }) => frappe.post("healthcare_erp.api.radiology.schedule_order", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["radiology-orders"] }),
  });
}

export function useCreateRadiologyReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { radiology_order: string; findings: string; impression: string; critical_finding?: number; critical_finding_notes?: string }) =>
      frappe.post("healthcare_erp.api.radiology.create_report", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["radiology-orders"] }),
  });
}

export interface Modality {
  modality_code: string;
  modality_name: string;
  service_unit: string | null;
}

export function useModalities() {
  return useQuery({
    queryKey: ["modalities"],
    queryFn: () => frappe.get<Modality[]>("healthcare_erp.api.radiology.list_modalities"),
  });
}

export function useCreateModality() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { modality_code: string; modality_name: string; service_unit?: string }) =>
      frappe.post("healthcare_erp.api.radiology.create_modality", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["modalities"] }),
  });
}
