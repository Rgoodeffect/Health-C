"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, ClipboardList, Plus, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { usePatients } from "@/lib/api/patients";
import {
  useSurgeryRequests, useCreateSurgeryRequest, useScheduleSurgery, useSavePreOpChecklist,
  useSaveAnesthesiaRecord, useSaveSurgeryNote, useAddImplant, useAdmitToRecovery,
  useRecoveryRoom, useDischargeFromRecovery, type SurgeryRequestItem,
} from "@/lib/api/surgery";

export default function SurgeryPage() {
  const t = useTranslations("surgery");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">{t("tabRequests")}</TabsTrigger>
          <TabsTrigger value="recovery">{t("tabRecovery")}</TabsTrigger>
        </TabsList>
        <TabsContent value="requests"><RequestsTab t={t} /></TabsContent>
        <TabsContent value="recovery"><RecoveryTab t={t} /></TabsContent>
      </Tabs>
    </div>
  );
}

function RequestsTab({ t }: { t: (key: string, values?: Record<string, string | number>) => string }) {
  const { data: requests, isLoading } = useSurgeryRequests();
  const [search, setSearch] = React.useState("");
  const [patient, setPatient] = React.useState<{ name: string; patient_name: string } | null>(null);
  const [procedure, setProcedure] = React.useState("");
  const [priority, setPriority] = React.useState("Elective");
  const { data: searchResults } = usePatients({ page: 1, page_size: 6, filters: search ? { patient_name: ["like", `%${search}%`] } : undefined });
  const createRequest = useCreateSurgeryRequest();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4" />{t("newRequest")}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
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
            <Label>{t("procedure")}</Label>
            <Input value={procedure} onChange={(e) => setProcedure(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("priority")}</Label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-10 w-full rounded-[var(--radius-md)] border border-input bg-card px-3 text-sm">
              <option value="Elective">{t("elective")}</option>
              <option value="Urgent">{t("urgent")}</option>
              <option value="Emergency">{t("emergency")}</option>
            </select>
          </div>
          <Button
            className="sm:col-span-4"
            disabled={!patient || !procedure || createRequest.isPending}
            onClick={() =>
              patient &&
              createRequest.mutate(
                { patient: patient.name, procedure, priority },
                { onSuccess: () => { toast.success(t("requestSuccess")); setPatient(null); setSearch(""); setProcedure(""); } }
              )
            }
          >
            {createRequest.isPending ? t("requesting") : t("requestSurgery")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("requests")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("patient")}</TableHead>
                <TableHead>{t("procedure")}</TableHead>
                <TableHead>{t("priority")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5}><div className="h-8 animate-pulse rounded bg-muted" /></TableCell></TableRow>}
              {!isLoading && requests?.data.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">{t("noRequests")}</TableCell></TableRow>
              )}
              {requests?.data.map((r) => <RequestRow key={r.name} request={r} t={t} />)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function RequestRow({ request, t }: { request: SurgeryRequestItem; t: (key: string, values?: Record<string, string | number>) => string }) {
  const schedule = useScheduleSurgery();
  const preOp = useSavePreOpChecklist();
  const anesthesia = useSaveAnesthesiaRecord();
  const surgeryNote = useSaveSurgeryNote();
  const addImplant = useAddImplant();
  const admitRecovery = useAdmitToRecovery();

  const [operatingRoom, setOperatingRoom] = React.useState("");
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");
  const [checklist, setChecklist] = React.useState({ consent_obtained: false, site_marked: false, npo_confirmed: false, allergies_reviewed: false, labs_reviewed: false, equipment_ready: false });
  const [anesthesiaType, setAnesthesiaType] = React.useState("General");
  const [procedurePerformed, setProcedurePerformed] = React.useState("");
  const [findings, setFindings] = React.useState("");
  const [implantName, setImplantName] = React.useState("");
  const [implantLot, setImplantLot] = React.useState("");

  return (
    <TableRow>
      <TableCell>{request.patient_name}</TableCell>
      <TableCell>{request.procedure}</TableCell>
      <TableCell><Badge variant={request.priority === "Emergency" ? "danger" : request.priority === "Urgent" ? "warning" : "muted"}>{request.priority}</Badge></TableCell>
      <TableCell><Badge variant={request.status === "Completed" ? "success" : "muted"}>{request.status}</Badge></TableCell>
      <TableCell>
        <Dialog>
          <DialogTrigger asChild><Button size="sm" variant="outline"><ClipboardList className="h-3.5 w-3.5" />{t("manage")}</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{request.patient_name} — {request.procedure}</DialogTitle></DialogHeader>
            <Tabs defaultValue="schedule">
              <TabsList>
                <TabsTrigger value="schedule">{t("schedule")}</TabsTrigger>
                <TabsTrigger value="preop">{t("preOp")}</TabsTrigger>
                <TabsTrigger value="anesthesia">{t("anesthesia")}</TabsTrigger>
                <TabsTrigger value="note">{t("surgeryNote")}</TabsTrigger>
                <TabsTrigger value="implants">{t("implants")}</TabsTrigger>
              </TabsList>

              <TabsContent value="schedule" className="space-y-3">
                <Input placeholder={t("operatingRoom")} value={operatingRoom} onChange={(e) => setOperatingRoom(e.target.value)} />
                <div className="grid grid-cols-2 gap-3">
                  <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
                  <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
                </div>
                <Button
                  disabled={!operatingRoom || !start || !end || schedule.isPending}
                  onClick={() =>
                    schedule.mutate(
                      { surgery_request: request.name, operating_room: operatingRoom, scheduled_start: start, scheduled_end: end },
                      { onSuccess: () => toast.success(t("scheduleSaved")), onError: () => toast.error(t("scheduleError")) }
                    )
                  }
                >
                  {t("saveSchedule")}
                </Button>
              </TabsContent>

              <TabsContent value="preop" className="space-y-2">
                {Object.entries(checklist).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={`${request.name}-${key}`}
                      checked={value}
                      onCheckedChange={(v) => setChecklist((prev) => ({ ...prev, [key]: Boolean(v) }))}
                    />
                    <Label htmlFor={`${request.name}-${key}`}>{t(`checklist.${key}`)}</Label>
                  </div>
                ))}
                <Button
                  onClick={() =>
                    preOp.mutate(
                      { surgery_request: request.name, ...checklist },
                      { onSuccess: () => toast.success(t("checklistSaved")) }
                    )
                  }
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {t("saveChecklist")}
                </Button>
              </TabsContent>

              <TabsContent value="anesthesia" className="space-y-3">
                <select value={anesthesiaType} onChange={(e) => setAnesthesiaType(e.target.value)} className="h-10 w-full rounded-[var(--radius-md)] border border-input bg-card px-3 text-sm">
                  <option value="General">{t("general")}</option>
                  <option value="Regional">{t("regional")}</option>
                  <option value="Local">{t("local")}</option>
                  <option value="Sedation">{t("sedation")}</option>
                </select>
                <Button
                  onClick={() =>
                    anesthesia.mutate(
                      { surgery_request: request.name, anesthesia_type: anesthesiaType },
                      { onSuccess: () => toast.success(t("anesthesiaSaved")) }
                    )
                  }
                >
                  {t("saveAnesthesia")}
                </Button>
              </TabsContent>

              <TabsContent value="note" className="space-y-3">
                <Textarea rows={3} placeholder={t("procedurePerformed")} value={procedurePerformed} onChange={(e) => setProcedurePerformed(e.target.value)} />
                <Textarea rows={2} placeholder={t("findings")} value={findings} onChange={(e) => setFindings(e.target.value)} />
                <div className="flex gap-2">
                  <Button
                    disabled={!procedurePerformed || surgeryNote.isPending}
                    onClick={() =>
                      surgeryNote.mutate(
                        { surgery_request: request.name, procedure_performed: procedurePerformed, findings },
                        { onSuccess: () => toast.success(t("noteSaved")) }
                      )
                    }
                  >
                    <Scissors className="h-4 w-4" />
                    {t("saveNote")}
                  </Button>
                  <Button variant="outline" onClick={() => admitRecovery.mutate(request.name, { onSuccess: () => toast.success(t("admittedToRecovery")) })}>
                    {t("admitToRecovery")}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="implants" className="space-y-3">
                <Input placeholder={t("implantName")} value={implantName} onChange={(e) => setImplantName(e.target.value)} />
                <Input placeholder={t("lotNumber")} value={implantLot} onChange={(e) => setImplantLot(e.target.value)} />
                <Button
                  disabled={!implantName}
                  onClick={() =>
                    addImplant.mutate(
                      { surgery_request: request.name, implant_name: implantName, lot_number: implantLot },
                      { onSuccess: () => { toast.success(t("implantAdded")); setImplantName(""); setImplantLot(""); } }
                    )
                  }
                >
                  {t("addImplant")}
                </Button>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </TableCell>
    </TableRow>
  );
}

function RecoveryTab({ t }: { t: (key: string) => string }) {
  const { data } = useRecoveryRoom();
  const discharge = useDischargeFromRecovery();

  return (
    <Card>
      <CardHeader><CardTitle>{t("recoveryRoom")}</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("patient")}</TableHead>
              <TableHead>{t("admittedTime")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">{t("noRecovery")}</TableCell></TableRow>
            )}
            {data?.data.map((r) => (
              <TableRow key={r.name}>
                <TableCell>{r.patient}</TableCell>
                <TableCell>{r.admitted_time}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => discharge.mutate({ name: r.name, vitals_stable: 1 })}>
                    {t("dischargeRecovery")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
