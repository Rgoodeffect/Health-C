import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frappe } from "./frappe-client";

export interface LabOrder {
  name: string;
  patient: string;
  patient_name: string;
  template: string;
  practitioner: string | null;
  status: string;
  result_date: string | null;
  result_value: string | null;
  has_critical_result: 0 | 1;
}

export function useLabOrders(status?: string, patient?: string) {
  return useQuery({
    queryKey: ["lab-orders", status, patient],
    queryFn: () => frappe.get<LabOrder[]>("healthcare_erp.api.laboratory.list_orders", { status, patient }),
    refetchInterval: 20_000,
  });
}

export function useCreateLabOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { patient: string; template: string; practitioner?: string }) =>
      frappe.post("healthcare_erp.api.laboratory.create_order", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lab-orders"] }),
  });
}

export function useCollectSample() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lab_test: string) => frappe.post<{ sample: unknown; label: { barcode: string; barcode_image: string | null } }>(
      "healthcare_erp.api.laboratory.collect_sample", { lab_test }
    ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lab-orders"] }),
  });
}

export function useEnterResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { lab_test: string; result_value: string; normal_range?: string; has_critical_result?: number; critical_result_notes?: string }) =>
      frappe.post("healthcare_erp.api.laboratory.enter_result", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lab-orders"] });
      qc.invalidateQueries({ queryKey: ["critical-results"] });
    },
  });
}

export function useVerifyResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lab_test: string) => frappe.post("healthcare_erp.api.laboratory.verify_result", { lab_test }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lab-orders"] }),
  });
}

export function useCriticalResults() {
  return useQuery({
    queryKey: ["critical-results"],
    queryFn: () => frappe.get<LabOrder[]>("healthcare_erp.api.laboratory.list_critical_results"),
    refetchInterval: 15_000,
  });
}

export interface QcRun {
  name: string;
  analyzer: string;
  test_template: string;
  control_level: "Low" | "Normal" | "High";
  expected_value: string;
  measured_value: string;
  within_range: 0 | 1;
  run_by: string;
  run_on: string;
}

export function useQcRuns() {
  return useQuery({
    queryKey: ["qc-runs"],
    queryFn: () => frappe.get<QcRun[]>("healthcare_erp.api.laboratory.list_qc_runs"),
  });
}

export function useRecordQcRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      analyzer: string;
      test_template: string;
      control_level: string;
      expected_value: string;
      measured_value: string;
      notes?: string;
    }) => frappe.post("healthcare_erp.api.laboratory.record_qc_run", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qc-runs"] }),
  });
}
