"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Activity, BedDouble, CalendarClock, FlaskConical, ScanLine, ShieldCheck,
  Stethoscope, Syringe, TrendingUp, Users, Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/kpi-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendChart } from "@/components/charts/trend-chart";
import { useWhoAmI } from "@/lib/api/auth";
import { useLiveKpis, useRevenueTrend, usePatientGrowthTrend } from "@/lib/api/analytics";

export default function AnalyticsPage() {
  const t = useTranslations("analytics");
  const { data: me } = useWhoAmI();
  const roles = me?.data.roles ?? [];
  const { data: kpisData, isLoading } = useLiveKpis();
  const { data: revenueData } = useRevenueTrend(30);
  const { data: patientData } = usePatientGrowthTrend(30);

  const kpis = kpisData?.data;
  const revenueTrend = (revenueData?.data ?? []).map((p) => ({ date: p.date, amount: p.amount }));
  const patientTrend = (patientData?.data ?? []).map((p) => ({ date: p.date, count: p.count }));

  const canSeeFinance = roles.some((r) => ["CEO", "Finance Director", "System Manager"].includes(r));
  const canSeeClinical = roles.some((r) => ["CEO", "Medical Director", "System Manager"].includes(r));

  const money = (v: number) => `${(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Tabs defaultValue="ceo">
        <TabsList>
          <TabsTrigger value="ceo">{t("tabCeo")}</TabsTrigger>
          {canSeeClinical && <TabsTrigger value="medical">{t("tabMedical")}</TabsTrigger>}
          {canSeeFinance && <TabsTrigger value="finance">{t("tabFinance")}</TabsTrigger>}
          <TabsTrigger value="operations">{t("tabOperations")}</TabsTrigger>
        </TabsList>

        <TabsContent value="ceo" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard icon={Users} label={t("kpiTotalPatients")} value={isLoading ? "…" : String(kpis?.total_patients ?? 0)} tone="primary" />
            <KpiCard icon={TrendingUp} label={t("kpiRevenueMtd")} value={isLoading ? "…" : money(kpis?.revenue_mtd ?? 0)} tone="success" />
            <KpiCard icon={BedDouble} label={t("kpiOccupancy")} value={isLoading ? "…" : `${kpis?.bed_occupancy_pct ?? 0}%`} tone="warning" />
            <KpiCard icon={Stethoscope} label={t("kpiActiveAdmissions")} value={isLoading ? "…" : String(kpis?.active_admissions ?? 0)} tone="danger" />
          </div>
          <Card>
            <CardHeader><CardTitle>{t("revenueTrend")}</CardTitle></CardHeader>
            <CardContent><TrendChart data={revenueTrend} dataKey="amount" valueFormatter={money} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t("patientGrowth")}</CardTitle></CardHeader>
            <CardContent><TrendChart data={patientTrend} dataKey="count" /></CardContent>
          </Card>
        </TabsContent>

        {canSeeClinical && (
          <TabsContent value="medical" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard icon={CalendarClock} label={t("kpiAppointmentsToday")} value={isLoading ? "…" : String(kpis?.appointments_today ?? 0)} tone="primary" />
              <KpiCard icon={BedDouble} label={t("kpiOccupancy")} value={isLoading ? "…" : `${kpis?.bed_occupancy_pct ?? 0}%`} tone="warning" />
              <KpiCard icon={FlaskConical} label={t("kpiLabToday")} value={isLoading ? "…" : String(kpis?.lab_tests_today ?? 0)} tone="success" />
              <KpiCard icon={ScanLine} label={t("kpiRadiologyToday")} value={isLoading ? "…" : String(kpis?.radiology_orders_today ?? 0)} tone="danger" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <KpiCard icon={Activity} label={t("kpiSurgeriesMtd")} value={isLoading ? "…" : String(kpis?.surgeries_mtd ?? 0)} tone="primary" />
              <KpiCard icon={Stethoscope} label={t("kpiActiveAdmissions")} value={isLoading ? "…" : String(kpis?.active_admissions ?? 0)} tone="warning" />
            </div>
            <Card>
              <CardHeader><CardTitle>{t("patientGrowth")}</CardTitle></CardHeader>
              <CardContent><TrendChart data={patientTrend} dataKey="count" /></CardContent>
            </Card>
          </TabsContent>
        )}

        {canSeeFinance && (
          <TabsContent value="finance" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard icon={TrendingUp} label={t("kpiRevenueMtd")} value={isLoading ? "…" : money(kpis?.revenue_mtd ?? 0)} tone="success" />
              <KpiCard icon={Wallet} label={t("kpiCollectionsMtd")} value={isLoading ? "…" : money(kpis?.collections_mtd ?? 0)} tone="primary" />
              <KpiCard icon={ShieldCheck} label={t("kpiClaimsSubmitted")} value={isLoading ? "…" : String(kpis?.claims_submitted_mtd ?? 0)} tone="warning" />
              <KpiCard icon={ShieldCheck} label={t("kpiClaimsSettled")} value={isLoading ? "…" : String(kpis?.claims_settled_mtd ?? 0)} tone="danger" />
            </div>
            <Card>
              <CardHeader><CardTitle>{t("revenueTrend")}</CardTitle></CardHeader>
              <CardContent><TrendChart data={revenueTrend} dataKey="amount" valueFormatter={money} /></CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="operations" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard icon={CalendarClock} label={t("kpiAppointmentsToday")} value={isLoading ? "…" : String(kpis?.appointments_today ?? 0)} tone="primary" />
            <KpiCard icon={BedDouble} label={t("kpiOccupancy")} value={isLoading ? "…" : `${kpis?.bed_occupancy_pct ?? 0}%`} tone="warning" />
            <KpiCard icon={FlaskConical} label={t("kpiLabToday")} value={isLoading ? "…" : String(kpis?.lab_tests_today ?? 0)} tone="success" />
            <KpiCard icon={ScanLine} label={t("kpiRadiologyToday")} value={isLoading ? "…" : String(kpis?.radiology_orders_today ?? 0)} tone="danger" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <KpiCard icon={Syringe} label={t("kpiPharmacyToday")} value={isLoading ? "…" : String(kpis?.pharmacy_dispensed_today ?? 0)} tone="primary" />
            <KpiCard icon={Activity} label={t("kpiSurgeriesMtd")} value={isLoading ? "…" : String(kpis?.surgeries_mtd ?? 0)} tone="success" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
