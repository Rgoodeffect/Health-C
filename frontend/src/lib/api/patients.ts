import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frappe, type PaginatedMeta } from "./frappe-client";

export interface PatientListItem {
  name: string;
  patient_name: string;
  sex: string;
  dob: string;
  mobile: string;
  email: string;
  status: string;
  national_id: string;
  primary_insurance_company: string | null;
  insurance_verified: 0 | 1;
  image: string | null;
  qr_code: string | null;
}

export interface Patient360 {
  overview: {
    patient_name: string;
    mrn: string;
    sex: string;
    dob: string;
    age: string | null;
    blood_group: string | null;
    mobile: string;
    email: string;
    national_id: string | null;
    passport_no: string | null;
    qr_code: string | null;
    image: string | null;
    status: string;
  };
  appointments: Array<Record<string, unknown>>;
  consultations: Array<Record<string, unknown>>;
  prescriptions: Array<Record<string, unknown>>;
  lab: Array<Record<string, unknown>>;
  radiology: Array<Record<string, unknown>>;
  admissions: Array<Record<string, unknown>>;
  surgery: Array<Record<string, unknown>>;
  billing: Array<Record<string, unknown>>;
  insurance: Record<string, unknown>;
  documents: Array<Record<string, unknown>>;
}

export function usePatients(params: { page?: number; page_size?: number; filters?: Record<string, unknown> } = {}) {
  return useQuery({
    queryKey: ["patients", params],
    queryFn: () =>
      frappe.get<PatientListItem[], PaginatedMeta>("healthcare_erp.api.patients.list_patients", {
        page: params.page,
        page_size: params.page_size,
        filters: params.filters,
      }),
  });
}

export function usePatient360(patient: string | undefined) {
  return useQuery({
    queryKey: ["patient-360", patient],
    queryFn: () => frappe.get<Patient360>("healthcare_erp.api.patients.patient_360", { patient }),
    enabled: Boolean(patient),
  });
}

export interface CreatePatientPayload {
  first_name: string;
  last_name?: string;
  sex: string;
  dob: string;
  mobile: string;
  email?: string;
  blood_group?: string;
  national_id?: string;
  passport_no?: string;
  primary_insurance_company?: string;
  primary_policy_number?: string;
  coverage_plan?: string;
  emergency_contacts?: Array<{ name: string; relation: string; phone: string }>;
}

export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePatientPayload) =>
      frappe.post("healthcare_erp.api.patients.create_patient", payload as unknown as Record<string, unknown>),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patients"] }),
  });
}

export type { PaginatedMeta };
