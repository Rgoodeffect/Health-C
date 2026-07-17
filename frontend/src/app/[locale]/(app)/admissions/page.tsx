"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BedDouble, LogOut, Plus, Repeat, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { usePatients } from "@/lib/api/patients";
import {
  useAdmissions, useCreateAdmissionRequest, useOccupyBed, useRequestTransfer, useDischargePatient,
  useBedOccupancySummary, useServiceUnits, useNursingNotes, useAddNursingNote, type Admission,
} from "@/lib/api/admissions";

export default function AdmissionsPage() {
  const t = useTranslations("admissions");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <Tabs defaultValue="bedboard">
        <TabsList>
          <TabsTrigger value="bedboard">{t("tabBedBoard")}</TabsTrigger>
          <TabsTrigger value="admissions">{t("tabAdmissions")}</TabsTrigger>
          <TabsTrigger value="nursing">{t("tabNursing")}</TabsTrigger>
        </TabsList>
        <TabsContent value="bedboard"><BedBoardTab t={t} /></TabsContent>
        <TabsContent value="admissions"><AdmissionsTab t={t} /></TabsContent>
        <TabsContent value="nursing"><NursingTab t={t} /></TabsContent>
      </Tabs>
    </div>
  );
}

function BedBoardTab({ t }: { t: (key: string) => string }) {
  const { data } = useBedOccupancySummary();
  const wards = data?.data ?? [];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {wards.length === 0 && (
        <Card className="sm:col-span-2 lg:col-span-4">
          <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">{t("noWards")}</CardContent>
        </Card>
      )}
      {wards.map((w) => {
        const vacant = w.total - w.occupied;
        const pct = w.total ? Math.round((w.occupied / w.total) * 100) : 0;
        return (
          <Card key={w.ward}>
            <CardHeader><CardTitle className="flex items-center gap-2"><BedDouble className="h-4 w-4" />{w.ward}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{w.occupied}<span className="text-base text-muted-foreground">/{w.total}</span></p>
              <p className="text-xs text-muted-foreground">{t("occupied")} · {vacant} {t("vacant")}</p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function AdmissionsTab({ t }: { t: (key: string, values?: Record<string, string | number>) => string }) {
  const { data: admissions, isLoading } = useAdmissions();
  const [search, setSearch] = React.useState("");
  const [patient, setPatient] = React.useState<{ name: string; patient_name: string } | null>(null);
  const [reason, setReason] = React.useState("");
  const { data: searchResults } = usePatients({ page: 1, page_size: 6, filters: search ? { patient_name: ["like", `%${search}%`] } : undefined });
  const createRequest = useCreateAdmissionRequest();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4" />{t("newAdmission")}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>{t("patient")}</Label>
            <Input placeholder={t("searchPatient")} value={patient ? patient.patient_name : search} onChange={(e) => { setPatient(null); setSearch(e.target.value); }} />
            {search && !patient && (
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-[var(--radius-sm)] border border-border">
                {searchResults?.data.map((p) => (
                  <button key={p.name} onClick={() => setPatient({ name: p.name, patient_name: p.patient_name })} className="flex w-full justify-between px-2 py-1 text-start text-sm hover:bg-muted">
                    <span>{p.patient_name}</span><span className="font-mono text-xs text-muted-foreground">{p.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("admissionReason")}</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button
            className="sm:col-span-3"
            disabled={!patient || createRequest.isPending}
            onClick={() =>
              patient &&
              createRequest.mutate(
                { patient: patient.name, admission_reason: reason },
                { onSuccess: () => { toast.success(t("admissionSuccess")); setPatient(null); setSearch(""); setReason(""); } }
              )
            }
          >
            {createRequest.isPending ? t("requesting") : t("requestAdmission")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("currentAdmissions")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("patient")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                <TableHead>{t("bed")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={4}><div className="h-8 animate-pulse rounded bg-muted" /></TableCell></TableRow>}
              {!isLoading && admissions?.data.length === 0 && (
                <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">{t("noAdmissions")}</TableCell></TableRow>
              )}
              {admissions?.data.map((a) => <AdmissionRow key={a.name} admission={a} t={t} />)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AdmissionRow({ admission, t }: { admission: Admission; t: (key: string) => string }) {
  const { data: beds } = useServiceUnits(true);
  const occupyBed = useOccupyBed();
  const requestTransfer = useRequestTransfer();
  const dischargePatient = useDischargePatient();
  const [selectedBed, setSelectedBed] = React.useState("");
  const [transferBed, setTransferBed] = React.useState("");
  const [dischargeNotes, setDischargeNotes] = React.useState("");

  return (
    <TableRow>
      <TableCell>{admission.patient_name}</TableCell>
      <TableCell><Badge variant={admission.status === "Discharged" ? "muted" : "success"}>{admission.status}</Badge></TableCell>
      <TableCell className="font-mono text-xs">{admission.service_unit || "—"}</TableCell>
      <TableCell className="flex flex-wrap gap-1">
        {!admission.service_unit && admission.status !== "Discharged" && (
          <Dialog>
            <DialogTrigger asChild><Button size="sm" variant="outline"><BedDouble className="h-3.5 w-3.5" />{t("assignBed")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("assignBed")}</DialogTitle></DialogHeader>
              <select value={selectedBed} onChange={(e) => setSelectedBed(e.target.value)} className="h-10 w-full rounded-[var(--radius-md)] border border-input bg-card px-3 text-sm">
                <option value="">{t("selectBed")}</option>
                {beds?.data.map((b) => <option key={b.name} value={b.name}>{b.healthcare_service_unit_name}</option>)}
              </select>
              <DialogFooter>
                <Button disabled={!selectedBed} onClick={() => occupyBed.mutate({ inpatient_record: admission.name, service_unit: selectedBed })}>
                  {t("confirmAssign")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        {admission.service_unit && admission.status !== "Discharged" && (
          <Dialog>
            <DialogTrigger asChild><Button size="sm" variant="outline"><Repeat className="h-3.5 w-3.5" />{t("transfer")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("requestTransfer")}</DialogTitle></DialogHeader>
              <select value={transferBed} onChange={(e) => setTransferBed(e.target.value)} className="h-10 w-full rounded-[var(--radius-md)] border border-input bg-card px-3 text-sm">
                <option value="">{t("selectBed")}</option>
                {beds?.data.map((b) => <option key={b.name} value={b.name}>{b.healthcare_service_unit_name}</option>)}
              </select>
              <DialogFooter>
                <Button disabled={!transferBed} onClick={() => requestTransfer.mutate({ inpatient_record: admission.name, to_service_unit: transferBed })}>
                  {t("confirmTransfer")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        {admission.status !== "Discharged" && (
          <Dialog>
            <DialogTrigger asChild><Button size="sm" variant="ghost"><LogOut className="h-3.5 w-3.5" />{t("discharge")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("dischargePatient")}</DialogTitle></DialogHeader>
              <Textarea rows={3} placeholder={t("dischargeNotes")} value={dischargeNotes} onChange={(e) => setDischargeNotes(e.target.value)} />
              <DialogFooter>
                <Button onClick={() => dischargePatient.mutate({ inpatient_record: admission.name, discharge_notes: dischargeNotes })}>
                  {t("confirmDischarge")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </TableCell>
    </TableRow>
  );
}

function NursingTab({ t }: { t: (key: string) => string }) {
  const [search, setSearch] = React.useState("");
  const [patient, setPatient] = React.useState<{ name: string; patient_name: string } | null>(null);
  const [note, setNote] = React.useState("");
  const [shift, setShift] = React.useState("Morning");
  const { data: searchResults } = usePatients({ page: 1, page_size: 6, filters: search ? { patient_name: ["like", `%${search}%`] } : undefined });
  const { data: notes } = useNursingNotes(patient?.name);
  const addNote = useAddNursingNote();

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader><CardTitle>{t("selectPatient")}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder={t("searchPatient")} value={patient ? patient.patient_name : search} onChange={(e) => { setPatient(null); setSearch(e.target.value); }} />
          {search && !patient && (
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {searchResults?.data.map((p) => (
                <button key={p.name} onClick={() => setPatient({ name: p.name, patient_name: p.patient_name })} className="flex w-full justify-between rounded-[var(--radius-sm)] px-2 py-1.5 text-start text-sm hover:bg-muted">
                  <span>{p.patient_name}</span><span className="font-mono text-xs text-muted-foreground">{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <div className="lg:col-span-2 space-y-6">
        {patient ? (
          <>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Stethoscope className="h-4 w-4" />{t("addNote")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <select value={shift} onChange={(e) => setShift(e.target.value)} className="h-10 w-full rounded-[var(--radius-md)] border border-input bg-card px-3 text-sm sm:w-48">
                  <option value="Morning">{t("morning")}</option>
                  <option value="Evening">{t("evening")}</option>
                  <option value="Night">{t("night")}</option>
                </select>
                <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
                <Button
                  disabled={!note || addNote.isPending}
                  onClick={() => addNote.mutate({ patient: patient.name, note, shift }, { onSuccess: () => setNote("") })}
                >
                  {t("saveNote")}
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>{t("notesHistory")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(notes?.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("noNotes")}</p>}
                {notes?.data.map((n) => (
                  <div key={n.name} className="rounded-[var(--radius-sm)] border border-border p-3 text-sm">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{n.shift}</span><span>{n.recorded_on}</span>
                    </div>
                    <p className="mt-1">{n.note}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card><CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">{t("selectPatientPrompt")}</CardContent></Card>
        )}
      </div>
    </div>
  );
}
