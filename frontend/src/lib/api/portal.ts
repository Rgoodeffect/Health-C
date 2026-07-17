import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frappe } from "./frappe-client";

export function useMyProfile() {
  return useQuery({
    queryKey: ["my-profile"],
    queryFn: () => frappe.get<Record<string, unknown> & { name: string; patient_name: string }>("healthcare_erp.api.portal.my_profile"),
  });
}

export interface MyAppointment {
  name: string;
  practitioner: string;
  department: string | null;
  appointment_date: string;
  appointment_time: string;
  status: string;
  appointment_type: string | null;
}

export function useMyAppointments() {
  return useQuery({
    queryKey: ["my-appointments"],
    queryFn: () => frappe.get<MyAppointment[]>("healthcare_erp.api.portal.my_appointments"),
  });
}

export function useBookAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { practitioner: string; appointment_date: string; appointment_time: string; appointment_type?: string }) =>
      frappe.post("healthcare_erp.api.portal.book_appointment", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-appointments"] }),
  });
}

export function useCancelMyAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => frappe.post("healthcare_erp.api.portal.cancel_my_appointment", { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-appointments"] }),
  });
}

export function useMyMedicalRecords() {
  return useQuery({
    queryKey: ["my-medical-records"],
    queryFn: () => frappe.get<Array<{ name: string; encounter_date: string; practitioner: string; chief_complaint?: string; treatment_plan?: string; follow_up_date?: string }>>(
      "healthcare_erp.api.portal.my_medical_records"
    ),
  });
}

export function useMyPrescriptions() {
  return useQuery({
    queryKey: ["my-prescriptions"],
    queryFn: () => frappe.get<Array<{ name: string; drug_name: string; dosage: string; frequency: string; refills_allowed: number; refills_used: number; status: string }>>(
      "healthcare_erp.api.portal.my_prescriptions"
    ),
  });
}

export function useMyLabResults() {
  return useQuery({
    queryKey: ["my-lab-results"],
    queryFn: () => frappe.get<Array<{ name: string; template: string; result_value: string; normal_range: string; result_date: string }>>(
      "healthcare_erp.api.portal.my_lab_results"
    ),
  });
}

export function useMyRadiologyReports() {
  return useQuery({
    queryKey: ["my-radiology-reports"],
    queryFn: () => frappe.get<Array<{ name: string; radiology_order: string; findings: string; impression: string; reported_on: string }>>(
      "healthcare_erp.api.portal.my_radiology_reports"
    ),
  });
}

export function useMyInvoices() {
  return useQuery({
    queryKey: ["my-invoices"],
    queryFn: () => frappe.get<Array<{ name: string; posting_date: string; grand_total: number; outstanding_amount: number; status: string }>>(
      "healthcare_erp.api.portal.my_invoices"
    ),
  });
}

export function useMyDocuments() {
  return useQuery({
    queryKey: ["my-documents"],
    queryFn: () => frappe.get<Array<{ name: string; file_name: string; file_url: string; file_size: number; creation: string }>>(
      "healthcare_erp.api.portal.my_documents"
    ),
  });
}

export function useUploadMyDocument(patientId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      if (!patientId) throw new Error("Patient profile not loaded yet");
      return frappe.uploadFile(file, { doctype: "Patient", docname: patientId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-documents"] }),
  });
}
