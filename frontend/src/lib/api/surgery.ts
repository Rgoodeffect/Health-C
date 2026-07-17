import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frappe } from "./frappe-client";

export interface SurgeryRequestItem {
  name: string;
  patient: string;
  patient_name: string;
  procedure: string;
  requested_by: string | null;
  requested_date: string;
  priority: "Elective" | "Urgent" | "Emergency";
  status: string;
}

export function useSurgeryRequests(status?: string) {
  return useQuery({
    queryKey: ["surgery-requests", status],
    queryFn: () => frappe.get<SurgeryRequestItem[]>("healthcare_erp.api.surgery.list_requests", { status }),
    refetchInterval: 20_000,
  });
}

export function useCreateSurgeryRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { patient: string; procedure: string; requested_by?: string; priority?: string; notes?: string }) =>
      frappe.post("healthcare_erp.api.surgery.create_request", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["surgery-requests"] }),
  });
}

export function useAssignTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { surgery_request: string; team_members: Array<{ practitioner: string; role: string }> }) =>
      frappe.post("healthcare_erp.api.surgery.assign_team", { ...vars, team_members: JSON.stringify(vars.team_members) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["surgery-requests"] }),
  });
}

export function useScheduleSurgery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { surgery_request: string; operating_room: string; scheduled_start: string; scheduled_end: string }) =>
      frappe.post("healthcare_erp.api.surgery.schedule_surgery", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["surgery-requests"] }),
  });
}

export function useSavePreOpChecklist() {
  return useMutation({
    mutationFn: (vars: Record<string, unknown> & { surgery_request: string }) =>
      frappe.post("healthcare_erp.api.surgery.save_pre_op_checklist", vars),
  });
}

export function useSaveAnesthesiaRecord() {
  return useMutation({
    mutationFn: (vars: Record<string, unknown> & { surgery_request: string; anesthesia_type: string }) =>
      frappe.post("healthcare_erp.api.surgery.save_anesthesia_record", vars),
  });
}

export function useSaveSurgeryNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: Record<string, unknown> & { surgery_request: string; procedure_performed: string }) =>
      frappe.post("healthcare_erp.api.surgery.save_surgery_note", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["surgery-requests"] }),
  });
}

export function useAdmitToRecovery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (surgery_request: string) => frappe.post("healthcare_erp.api.surgery.admit_to_recovery", { surgery_request }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recovery-room"] }),
  });
}

export interface RecoveryRoomEntry {
  name: string;
  surgery_request: string;
  patient: string;
  admitted_time: string;
  vitals_stable: 0 | 1;
}

export function useRecoveryRoom() {
  return useQuery({
    queryKey: ["recovery-room"],
    queryFn: () => frappe.get<RecoveryRoomEntry[]>("healthcare_erp.api.surgery.list_recovery_room"),
    refetchInterval: 20_000,
  });
}

export function useDischargeFromRecovery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string; vitals_stable?: number; pain_score?: number; notes?: string }) =>
      frappe.post("healthcare_erp.api.surgery.discharge_from_recovery", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recovery-room"] }),
  });
}

export function useAddImplant() {
  return useMutation({
    mutationFn: (vars: { surgery_request: string; implant_name: string; manufacturer?: string; lot_number?: string; serial_number?: string; expiry_date?: string }) =>
      frappe.post("healthcare_erp.api.surgery.add_implant", vars),
  });
}
