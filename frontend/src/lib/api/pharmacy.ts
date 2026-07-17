import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frappe } from "./frappe-client";

export interface DrugItem {
  item_code: string;
  item_name: string;
  item_group: string;
  stock_uom: string;
  is_controlled_substance: 0 | 1;
  controlled_schedule: string | null;
}

export function useDrugList(query: string) {
  return useQuery({
    queryKey: ["pharmacy-drugs", query],
    queryFn: () => frappe.get<DrugItem[]>("healthcare_erp.api.pharmacy.list_drugs", { query }),
    enabled: query.length >= 2,
  });
}

export interface DrugBatch {
  name: string;
  expiry_date: string | null;
  batch_qty?: number;
}

export function useBatches(itemCode?: string) {
  return useQuery({
    queryKey: ["batches", itemCode],
    queryFn: () => frappe.get<DrugBatch[]>("healthcare_erp.api.pharmacy.list_batches", { item_code: itemCode }),
    enabled: Boolean(itemCode),
  });
}

export function useExpiringBatches(days = 30) {
  return useQuery({
    queryKey: ["expiring-batches", days],
    queryFn: () => frappe.get<Array<{ name: string; item: string; expiry_date: string }>>("healthcare_erp.api.pharmacy.expiring_batches", { days }),
  });
}

export function useDispense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { patient: string; drug: string; quantity: number; batch?: string; prescription_refill?: string; witnessed_by?: string }) =>
      frappe.post("healthcare_erp.api.pharmacy.dispense", vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dispensing-log"] });
      qc.invalidateQueries({ queryKey: ["controlled-drug-register"] });
    },
  });
}

export interface DispensingLogItem {
  name: string;
  patient: string;
  drug: string;
  batch: string | null;
  quantity: number;
  is_controlled: 0 | 1;
  dispensed_by: string;
  dispensed_on: string;
}

export function useDispensingLog(patient?: string) {
  return useQuery({
    queryKey: ["dispensing-log", patient],
    queryFn: () => frappe.get<DispensingLogItem[]>("healthcare_erp.api.pharmacy.list_dispensing_log", { patient }),
  });
}

export interface ControlledDrugRegisterItem {
  name: string;
  drug: string;
  schedule: string | null;
  quantity_dispensed: number;
  balance_before: number;
  balance_after: number;
  witnessed_by: string;
  dispensed_on: string;
}

export function useControlledDrugRegister() {
  return useQuery({
    queryKey: ["controlled-drug-register"],
    queryFn: () => frappe.get<ControlledDrugRegisterItem[]>("healthcare_erp.api.pharmacy.controlled_drug_register"),
  });
}

export function useStockLevels(itemCode?: string) {
  return useQuery({
    queryKey: ["stock-levels", itemCode],
    queryFn: () => frappe.get<Array<{ item_code: string; warehouse: string; actual_qty: number }>>("healthcare_erp.api.pharmacy.stock_levels", { item_code: itemCode }),
  });
}
