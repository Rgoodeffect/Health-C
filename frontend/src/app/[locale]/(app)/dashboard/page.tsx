"use client";

import { useTranslations } from "next-intl";
import { Users, CalendarClock, Activity, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWhoAmI } from "@/lib/api/auth";
import { usePatients } from "@/lib/api/patients";
import { navItemsForRoles } from "@/lib/constants/nav";
import { Link } from "@/i18n/navigation";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tNav = useTranslations("nav");
  const { data: me } = useWhoAmI();
  const roles = me?.data.roles ?? [];
  const { data: patients, isLoading } = usePatients({ page: 1, page_size: 1 });

  const shortcuts = navItemsForRoles(roles).filter((i) => i.key !== "dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("greeting", { name: me?.data.full_name?.split(" ")[0] ?? "" })}
        </h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Users}
          label={t("kpiTotalPatients")}
          value={isLoading ? "…" : String(patients?.meta?.total ?? 0)}
          tone="primary"
        />
        <KpiCard icon={CalendarClock} label={t("kpiTodayAppointments")} value="—" tone="success" hint={t("kpiComingSoon")} />
        <KpiCard icon={Activity} label={t("kpiOccupancy")} value="—" tone="warning" hint={t("kpiComingSoon")} />
        <KpiCard icon={TrendingUp} label={t("kpiRevenue")} value="—" tone="danger" hint={t("kpiComingSoon")} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("quickAccess")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border p-4 transition-colors hover:border-primary hover:bg-accent"
            >
              <item.icon className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">{tNav(item.key)}</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone: "primary" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-danger/10 text-danger",
  }[tone];

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold leading-none">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
