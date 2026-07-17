"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, Pill, Printer, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePatients } from "@/lib/api/patients";
import { useEncounters } from "@/lib/api/encounters";
import {
  useDrugSearch,
  useAllergyConflict,
  useDrugInteractions,
  usePrescribe,
  usePrescriptions,
  useRequestRefill,
  fetchPrintablePrescription,
  type DrugSearchResult,
} from "@/lib/api/prescriptions";

export default function PrescriptionsPage() {
  const t = useTranslations("prescriptions");
  const [search, setSearch] = React.useState("");
  const [patient, setPatient] = React.useState<{ name: string; patient_name: string } | null>(null);
  const [encounter, setEncounter] = React.useState<string>("");

  const { data: searchResults } = usePatients({ page: 1, page_size: 6, filters: search ? { patient_name: ["like", `%${search}%`] } : undefined });
  const { data: encounters } = useEncounters(patient?.name);
  const { data: prescriptions } = usePrescriptions(patient?.name);
  const requestRefill = useRequestRefill();

  const activeDrugCodes = (prescriptions?.data ?? []).filter((p) => p.status === "Active").map((p) => p.drug);

  async function printEncounter(enc: string) {
    const res = await fetchPrintablePrescription(enc);
    const data = res.data;
    const win = window.open("", "_blank", "width=700,height=900");
    if (!win) return;
    win.document.write(`
      <html><head><title>${t("printTitle")}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        .muted { color: #666; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: start; font-size: 13px; }
      </style></head><body>
      <h1>Health-C Medical Center — ${t("printTitle")}</h1>
      <p class="muted">${data.patient_name} (${data.patient_mrn}) · ${data.patient_age_sex} · ${data.encounter_date}</p>
      <p class="muted">${t("practitioner")}: ${data.practitioner_name || "—"} ${data.diagnosis ? `· ${t("diagnosis")}: ${data.diagnosis}` : ""}</p>
      <table><thead><tr><th>${t("drug")}</th><th>${t("dosage")}</th><th>${t("period")}</th><th>${t("notes")}</th></tr></thead>
      <tbody>${data.drugs
        .map((d) => `<tr><td>${d.drug_name}</td><td>${d.dosage || ""}</td><td>${d.period || ""}</td><td>${d.comment || ""}</td></tr>`)
        .join("")}</tbody></table>
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
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
                  setEncounter("");
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
              <div className="space-y-2">
                <div className="rounded-[var(--radius-md)] border border-primary/30 bg-accent p-3 text-sm">
                  <p className="font-medium">{patient.patient_name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{patient.name}</p>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("encounter")}</Label>
                  <Select value={encounter} onValueChange={setEncounter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectEncounter")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(encounters?.data ?? []).map((e) => (
                        <SelectItem key={e.name} value={e.name}>
                          {e.encounter_date} — {e.chief_complaint || t("noChiefComplaint")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          {patient && encounter ? (
            <PrescribeForm patient={patient.name} encounter={encounter} activeDrugCodes={activeDrugCodes} t={t} />
          ) : (
            <Card>
              <CardContent className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                {t("selectEncounterPrompt")}
              </CardContent>
            </Card>
          )}

          {patient && (
            <Card>
              <CardHeader>
                <CardTitle>{t("currentPrescriptions")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("drug")}</TableHead>
                      <TableHead>{t("dosage")}</TableHead>
                      <TableHead>{t("refills")}</TableHead>
                      <TableHead>{t("colStatus")}</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(prescriptions?.data ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          {t("noPrescriptions")}
                        </TableCell>
                      </TableRow>
                    )}
                    {prescriptions?.data.map((p) => (
                      <TableRow key={p.name}>
                        <TableCell>{p.drug_name}</TableCell>
                        <TableCell>{p.dosage} · {p.frequency}</TableCell>
                        <TableCell>{p.refills_used}/{p.refills_allowed}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === "Active" ? "success" : "muted"}>{p.status}</Badge>
                        </TableCell>
                        <TableCell className="flex gap-1">
                          {p.status === "Active" && (
                            <Button size="sm" variant="outline" onClick={() => requestRefill.mutate(p.name)}>
                              <RefreshCw className="h-3.5 w-3.5" />
                              {t("refill")}
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => printEncounter(p.original_encounter)}>
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function PrescribeForm({
  patient,
  encounter,
  activeDrugCodes,
  t,
}: {
  patient: string;
  encounter: string;
  activeDrugCodes: string[];
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const [drugQuery, setDrugQuery] = React.useState("");
  const [drug, setDrug] = React.useState<DrugSearchResult | null>(null);
  const [dosage, setDosage] = React.useState("");
  const [frequency, setFrequency] = React.useState("");
  const [duration, setDuration] = React.useState("");
  const [refills, setRefills] = React.useState(0);

  const { data: drugResults } = useDrugSearch(drugQuery);
  const { data: allergyCheck } = useAllergyConflict(patient, drug?.item_code);
  const { data: interactions } = useDrugInteractions(drug ? [...activeDrugCodes, drug.item_code] : []);
  const prescribe = usePrescribe();

  function reset() {
    setDrug(null);
    setDrugQuery("");
    setDosage("");
    setFrequency("");
    setDuration("");
    setRefills(0);
  }

  function submit() {
    if (!drug) return;
    prescribe.mutate(
      { encounter, drug: drug.item_code, dosage, frequency, duration, refills_allowed: refills },
      {
        onSuccess: () => {
          toast.success(t("prescribeSuccess"));
          reset();
        },
        onError: () => toast.error(t("prescribeError")),
      }
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pill className="h-4 w-4" />
          {t("newPrescription")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>{t("drug")}</Label>
          <Popover open={drugQuery.length >= 2 && !drug}>
            <PopoverTrigger asChild>
              <Input
                placeholder={t("drugSearchPlaceholder")}
                value={drug ? drug.item_name : drugQuery}
                onChange={(e) => {
                  setDrug(null);
                  setDrugQuery(e.target.value);
                }}
              />
            </PopoverTrigger>
            <PopoverContent align="start" className="max-h-64 w-80 overflow-y-auto p-1">
              {(drugResults?.data ?? []).map((d) => (
                <button
                  key={d.item_code}
                  onClick={() => {
                    setDrug(d);
                    setDrugQuery("");
                  }}
                  className="flex w-full flex-col rounded-[var(--radius-sm)] px-2 py-1.5 text-start text-sm hover:bg-muted"
                >
                  <span className="font-medium">{d.item_name}</span>
                  <span className="text-xs text-muted-foreground">{d.item_code} · {d.item_group}</span>
                </button>
              ))}
              {drugResults?.data.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">{t("noDrugMatches")}</p>}
            </PopoverContent>
          </Popover>
        </div>

        {allergyCheck?.data.conflict && (
          <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-danger/40 bg-danger/5 p-3 text-sm text-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">{t("allergyWarning")}</p>
              {allergyCheck.data.matches.map((m, i) => (
                <p key={i}>{m.allergen} — {m.reaction} ({m.severity})</p>
              ))}
            </div>
          </div>
        )}

        {interactions && interactions.data.length > 0 && (
          <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-warning/40 bg-warning/5 p-3 text-sm text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">{t("interactionWarning")}</p>
              {interactions.data.map((i) => (
                <p key={i.name}>{i.drug_a} + {i.drug_b}: {i.description} ({i.severity})</p>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>{t("dosage")}</Label>
            <Input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder={t("dosagePlaceholder")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("frequency")}</Label>
            <Input value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder={t("frequencyPlaceholder")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("duration")}</Label>
            <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder={t("durationPlaceholder")} />
          </div>
        </div>

        <div className="space-y-1.5 sm:w-40">
          <Label>{t("refillsAllowed")}</Label>
          <Input type="number" min={0} value={refills} onChange={(e) => setRefills(Number(e.target.value))} />
        </div>

        <Button onClick={submit} disabled={!drug || prescribe.isPending}>
          {prescribe.isPending ? t("prescribing") : t("addPrescription")}
        </Button>
      </CardContent>
    </Card>
  );
}
