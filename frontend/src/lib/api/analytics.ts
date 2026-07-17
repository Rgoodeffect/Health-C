import { useQuery } from "@tanstack/react-query";
import { frappe } from "./frappe-client";

export interface LiveKpis {
  total_patients: number;
  new_patients_today: number;
  appointments_today: number;
  active_admissions: number;
  surgeries_mtd: number;
  lab_tests_today: number;
  radiology_orders_today: number;
  pharmacy_dispensed_today: number;
  claims_submitted_mtd: number;
  claims_settled_mtd: number;
  bed_occupancy_pct: number;
  revenue_mtd: number;
  collections_mtd: number;
}

export function useLiveKpis() {
  return useQuery({
    queryKey: ["live-kpis"],
    queryFn: () => frappe.get<LiveKpis>("healthcare_erp.api.analytics.live_kpis"),
    refetchInterval: 60_000,
  });
}

export interface TrendPoint {
  date: string;
  amount: number;
}

export function useRevenueTrend(days = 30) {
  return useQuery({
    queryKey: ["revenue-trend", days],
    queryFn: () => frappe.get<TrendPoint[]>("healthcare_erp.api.analytics.revenue_trend", { days }),
  });
}

export interface PatientTrendPoint {
  date: string;
  count: number;
}

export function usePatientGrowthTrend(days = 30) {
  return useQuery({
    queryKey: ["patient-growth-trend", days],
    queryFn: () => frappe.get<PatientTrendPoint[]>("healthcare_erp.api.analytics.patient_growth_trend", { days }),
  });
}
