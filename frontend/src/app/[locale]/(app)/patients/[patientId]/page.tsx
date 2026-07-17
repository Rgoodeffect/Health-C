"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePatient360 } from "@/lib/api/patients";

const TABS = [
  "overview", "appointments", "consultations", "prescriptions", "lab",
  "radiology", "admissions", "surgery", "billing", "insurance", "documents",
] as const;

export default function PatientProfilePage() {
  const params = useParams<{ patientId: string }>();
  const t = useTranslations("patient360");
  const { data, isLoading } = usePatient360(params.patientId);

  if (isLoading || !data) {
    return <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-muted" />;
  }

  const p = data.data;
  const overview = p.overview;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
          <Avatar className="h-20 w-20">
            <AvatarImage src={overview.image ?? undefined} />
            <AvatarFallback className="text-lg">{overview.patient_name?.[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{overview.patient_name}</h1>
              <Badge variant={overview.status === "Active" ? "success" : "muted"}>{overview.status}</Badge>
            </div>
            <p className="font-mono text-xs text-muted-foreground">{t("mrn")}: {overview.mrn}</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span>{overview.sex}, {overview.age}</span>
              {overview.blood_group && <span>{t("bloodGroup")}: {overview.blood_group}</span>}
              <span>{overview.mobile}</span>
              {overview.national_id && <span>{t("nationalId")}: {overview.national_id}</span>}
            </div>
          </div>
          {overview.qr_code && (
            <div className="flex flex-col items-center gap-1">
              <Image src={overview.qr_code} alt="QR" width={72} height={72} className="rounded-[var(--radius-sm)] border border-border" />
              <span className="text-[11px] text-muted-foreground">{t("scanForRecord")}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {t(`tabs.${tab}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>{t("tabs.overview")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoRow label={t("email")} value={overview.email} />
              <InfoRow label={t("dob")} value={overview.dob} />
              <InfoRow label={t("passportNo")} value={overview.passport_no} />
              <InfoRow label={t("bloodGroup")} value={overview.blood_group} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments">
          <ListCard
            empty={t("noAppointments")}
            rows={p.appointments}
            columns={["appointment_date", "appointment_time", "practitioner", "department", "status"]}
            t={t}
          />
        </TabsContent>
        <TabsContent value="consultations">
          <ListCard
            empty={t("noConsultations")}
            rows={p.consultations}
            columns={["encounter_date", "practitioner", "diagnosis"]}
            t={t}
          />
        </TabsContent>
        <TabsContent value="prescriptions">
          <ListCard
            empty={t("noPrescriptions")}
            rows={p.prescriptions}
            columns={["drug_name", "dosage", "period", "comment"]}
            t={t}
          />
        </TabsContent>
        <TabsContent value="lab">
          <ListCard empty={t("noLabTests")} rows={p.lab} columns={["template", "status", "result_date"]} t={t} />
        </TabsContent>
        <TabsContent value="radiology">
          <ListCard empty={t("noRadiology")} rows={p.radiology} columns={["modality", "status", "order_date"]} t={t} />
        </TabsContent>
        <TabsContent value="admissions">
          <ListCard empty={t("noAdmissions")} rows={p.admissions} columns={["status", "scheduled_date", "expected_discharge"]} t={t} />
        </TabsContent>
        <TabsContent value="surgery">
          <ListCard empty={t("noSurgery")} rows={p.surgery} columns={["procedure", "status", "requested_date"]} t={t} />
        </TabsContent>
        <TabsContent value="billing">
          <ListCard empty={t("noBilling")} rows={p.billing} columns={["posting_date", "grand_total", "outstanding_amount", "status"]} t={t} />
        </TabsContent>
        <TabsContent value="insurance">
          <Card>
            <CardHeader>
              <CardTitle>{t("tabs.insurance")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoRow label={t("insuranceCompany")} value={p.insurance.primary_insurance_company as string} />
              <InfoRow label={t("policyNumber")} value={p.insurance.primary_policy_number as string} />
              <InfoRow label={t("coveragePlan")} value={p.insurance.coverage_plan as string} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="documents">
          <ListCard empty={t("noDocuments")} rows={p.documents} columns={["file_name", "file_size", "creation"]} t={t} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function ListCard({
  rows,
  columns,
  empty,
  t,
}: {
  rows: Array<Record<string, unknown>>;
  columns: string[];
  empty: string;
  t: (key: string) => string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col}>{t(`col.${col}`)}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col}>{String(row[col] ?? "—")}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
