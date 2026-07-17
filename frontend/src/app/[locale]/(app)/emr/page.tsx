"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Mic, MicOff, Search, Stethoscope, AlertTriangle, CheckCircle2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePatients } from "@/lib/api/patients";
import {
  useCreateEncounter,
  useEncounters,
  useIcd10Search,
  useMedicalTimeline,
  useClinicalAlerts,
  useAcknowledgeAlert,
  useSubmitEncounter,
} from "@/lib/api/encounters";
import { useVoiceDictation } from "@/lib/use-voice-dictation";

export default function EmrPage() {
  const t = useTranslations("emr");
  const locale = useLocale();
  const [search, setSearch] = React.useState("");
  const [patient, setPatient] = React.useState<{ name: string; patient_name: string } | null>(null);

  const { data: searchResults } = usePatients({ page: 1, page_size: 6, filters: search ? { patient_name: ["like", `%${search}%`] } : undefined });
  const { data: encounters } = useEncounters(patient?.name);
  const { data: timeline } = useMedicalTimeline(patient?.name);
  const { data: alerts } = useClinicalAlerts(patient?.name);
  const acknowledgeAlert = useAcknowledgeAlert();
  const submitEncounter = useSubmitEncounter();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>{t("selectPatient")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-input bg-muted/40 px-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                  placeholder={t("searchPatient")}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPatient(null);
                  }}
                />
              </div>
              {search && !patient && (
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {searchResults?.data.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => setPatient({ name: p.name, patient_name: p.patient_name })}
                      className="flex w-full items-center justify-between rounded-[var(--radius-sm)] px-2 py-1.5 text-start text-sm hover:bg-muted"
                    >
                      <span>{p.patient_name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{p.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {patient && (
                <div className="rounded-[var(--radius-md)] border border-primary/30 bg-accent p-3 text-sm">
                  <p className="font-medium">{patient.patient_name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{patient.name}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {patient && alerts && alerts.data.length > 0 && (
            <Card className="border-danger/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-danger">
                  <AlertTriangle className="h-4 w-4" />
                  {t("clinicalAlerts")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {alerts.data.map((alert) => (
                  <div key={alert.name} className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger/5 p-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={alert.severity === "Critical" ? "danger" : "warning"}>{alert.severity}</Badge>
                      <button className="text-xs text-primary hover:underline" onClick={() => acknowledgeAlert.mutate(alert.name)}>
                        {t("acknowledge")}
                      </button>
                    </div>
                    <p className="mt-1">{alert.message}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {patient && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  {t("medicalTimeline")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(timeline?.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("noHistory")}</p>}
                {timeline?.data.map((event, i) => (
                  <div key={i} className="border-s-2 border-primary/30 ps-3 text-sm">
                    <p className="text-xs text-muted-foreground">{event.date}</p>
                    <p className="font-medium capitalize">{event.kind}</p>
                    <p className="text-muted-foreground">{event.label}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          {patient ? (
            <ConsultationForm patient={patient} encounters={encounters?.data ?? []} locale={locale} t={t} onSubmit={submitEncounter} />
          ) : (
            <Card>
              <CardContent className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                {t("selectPatientPrompt")}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ConsultationForm({
  patient,
  encounters,
  locale,
  t,
  onSubmit,
}: {
  patient: { name: string; patient_name: string };
  encounters: Array<{ name: string; encounter_date: string; chief_complaint: string | null; docstatus: number }>;
  locale: string;
  t: (key: string, values?: Record<string, string | number>) => string;
  onSubmit: ReturnType<typeof useSubmitEncounter>;
}) {
  const [practitioner, setPractitioner] = React.useState("");
  const [chiefComplaint, setChiefComplaint] = React.useState("");
  const [history, setHistory] = React.useState("");
  const [examination, setExamination] = React.useState("");
  const [diagnosisQuery, setDiagnosisQuery] = React.useState("");
  const [diagnosisCode, setDiagnosisCode] = React.useState<string | null>(null);
  const [treatmentPlan, setTreatmentPlan] = React.useState("");
  const [followUpDate, setFollowUpDate] = React.useState("");
  const [clinicalNotes, setClinicalNotes] = React.useState("");

  const createEncounter = useCreateEncounter();
  const { data: icd10Results } = useIcd10Search(diagnosisQuery);

  const notesDictation = useVoiceDictation(locale, (chunk) => setClinicalNotes((prev) => (prev ? `${prev} ${chunk}` : chunk)));
  const complaintDictation = useVoiceDictation(locale, (chunk) => setChiefComplaint((prev) => (prev ? `${prev} ${chunk}` : chunk)));

  function reset() {
    setChiefComplaint("");
    setHistory("");
    setExamination("");
    setDiagnosisCode(null);
    setDiagnosisQuery("");
    setTreatmentPlan("");
    setFollowUpDate("");
    setClinicalNotes("");
  }

  function save() {
    if (!practitioner) {
      toast.error(t("practitionerRequired"));
      return;
    }
    createEncounter.mutate(
      {
        patient: patient.name,
        practitioner,
        chief_complaint: chiefComplaint,
        history,
        examination,
        diagnosis_code: diagnosisCode ?? undefined,
        treatment_plan: treatmentPlan,
        follow_up_date: followUpDate || undefined,
        clinical_notes: clinicalNotes,
      },
      {
        onSuccess: () => {
          toast.success(t("saveSuccess"));
          reset();
        },
        onError: () => toast.error(t("saveError")),
      }
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            {t("newConsultation", { patient: patient.patient_name })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("practitioner")}</Label>
              <Input value={practitioner} onChange={(e) => setPractitioner(e.target.value)} placeholder={t("practitionerPlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("followUpDate")}</Label>
              <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{t("chiefComplaint")}</Label>
              <DictationButton dictation={complaintDictation} />
            </div>
            <Textarea rows={2} value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("history")}</Label>
              <Textarea rows={3} value={history} onChange={(e) => setHistory(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("examination")}</Label>
              <Textarea rows={3} value={examination} onChange={(e) => setExamination(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("diagnosis")}</Label>
            <Popover open={diagnosisQuery.length >= 2 && !diagnosisCode}>
              <PopoverTrigger asChild>
                <Input
                  placeholder={t("diagnosisPlaceholder")}
                  value={diagnosisCode ? diagnosisCode : diagnosisQuery}
                  onChange={(e) => {
                    setDiagnosisCode(null);
                    setDiagnosisQuery(e.target.value);
                  }}
                />
              </PopoverTrigger>
              <PopoverContent align="start" className="max-h-64 w-80 overflow-y-auto p-1">
                {(icd10Results?.data ?? []).map((code) => (
                  <button
                    key={code.code}
                    onClick={() => {
                      setDiagnosisCode(code.code);
                      setDiagnosisQuery("");
                    }}
                    className="flex w-full flex-col rounded-[var(--radius-sm)] px-2 py-1.5 text-start text-sm hover:bg-muted"
                  >
                    <span className="font-medium">{code.code} — {code.title}</span>
                    <span className="text-xs text-muted-foreground">{code.category}</span>
                  </button>
                ))}
                {icd10Results?.data.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">{t("noIcdMatches")}</p>}
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label>{t("treatmentPlan")}</Label>
            <Textarea rows={3} value={treatmentPlan} onChange={(e) => setTreatmentPlan(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{t("clinicalNotes")}</Label>
              <DictationButton dictation={notesDictation} />
            </div>
            <Textarea rows={4} value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} />
          </div>

          <Button onClick={save} disabled={createEncounter.isPending}>
            <CheckCircle2 className="h-4 w-4" />
            {createEncounter.isPending ? t("saving") : t("saveConsultation")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("pastConsultations")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {encounters.length === 0 && <p className="text-sm text-muted-foreground">{t("noPastConsultations")}</p>}
          {encounters.map((e) => (
            <div key={e.name} className="flex items-center justify-between rounded-[var(--radius-sm)] border border-border p-3 text-sm">
              <div>
                <p className="font-medium">{e.chief_complaint || t("noChiefComplaint")}</p>
                <p className="text-xs text-muted-foreground">{e.encounter_date}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={e.docstatus === 1 ? "success" : "muted"}>{e.docstatus === 1 ? t("signedOff") : t("draft")}</Badge>
                {e.docstatus === 0 && (
                  <Button size="sm" variant="outline" onClick={() => onSubmit.mutate(e.name)}>
                    {t("signOff")}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function DictationButton({ dictation }: { dictation: ReturnType<typeof useVoiceDictation> }) {
  if (!dictation.supported) return null;
  return (
    <Button type="button" size="sm" variant={dictation.listening ? "danger" : "outline"} onClick={dictation.toggle}>
      {dictation.listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
    </Button>
  );
}
