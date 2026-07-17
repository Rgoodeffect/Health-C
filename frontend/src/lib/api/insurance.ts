import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frappe } from "./frappe-client";

export function useInsuranceCompanies() {
  return useQuery({
    queryKey: ["insurance-companies"],
    queryFn: () => frappe.get<Array<{ name: string }>>("healthcare_erp.api.insurance.list_companies"),
  });
}

export function useVerifyEligibility() {
  return useMutation({
    mutationFn: (vars: { patient: string; insurance_company: string; coverage_plan?: string }) =>
      frappe.post<{ eligible: boolean; insurance_company: string; coverage_plan: string | null; checked_on: string }>(
        "healthcare_erp.api.insurance.verify_eligibility", vars
      ),
  });
}

export interface PreAuthorization {
  name: string;
  patient: string;
  insurance_company: string;
  procedure_or_service: string;
  estimated_cost: number | null;
  status: "Requested" | "Approved" | "Denied" | "Expired";
  auth_number: string | null;
  requested_date: string;
}

export function usePreAuthorizations(patient?: string) {
  return useQuery({
    queryKey: ["pre-authorizations", patient],
    queryFn: () => frappe.get<PreAuthorization[]>("healthcare_erp.api.insurance.list_pre_authorizations", { patient }),
  });
}

export function useRequestPreAuthorization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { patient: string; insurance_company: string; procedure_or_service: string; coverage_plan?: string; estimated_cost?: number }) =>
      frappe.post("healthcare_erp.api.insurance.request_pre_authorization", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pre-authorizations"] }),
  });
}

export function useUpdatePreAuthorization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string; status: string; auth_number?: string; valid_until?: string }) =>
      frappe.post("healthcare_erp.api.insurance.update_pre_authorization", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pre-authorizations"] }),
  });
}

export interface InsuranceClaimItem {
  name: string;
  patient: string;
  insurance_company: string;
  coverage_type: "Full Coverage" | "Co-Payment" | "Deductible";
  claim_amount: number;
  approved_amount: number | null;
  status: string;
  submitted_on: string | null;
}

export function useClaims(patient?: string, status?: string) {
  return useQuery({
    queryKey: ["insurance-claims", patient, status],
    queryFn: () => frappe.get<InsuranceClaimItem[]>("healthcare_erp.api.insurance.list_claims", { patient, status }),
  });
}

export function useCreateClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { patient: string; insurance_company: string; claim_amount: number; coverage_type?: string; invoice?: string }) =>
      frappe.post("healthcare_erp.api.insurance.create_claim", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insurance-claims"] }),
  });
}

export function useSubmitClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => frappe.post("healthcare_erp.api.insurance.submit_claim", { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insurance-claims"] }),
  });
}

export function useRejectClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { claim: string; reason: string }) => frappe.post("healthcare_erp.api.insurance.reject_claim", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["insurance-claims"] });
      qc.invalidateQueries({ queryKey: ["insurance-rejections"] });
    },
  });
}

export interface RejectionItem {
  name: string;
  claim: string;
  reason: string;
  rejected_on: string;
  resubmission_count: number;
  status: string;
}

export function useRejections(status?: string) {
  return useQuery({
    queryKey: ["insurance-rejections", status],
    queryFn: () => frappe.get<RejectionItem[]>("healthcare_erp.api.insurance.list_rejections", { status }),
  });
}

export function useResubmitClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rejection: string) => frappe.post("healthcare_erp.api.insurance.resubmit_claim", { rejection }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["insurance-claims"] });
      qc.invalidateQueries({ queryKey: ["insurance-rejections"] });
    },
  });
}

export function useSettleClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { claim: string; settled_amount: number; payment_reference?: string }) =>
      frappe.post("healthcare_erp.api.insurance.settle_claim", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["insurance-claims"] });
      qc.invalidateQueries({ queryKey: ["insurance-settlements"] });
    },
  });
}

export interface SettlementItem {
  name: string;
  claim: string;
  settled_amount: number;
  settlement_date: string;
  payment_reference: string | null;
  status: string;
}

export function useSettlements() {
  return useQuery({
    queryKey: ["insurance-settlements"],
    queryFn: () => frappe.get<SettlementItem[]>("healthcare_erp.api.insurance.list_settlements"),
  });
}
