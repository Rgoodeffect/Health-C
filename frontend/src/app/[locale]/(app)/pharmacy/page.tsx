"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, PackageCheck, ShieldAlert, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePatients } from "@/lib/api/patients";
import { useDrugList, useBatches, useDispense, useExpiringBatches, useControlledDrugRegister, type DrugItem } from "@/lib/api/pharmacy";

export default function PharmacyPage() {
  const t = useTranslations("pharmacy");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <Tabs defaultValue="dispense">
        <TabsList>
          <TabsTrigger value="dispense">{t("tabDispense")}</TabsTrigger>
          <TabsTrigger value="inventory">{t("tabInventory")}</TabsTrigger>
          <TabsTrigger value="controlled">{t("tabControlled")}</TabsTrigger>
        </TabsList>
        <TabsContent value="dispense"><DispenseTab t={t} /></TabsContent>
        <TabsContent value="inventory"><InventoryTab t={t} /></TabsContent>
        <TabsContent value="controlled"><ControlledTab t={t} /></TabsContent>
      </Tabs>
    </div>
  );
}

function DispenseTab({ t }: { t: (key: string, values?: Record<string, string | number>) => string }) {
  const [search, setSearch] = React.useState("");
  const [patient, setPatient] = React.useState<{ name: string; patient_name: string } | null>(null);
  const [drugQuery, setDrugQuery] = React.useState("");
  const [drug, setDrug] = React.useState<DrugItem | null>(null);
  const [batch, setBatch] = React.useState("");
  const [quantity, setQuantity] = React.useState(1);
  const [witness, setWitness] = React.useState("");

  const { data: searchResults } = usePatients({ page: 1, page_size: 6, filters: search ? { patient_name: ["like", `%${search}%`] } : undefined });
  const { data: drugResults } = useDrugList(drugQuery);
  const { data: batches } = useBatches(drug?.item_code);
  const dispense = useDispense();

  function submit() {
    if (!patient || !drug) return;
    dispense.mutate(
      { patient: patient.name, drug: drug.item_code, quantity, batch: batch || undefined, witnessed_by: witness || undefined },
      {
        onSuccess: () => {
          toast.success(t("dispenseSuccess"));
          setDrug(null); setBatch(""); setQuantity(1); setWitness("");
        },
        onError: () => toast.error(t("dispenseError")),
      }
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><PackageCheck className="h-4 w-4" />{t("dispenseMedication")}</CardTitle></CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
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

        <div className="space-y-1.5">
          <Label>{t("drug")}</Label>
          <Popover open={drugQuery.length >= 2 && !drug}>
            <PopoverTrigger asChild>
              <Input placeholder={t("drugSearchPlaceholder")} value={drug ? drug.item_name : drugQuery} onChange={(e) => { setDrug(null); setDrugQuery(e.target.value); }} />
            </PopoverTrigger>
            <PopoverContent align="start" className="max-h-64 w-80 overflow-y-auto p-1">
              {(drugResults?.data ?? []).map((d) => (
                <button key={d.item_code} onClick={() => { setDrug(d); setDrugQuery(""); }} className="flex w-full flex-col rounded-[var(--radius-sm)] px-2 py-1.5 text-start text-sm hover:bg-muted">
                  <span className="font-medium">{d.item_name} {d.is_controlled_substance ? "🔒" : ""}</span>
                  <span className="text-xs text-muted-foreground">{d.item_code}</span>
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>

        {drug && (
          <div className="space-y-1.5">
            <Label>{t("batch")}</Label>
            <select value={batch} onChange={(e) => setBatch(e.target.value)} className="h-10 w-full rounded-[var(--radius-md)] border border-input bg-card px-3 text-sm">
              <option value="">{t("selectBatch")}</option>
              {batches?.data.map((b) => <option key={b.name} value={b.name}>{b.name} ({t("expires")}: {b.expiry_date})</option>)}
            </select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>{t("quantity")}</Label>
          <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
        </div>

        {drug?.is_controlled_substance === 1 && (
          <div className="space-y-1.5 sm:col-span-2">
            <div className="mb-2 flex items-center gap-2 rounded-[var(--radius-md)] border border-warning/40 bg-warning/5 p-2 text-sm text-warning">
              <ShieldAlert className="h-4 w-4" />
              {t("controlledWitnessRequired")}
            </div>
            <Label>{t("witness")}</Label>
            <Input placeholder={t("witnessPlaceholder")} value={witness} onChange={(e) => setWitness(e.target.value)} />
          </div>
        )}

        <Button className="sm:col-span-2" onClick={submit} disabled={!patient || !drug || dispense.isPending}>
          {dispense.isPending ? t("dispensing") : t("dispense")}
        </Button>
      </CardContent>
    </Card>
  );
}

function InventoryTab({ t }: { t: (key: string) => string }) {
  const { data } = useExpiringBatches(30);
  return (
    <Card className="border-warning/40">
      <CardHeader><CardTitle className="flex items-center gap-2 text-warning"><AlertTriangle className="h-4 w-4" />{t("expiringSoon")}</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>{t("batch")}</TableHead><TableHead>{t("drug")}</TableHead><TableHead>{t("expiryDate")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {(data?.data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">{t("noExpiring")}</TableCell></TableRow>
            )}
            {data?.data.map((b) => (
              <TableRow key={b.name}>
                <TableCell className="font-mono">{b.name}</TableCell>
                <TableCell>{b.item}</TableCell>
                <TableCell><Badge variant="warning">{b.expiry_date}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ControlledTab({ t }: { t: (key: string) => string }) {
  const { data } = useControlledDrugRegister();
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Warehouse className="h-4 w-4" />{t("controlledRegister")}</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("drug")}</TableHead>
              <TableHead>{t("schedule")}</TableHead>
              <TableHead>{t("quantity")}</TableHead>
              <TableHead>{t("balanceAfter")}</TableHead>
              <TableHead>{t("witness")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">{t("noControlledEntries")}</TableCell></TableRow>
            )}
            {data?.data.map((r) => (
              <TableRow key={r.name}>
                <TableCell>{r.drug}</TableCell>
                <TableCell>{r.schedule}</TableCell>
                <TableCell>{r.quantity_dispensed}</TableCell>
                <TableCell>{r.balance_after}</TableCell>
                <TableCell>{r.witnessed_by}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
