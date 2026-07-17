import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frappe } from "./frappe-client";

export interface Invoice {
  name: string;
  posting_date: string;
  grand_total: number;
  outstanding_amount: number;
  status: string;
  customer: string;
}

export function useInvoices(patient?: string) {
  return useQuery({
    queryKey: ["invoices", patient],
    queryFn: () => frappe.get<Invoice[]>("healthcare_erp.api.billing.list_invoices", { patient }),
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { patient: string; items: Array<{ item_code: string; qty: number; rate?: number }>; mode_of_payment?: string; pay_immediately?: boolean }) =>
      frappe.post("healthcare_erp.api.billing.create_invoice", { ...vars, items: JSON.stringify(vars.items) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { invoice: string; mode_of_payment: string; amount: number; reference_no?: string }) =>
      frappe.post("healthcare_erp.api.billing.record_payment", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
}

export function useRecordDeposit() {
  return useMutation({
    mutationFn: (vars: { patient: string; amount: number; mode_of_payment: string }) => frappe.post("healthcare_erp.api.billing.record_deposit", vars),
  });
}

export function useRecordRefund() {
  return useMutation({
    mutationFn: (vars: { payment_entry: string; amount: number; reason: string }) => frappe.post("healthcare_erp.api.billing.record_refund", vars),
  });
}

export interface RevenueSummary {
  total: number;
  by_day: Array<{ date: string; amount: number }>;
}

export function useRevenueSummary(fromDate?: string, toDate?: string) {
  return useQuery({
    queryKey: ["revenue-summary", fromDate, toDate],
    queryFn: () => frappe.get<RevenueSummary>("healthcare_erp.api.billing.revenue_summary", { from_date: fromDate, to_date: toDate }),
  });
}

export interface CashClosing {
  name: string;
  cashier: string;
  closing_date: string;
  total_collected: number;
  opening_balance: number;
  actual_cash_balance: number;
  variance: number;
  status: string;
}

export function useTodaysClosing() {
  return useQuery({
    queryKey: ["todays-closing"],
    queryFn: () => frappe.get<CashClosing | null>("healthcare_erp.api.billing.get_todays_closing"),
  });
}

export function useSubmitCashClosing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { opening_balance: number; actual_cash_balance: number; notes?: string }) =>
      frappe.post("healthcare_erp.api.billing.submit_cash_closing", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["todays-closing"] });
      qc.invalidateQueries({ queryKey: ["cash-closings"] });
    },
  });
}

export function useCashClosings() {
  return useQuery({
    queryKey: ["cash-closings"],
    queryFn: () => frappe.get<CashClosing[]>("healthcare_erp.api.billing.list_cash_closings"),
  });
}
