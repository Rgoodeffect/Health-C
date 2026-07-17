"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarPlus, FileUp, Receipt, ScanLine, Stethoscope, Pill, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useMyProfile, useMyAppointments, useBookAppointment, useCancelMyAppointment,
  useMyMedicalRecords, useMyPrescriptions, useMyLabResults, useMyRadiologyReports,
  useMyInvoices, useMyDocuments, useUploadMyDocument,
} from "@/lib/api/portal";

export default function PatientPortalPage() {
  const t = useTranslations("portal");
  const { data: profile } = useMyProfile();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title", { name: profile?.data.patient_name ?? "" })}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Tabs defaultValue="appointments">
        <TabsList>
          <TabsTrigger value="appointments">{t("tabAppointments")}</TabsTrigger>
          <TabsTrigger value="records">{t("tabRecords")}</TabsTrigger>
          <TabsTrigger value="prescriptions">{t("tabPrescriptions")}</TabsTrigger>
          <TabsTrigger value="lab">{t("tabLab")}</TabsTrigger>
          <TabsTrigger value="radiology">{t("tabRadiology")}</TabsTrigger>
          <TabsTrigger value="billing">{t("tabBilling")}</TabsTrigger>
          <TabsTrigger value="documents">{t("tabDocuments")}</TabsTrigger>
        </TabsList>

        <TabsContent value="appointments"><AppointmentsTab t={t} /></TabsContent>
        <TabsContent value="records"><RecordsTab t={t} /></TabsContent>
        <TabsContent value="prescriptions"><PrescriptionsTab t={t} /></TabsContent>
        <TabsContent value="lab"><LabTab t={t} /></TabsContent>
        <TabsContent value="radiology"><RadiologyTab t={t} /></TabsContent>
        <TabsContent value="billing"><BillingTab t={t} /></TabsContent>
        <TabsContent value="documents"><DocumentsTab t={t} patientId={profile?.data.name} /></TabsContent>
      </Tabs>
    </div>
  );
}

