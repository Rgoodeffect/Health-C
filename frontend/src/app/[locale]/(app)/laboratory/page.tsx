"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import Image from "next/image";
import { AlertTriangle, Barcode, CheckCircle2, FlaskConical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { usePatients } from "@/lib/api/patients";
import {
  useLabOrders, useCreateLabOrder, useCollectSample, useEnterResult, useVerifyResult,
  useCriticalResults, useQcRuns, useRecordQcRun, type LabOrder,
} from "@/lib/api/laboratory";

export default function LaboratoryPage() {
  const t = useTranslations("laboratory");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">{t("tabOrders")}</TabsTrigger>
          <TabsTrigger value="critical">{t("tabCritical")}</TabsTrigger>
          <TabsTrigger value="qc">{t("tabQc")}</TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          <OrdersTab t={t} />
        </TabsContent>
        <TabsContent value="critical">
          <CriticalTab t={t} />
        </TabsContent>
        <TabsContent value="qc">
          <QcTab t={t} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OrdersTab({ t }: { t: (key: string, values?: Record<string, string | number>) => string }) {
  const { data: orders, isLoading } = useLabOrders();
  const [search, setSearch] = React.useState("");
  const [patient, setPatient] = React.useState<{ name: string; patient_name: string } | null>(null);
  const [template, setTemplate] = React.useState("");
  const [practitioner, setPractitioner] = React.useState("");
  const { data: searchResults } = usePatients({ page: 1, page_size: 6, filters: search ? { patient_name: ["like", `%${search}%`] } : undefined });
  const createOrder = useCreateLabOrder();

  function submitOrder() {
    if (!patient || !template) return;
    createOrder.mutate(
      { patient: patient.name, template, practitioner: practitioner || undefined },
      {
        onSuccess: () => {
          toast.success(t("orderSuccess"));
          setPatient(null);
          setSearch("");
          setTemplate("");
          setPractitioner("");
        },
        onError: () => toast.error(t("orderError")),
      }
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {t("newOrder")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-1">
            <Label>{t("patient")}</Label>
            <Input
              placeholder={t("searchPatient")}
              value={patient ? patient.patient_name : search}
              onChange={(e) => {
                setPatient(null);
                setSearch(e.target.value);
              }}
            />
            {search && !patient && (
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-[var(--radius-sm)] border border-border">
                {searchResults?.data.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => setPatient({ name: p.name, patient_name: p.patient_name })}
                    className="flex w-full justify-between px-2 py-1 text-start text-sm hover:bg-muted"
                  >
                    <span>{p.patient_name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{p.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>{t("testTemplate")}</Label>
            <Input value={template} onChange={(e) => setTemplate(e.target.value)} placeholder={t("testTemplatePlaceholder")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("practitioner")}</Label>
            <Input value={practitioner} onChange={(e) => setPractitioner(e.target.value)} placeholder={t("practitionerPlaceholder")} />
          </div>
          <div className="sm:col-span-3">
            <Button onClick={submitOrder} disabled={!patient || !template || createOrder.isPending}>
              {createOrder.isPending ? t("ordering") : t("createOrder")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("orders")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("patient")}</TableHead>
                <TableHead>{t("testTemplate")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                <TableHead>{t("result")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={5}><div className="h-8 animate-pulse rounded bg-muted" /></TableCell></TableRow>
              )}
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

function OrderRow({ order, t }: { order: LabOrder; t: (key: string, values?: Record<string, string | number>) => string }) {
  const collectSample = useCollectSample();
  const enterResult = useEnterResult();
  const verifyResult = useVerifyResult();
  const [barcode, setBarcode] = React.useState<{ barcode: string; barcode_image: string | null } | null>(null);
  const [resultValue, setResultValue] = React.useState("");
  const [normalRange, setNormalRange] = React.useState("");
  const [isCritical, setIsCritical] = React.useState(false);
  const [criticalNotes, setCriticalNotes] = React.useState("");

  function collect() {
    collectSample.mutate(order.name, {
      onSuccess: (res) => {
        setBarcode(res.data.label);
        toast.success(t("sampleCollected"));
      },
      onError: () => toast.error(t("sampleCollectError")),
    });
  }

  function submitResult() {
    enterResult.mutate(
      { lab_test: order.name, result_value: resultValue, normal_range: normalRange, has_critical_result: isCritical ? 1 : 0, critical_result_notes: criticalNotes },
      { onSuccess: () => toast.success(t("resultSaved")), onError: () => toast.error(t("resultError")) }
    );
  }

  return (
    <TableRow>
      <TableCell>{order.patient_name}</TableCell>
      <TableCell>{order.template}</TableCell>
      <TableCell>
        <Badge variant={order.status === "Approved" ? "success" : order.has_critical_result ? "danger" : "muted"}>{order.status}</Badge>
      </TableCell>
      <TableCell>{order.result_value || "—"}</TableCell>
      <TableCell className="flex flex-wrap gap-1">
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" onClick={collect}>
              <Barcode className="h-3.5 w-3.5" />
              {t("collectSample")}
            </Button>
          </DialogTrigger>
          {barcode && (
            <DialogContent>
              <DialogHeader><DialogTitle>{t("sampleLabel")}</DialogTitle></DialogHeader>
              <div className="flex flex-col items-center gap-3 py-4">
                {barcode.barcode_image && <Image src={barcode.barcode_image} alt={barcode.barcode} width={280} height={100} />}
                <p className="font-mono text-lg">{barcode.barcode}</p>
                <Button variant="outline" onClick={() => window.print()}>{t("printLabel")}</Button>
              </div>
            </DialogContent>
          )}
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">{t("enterResult")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("enterResult")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{t("resultValue")}</Label>
                <Input value={resultValue} onChange={(e) => setResultValue(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("normalRange")}</Label>
                <Input value={normalRange} onChange={(e) => setNormalRange(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id={`critical-${order.name}`} checked={isCritical} onCheckedChange={(v) => setIsCritical(Boolean(v))} />
                <Label htmlFor={`critical-${order.name}`}>{t("markCritical")}</Label>
              </div>
              {isCritical && (
                <div className="space-y-1.5">
                  <Label>{t("criticalNotes")}</Label>
                  <Input value={criticalNotes} onChange={(e) => setCriticalNotes(e.target.value)} />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={submitResult} disabled={enterResult.isPending}>{t("saveResult")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {order.status !== "Approved" && (
          <Button size="sm" variant="ghost" onClick={() => verifyResult.mutate(order.name)}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("verify")}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function CriticalTab({ t }: { t: (key: string) => string }) {
  const { data, isLoading } = useCriticalResults();
  return (
    <Card className="border-danger/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-danger">
          <AlertTriangle className="h-4 w-4" />
          {t("criticalResults")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <div className="h-8 animate-pulse rounded bg-muted" />}
        {!isLoading && data?.data.length === 0 && <p className="text-sm text-muted-foreground">{t("noCritical")}</p>}
        {data?.data.map((r) => (
          <div key={r.name} className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger/5 p-3 text-sm">
            <p className="font-medium">{r.patient_name} — {r.template}</p>
            <p className="text-muted-foreground">{r.result_value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function QcTab({ t }: { t: (key: string) => string }) {
  const { data } = useQcRuns();
  const recordQc = useRecordQcRun();
  const [analyzer, setAnalyzer] = React.useState("");
  const [template, setTemplate] = React.useState("");
  const [level, setLevel] = React.useState("Normal");
  const [expected, setExpected] = React.useState("");
  const [measured, setMeasured] = React.useState("");

  function submit() {
    recordQc.mutate(
      { analyzer, test_template: template, control_level: level, expected_value: expected, measured_value: measured },
      {
        onSuccess: () => {
          toast.success(t("qcSaved"));
          setAnalyzer(""); setTemplate(""); setExpected(""); setMeasured("");
        },
      }
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FlaskConical className="h-4 w-4" />{t("newQcRun")}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Input placeholder={t("analyzer")} value={analyzer} onChange={(e) => setAnalyzer(e.target.value)} />
          <Input placeholder={t("testTemplate")} value={template} onChange={(e) => setTemplate(e.target.value)} />
          <Input placeholder={t("controlLevel")} value={level} onChange={(e) => setLevel(e.target.value)} />
          <Input placeholder={t("expectedValue")} value={expected} onChange={(e) => setExpected(e.target.value)} />
          <Input placeholder={t("measuredValue")} value={measured} onChange={(e) => setMeasured(e.target.value)} />
          <Button className="lg:col-span-5" onClick={submit} disabled={recordQc.isPending}>{t("recordQc")}</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t("qcHistory")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("analyzer")}</TableHead>
                <TableHead>{t("testTemplate")}</TableHead>
                <TableHead>{t("expectedValue")}</TableHead>
                <TableHead>{t("measuredValue")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.data ?? []).map((run) => (
                <TableRow key={run.name}>
                  <TableCell>{run.analyzer}</TableCell>
                  <TableCell>{run.test_template}</TableCell>
                  <TableCell>{run.expected_value}</TableCell>
                  <TableCell>{run.measured_value}</TableCell>
                  <TableCell><Badge variant={run.within_range ? "success" : "danger"}>{run.within_range ? t("withinRange") : t("outOfRange")}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
