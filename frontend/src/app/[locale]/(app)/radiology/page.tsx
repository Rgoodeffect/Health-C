"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, FileText, Plus, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { usePatients } from "@/lib/api/patients";
import {
  useRadiologyOrders, useCreateRadiologyOrder, useScheduleRadiologyOrder, useCreateRadiologyReport,
  useModalities, useCreateModality, type RadiologyOrder,
} from "@/lib/api/radiology";

export default function RadiologyPage() {
  const t = useTranslations("radiology");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">{t("tabOrders")}</TabsTrigger>
          <TabsTrigger value="modalities">{t("tabModalities")}</TabsTrigger>
        </TabsList>
        <TabsContent value="orders"><OrdersTab t={t} /></TabsContent>
        <TabsContent value="modalities"><ModalitiesTab t={t} /></TabsContent>
      </Tabs>
    </div>
  );
}

function OrdersTab({ t }: { t: (key: string, values?: Record<string, string | number>) => string }) {
  const { data: orders, isLoading } = useRadiologyOrders();
  const { data: modalities } = useModalities();
  const [search, setSearch] = React.useState("");
  const [patient, setPatient] = React.useState<{ name: string; patient_name: string } | null>(null);
  const [modality, setModality] = React.useState("");
  const [bodyPart, setBodyPart] = React.useState("");
  const [priority, setPriority] = React.useState("Routine");
  const [indication, setIndication] = React.useState("");
  const { data: searchResults } = usePatients({ page: 1, page_size: 6, filters: search ? { patient_name: ["like", `%${search}%`] } : undefined });
  const createOrder = useCreateRadiologyOrder();

  function submit() {
    if (!patient || !modality) return;
    createOrder.mutate(
      { patient: patient.name, modality, body_part: bodyPart, priority, clinical_indication: indication },
      {
        onSuccess: () => {
          toast.success(t("orderSuccess"));
          setPatient(null); setSearch(""); setModality(""); setBodyPart(""); setIndication("");
        },
        onError: () => toast.error(t("orderError")),
      }
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4" />{t("newOrder")}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 lg:col-span-1">
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
          <div className="space-y-1.5">
            <Label>{t("modality")}</Label>
            <select value={modality} onChange={(e) => setModality(e.target.value)} className="h-10 w-full rounded-[var(--radius-md)] border border-input bg-card px-3 text-sm">
              <option value="">{t("selectModality")}</option>
              {modalities?.data.map((m) => <option key={m.modality_code} value={m.modality_code}>{m.modality_name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("bodyPart")}</Label>
            <Input value={bodyPart} onChange={(e) => setBodyPart(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("priority")}</Label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-10 w-full rounded-[var(--radius-md)] border border-input bg-card px-3 text-sm">
              <option value="Routine">{t("routine")}</option>
              <option value="Urgent">{t("urgent")}</option>
              <option value="STAT">{t("stat")}</option>
            </select>
          </div>
          <div className="space-y-1.5 lg:col-span-4">
            <Label>{t("clinicalIndication")}</Label>
            <Textarea rows={2} value={indication} onChange={(e) => setIndication(e.target.value)} />
          </div>
          <Button className="lg:col-span-4" onClick={submit} disabled={!patient || !modality || createOrder.isPending}>
            {createOrder.isPending ? t("ordering") : t("createOrder")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("orders")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("patient")}</TableHead>
                <TableHead>{t("modality")}</TableHead>
                <TableHead>{t("priority")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5}><div className="h-8 animate-pulse rounded bg-muted" /></TableCell></TableRow>}
              {!isLoading && orders?.data.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">{t("noOrders")}</TableCell></TableRow>
              )}
              {orders?.data.map((order) => <OrderRow key={order.name} order={order} t={t} />)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function OrderRow({ order, t }: { order: RadiologyOrder; t: (key: string, values?: Record<string, string | number>) => string }) {
  const schedule = useScheduleRadiologyOrder();
  const createReport = useCreateRadiologyReport();
  const [scheduledAt, setScheduledAt] = React.useState("");
  const [findings, setFindings] = React.useState("");
  const [impression, setImpression] = React.useState("");
  const [critical, setCritical] = React.useState(false);
  const [criticalNotes, setCriticalNotes] = React.useState("");

  return (
    <TableRow>
      <TableCell>{order.patient_name}</TableCell>
      <TableCell>{order.modality}{order.body_part ? ` · ${order.body_part}` : ""}</TableCell>
      <TableCell><Badge variant={order.priority === "STAT" ? "danger" : order.priority === "Urgent" ? "warning" : "muted"}>{order.priority}</Badge></TableCell>
      <TableCell>
        <Badge variant={order.status === "Completed" ? "success" : order.critical_finding ? "danger" : "muted"}>{order.status}</Badge>
        {order.critical_finding === 1 && <AlertTriangle className="ms-1 inline h-3.5 w-3.5 text-danger" />}
      </TableCell>
      <TableCell className="flex flex-wrap gap-1">
        <Dialog>
          <DialogTrigger asChild><Button size="sm" variant="outline"><CalendarClock className="h-3.5 w-3.5" />{t("schedule")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("scheduleImaging")}</DialogTitle></DialogHeader>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            <DialogFooter>
              <Button onClick={() => schedule.mutate({ name: order.name, scheduled_datetime: scheduledAt })} disabled={!scheduledAt || schedule.isPending}>
                {t("confirmSchedule")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild><Button size="sm" variant="outline"><FileText className="h-3.5 w-3.5" />{t("report")}</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{t("radiologyReport")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>{t("findings")}</Label><Textarea rows={3} value={findings} onChange={(e) => setFindings(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>{t("impression")}</Label><Textarea rows={2} value={impression} onChange={(e) => setImpression(e.target.value)} /></div>
              <div className="flex items-center gap-2">
                <Checkbox id={`crit-${order.name}`} checked={critical} onCheckedChange={(v) => setCritical(Boolean(v))} />
                <Label htmlFor={`crit-${order.name}`}>{t("markCriticalFinding")}</Label>
              </div>
              {critical && <Input placeholder={t("criticalNotes")} value={criticalNotes} onChange={(e) => setCriticalNotes(e.target.value)} />}
            </div>
            <DialogFooter>
              <Button
                onClick={() =>
                  createReport.mutate(
                    { radiology_order: order.name, findings, impression, critical_finding: critical ? 1 : 0, critical_finding_notes: criticalNotes },
                    { onSuccess: () => toast.success(t("reportSaved")), onError: () => toast.error(t("reportError")) }
                  )
                }
                disabled={createReport.isPending}
              >
                {t("finalizeReport")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TableCell>
    </TableRow>
  );
}

function ModalitiesTab({ t }: { t: (key: string) => string }) {
  const { data } = useModalities();
  const createModality = useCreateModality();
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ScanLine className="h-4 w-4" />{t("newModality")}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Input placeholder={t("modalityCode")} value={code} onChange={(e) => setCode(e.target.value)} />
          <Input placeholder={t("modalityName")} value={name} onChange={(e) => setName(e.target.value)} />
          <Button
            onClick={() =>
              createModality.mutate({ modality_code: code, modality_name: name }, { onSuccess: () => { setCode(""); setName(""); } })
            }
            disabled={!code || !name}
          >
            {t("addModality")}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t("modalities")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>{t("modalityCode")}</TableHead><TableHead>{t("modalityName")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {data?.data.map((m) => (
                <TableRow key={m.modality_code}><TableCell className="font-mono">{m.modality_code}</TableCell><TableCell>{m.modality_name}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