function AppointmentsTab({ t }: { t: (key: string, values?: Record<string, string | number>) => string }) {
  const { data } = useMyAppointments();
  const bookAppointment = useBookAppointment();
  const cancelAppointment = useCancelMyAppointment();
  const [practitioner, setPractitioner] = React.useState("");
  const [date, setDate] = React.useState("");
  const [time, setTime] = React.useState("");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CalendarPlus className="h-4 w-4" />{t("bookAppointment")}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5"><Label>{t("practitioner")}</Label><Input value={practitioner} onChange={(e) => setPractitioner(e.target.value)} placeholder={t("practitionerPlaceholder")} /></div>
          <div className="space-y-1.5"><Label>{t("date")}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>{t("time")}</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          <Button
            className="sm:col-span-3"
            disabled={!practitioner || !date || !time || bookAppointment.isPending}
            onClick={() =>
              bookAppointment.mutate(
                { practitioner, appointment_date: date, appointment_time: time },
                { onSuccess: () => { toast.success(t("bookSuccess")); setPractitioner(""); setDate(""); setTime(""); }, onError: () => toast.error(t("bookError")) }
              )
            }
          >
            {bookAppointment.isPending ? t("booking") : t("bookAppointment")}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t("myAppointments")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>{t("date")}</TableHead><TableHead>{t("practitioner")}</TableHead><TableHead>{t("colStatus")}</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {(data?.data ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">{t("noAppointments")}</TableCell></TableRow>}
              {data?.data.map((a) => (
                <TableRow key={a.name}>
                  <TableCell>{a.appointment_date} {a.appointment_time?.slice(0, 5)}</TableCell>
                  <TableCell>{a.practitioner}</TableCell>
                  <TableCell><Badge variant={a.status === "Cancelled" ? "danger" : "success"}>{a.status}</Badge></TableCell>
                  <TableCell>
                    {a.status !== "Cancelled" && (
                      <Button size="sm" variant="ghost" onClick={() => cancelAppointment.mutate(a.name)}>{t("cancel")}</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function RecordsTab({ t }: { t: (key: string) => string }) {
  const { data } = useMyMedicalRecords();
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Stethoscope className="h-4 w-4" />{t("medicalRecords")}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {(data?.data ?? []).length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{t("noRecords")}</p>}
        {data?.data.map((r) => (
          <div key={r.name} className="rounded-[var(--radius-md)] border border-border p-3 text-sm">
            <p className="text-xs text-muted-foreground">{r.encounter_date} · {r.practitioner}</p>
            <p className="mt-1 font-medium">{r.chief_complaint || "—"}</p>
            {r.treatment_plan && <p className="mt-1 text-muted-foreground">{r.treatment_plan}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PrescriptionsTab({ t }: { t: (key: string) => string }) {
  const { data } = useMyPrescriptions();
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Pill className="h-4 w-4" />{t("prescriptions")}</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>{t("drug")}</TableHead><TableHead>{t("dosage")}</TableHead><TableHead>{t("colStatus")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {(data?.data ?? []).length === 0 && <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">{t("noPrescriptions")}</TableCell></TableRow>}
            {data?.data.map((p) => (
              <TableRow key={p.name}>
                <TableCell>{p.drug_name}</TableCell>
                <TableCell>{p.dosage} · {p.frequency}</TableCell>
                <TableCell><Badge variant={p.status === "Active" ? "success" : "muted"}>{p.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function LabTab({ t }: { t: (key: string) => string }) {
  const { data } = useMyLabResults();
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><FlaskConical className="h-4 w-4" />{t("labResults")}</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>{t("test")}</TableHead><TableHead>{t("result")}</TableHead><TableHead>{t("normalRange")}</TableHead><TableHead>{t("date")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {(data?.data ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">{t("noLabResults")}</TableCell></TableRow>}
            {data?.data.map((r) => (
              <TableRow key={r.name}>
                <TableCell>{r.template}</TableCell>
                <TableCell>{r.result_value}</TableCell>
                <TableCell>{r.normal_range}</TableCell>
                <TableCell>{r.result_date}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RadiologyTab({ t }: { t: (key: string) => string }) {
  const { data } = useMyRadiologyReports();
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ScanLine className="h-4 w-4" />{t("radiologyReports")}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {(data?.data ?? []).length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{t("noRadiologyReports")}</p>}
        {data?.data.map((r) => (
          <div key={r.name} className="rounded-[var(--radius-md)] border border-border p-3 text-sm">
            <p className="text-xs text-muted-foreground">{r.reported_on}</p>
            <p className="mt-1 font-medium">{t("impression")}: {r.impression}</p>
            <p className="mt-1 text-muted-foreground">{r.findings}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function BillingTab({ t }: { t: (key: string) => string }) {
  const { data } = useMyInvoices();
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="h-4 w-4" />{t("invoices")}</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>{t("date")}</TableHead><TableHead>{t("total")}</TableHead><TableHead>{t("outstanding")}</TableHead><TableHead>{t("colStatus")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {(data?.data ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">{t("noInvoices")}</TableCell></TableRow>}
            {data?.data.map((inv) => (
              <TableRow key={inv.name}>
                <TableCell>{inv.posting_date}</TableCell>
                <TableCell>{inv.grand_total}</TableCell>
                <TableCell>{inv.outstanding_amount}</TableCell>
                <TableCell><Badge variant={inv.outstanding_amount > 0 ? "warning" : "success"}>{inv.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function DocumentsTab({ t, patientId }: { t: (key: string) => string; patientId: string | undefined }) {
  const { data } = useMyDocuments();
  const upload = useUploadMyDocument(patientId);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><FileUp className="h-4 w-4" />{t("documents")}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload.mutate(file, { onSuccess: () => toast.success(t("uploadSuccess")), onError: () => toast.error(t("uploadError")) });
              e.target.value = "";
            }}
          />
          <Button variant="outline" disabled={!patientId || upload.isPending} onClick={() => fileInputRef.current?.click()}>
            {upload.isPending ? t("uploading") : t("uploadDocument")}
          </Button>
        </div>
        <div className="space-y-2">
          {(data?.data ?? []).length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{t("noDocuments")}</p>}
          {data?.data.map((doc) => (
            <a key={doc.name} href={doc.file_url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-[var(--radius-sm)] border border-border p-3 text-sm hover:bg-muted">
              <span>{doc.file_name}</span>
              <span className="text-xs text-muted-foreground">{doc.creation}</span>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
