import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frappe } from "./frappe-client";

export type CalendarView = "day" | "week" | "month";

export interface AppointmentItem {
  name: string;
  patient: string;
  patient_name: string;
  practitioner: string;
  practitioner_name: string;
  department: string | null;
  appointment_date: string;
  appointment_time: string;
  duration: number;
  appointment_type: string | null;
  status: string;
  notes: string | null;
}

export function useAppointmentCalendar(view: CalendarView, date: string) {
  return useQuery({
    queryKey: ["appointments-calendar", view, date],
    queryFn: () =>
      frappe.get<AppointmentItem[], { view: string; start: string; end: string }>(
        "healthcare_erp.api.appointments.calendar",
        { view, date }
      ),
  });
}

export function useRescheduleAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string; appointment_date: string; appointment_time: string }) =>
      frappe.post("healthcare_erp.api.appointments.reschedule_appointment", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments-calendar"] }),
  });
}

export function useCancelAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string; reason?: string }) =>
      frappe.post("healthcare_erp.api.appointments.cancel_appointment", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments-calendar"] }),
  });
}

export interface CreateAppointmentPayload {
  patient: string;
  practitioner: string;
  department?: string;
  appointment_date: string;
  appointment_time: string;
  duration?: number;
  appointment_type?: string;
  notes?: string;
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAppointmentPayload) =>
      frappe.post("healthcare_erp.api.appointments.create_appointment", payload as unknown as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments-calendar"] }),
  });
}

export interface WaitingListItem {
  name: string;
  patient: string;
  patient_name: string;
  practitioner: string | null;
  department: string | null;
  preferred_date: string | null;
  priority: "Routine" | "Urgent" | "Emergency";
  status: string;
  added_on: string;
  notes: string | null;
}

export function useWaitingList(status = "Waiting") {
  return useQuery({
    queryKey: ["waiting-list", status],
    queryFn: () => frappe.get<WaitingListItem[]>("healthcare_erp.api.appointments.list_waiting_list", { status }),
  });
}

export function useRemoveFromWaitingList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => frappe.post("healthcare_erp.api.appointments.remove_from_waiting_list", { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["waiting-list"] }),
  });
}
