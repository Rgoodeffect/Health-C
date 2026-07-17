import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frappe } from "./frappe-client";

export interface QueueToken {
  name: string;
  patient: string;
  patient_name: string;
  appointment: string | null;
  practitioner: string | null;
  department: string | null;
  status: "Waiting" | "Called" | "In Consultation" | "Completed" | "No Show";
  priority: "Normal" | "Urgent" | "Emergency";
  payment_status: "Pending" | "Verified" | "Waived";
  checked_in_at: string;
  called_at: string | null;
  completed_at: string | null;
}

export function useQueue(department?: string, status?: string) {
  return useQuery({
    queryKey: ["reception-queue", department, status],
    queryFn: () => frappe.get<QueueToken[]>("healthcare_erp.api.reception.queue", { department, status }),
    refetchInterval: 15_000,
  });
}

export interface WaitingRoomDisplay {
  [department: string]: {
    now_serving: Array<{ token: string; patient_first_name: string }>;
    waiting_count: number;
  };
}

export function useWaitingRoomDisplay() {
  return useQuery({
    queryKey: ["waiting-room-display"],
    queryFn: () => frappe.get<WaitingRoomDisplay>("healthcare_erp.api.reception.waiting_room_display"),
    refetchInterval: 10_000,
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { patient: string; appointment?: string; department?: string; practitioner?: string }) =>
      frappe.post("healthcare_erp.api.reception.check_in", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reception-queue"] }),
  });
}

export function useCallNext() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { department?: string; practitioner?: string }) =>
      frappe.post("healthcare_erp.api.reception.call_next", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reception-queue"] }),
  });
}

export function useUpdateTokenStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string; status: string }) => frappe.post("healthcare_erp.api.reception.update_status", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reception-queue"] }),
  });
}

export function useVerifyPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string; payment_status: string }) => frappe.post("healthcare_erp.api.reception.verify_payment", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reception-queue"] }),
  });
}
