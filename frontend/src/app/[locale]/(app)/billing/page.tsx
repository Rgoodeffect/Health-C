"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Banknote, CreditCard, Plus, Receipt, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { usePatients } from "@/lib/api/patients";
import {
  useInvoices, useCreateInvoice, useRecordPayment, useRecordDeposit, useRecordRefund,
  useTodaysClosing, useSubmitCashClosing, useCashClosings, type Invoice,
} from "@/lib/api/billing";

const PAYMENT_MODES = ["Cash", "Card", "Bank Transfer", "Mobile Payment"];

export default function BillingPage() {
  const t = useTranslations("billing");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">{t("tabInvoices")}</TabsTrigger>
          <TabsTrigger value="deposits">{t("tabDeposits")}</TabsTrigger>
          <TabsTrigger value="cashclosing">{t("tabCashClosing")}</TabsTrigger>
        </TabsList>
        <TabsContent value="invoices"><InvoicesTab t={t} /></TabsContent>
        <TabsContent value="deposits"><DepositsTab t={t} /></TabsContent>
        <TabsContent value="cashclosing"><CashClosingTab t={t} /></TabsContent>
      </Tabs>
    </div>
  );
}

function InvoicesTab({ t }: { t: (key: string, values?: Record<string, string | number>) => string }) {
  const [search, setSearch] = React.useState("");
  const [patient, setPatient] = React.useState<{ name: string; patient_name: string } | null>(null);
  const [itemCode, setItemCode] = React.useState("");
  const [qty, setQty] = React.useState(1);
  const [rate, setRate] = React.useState(0);
  const [mode, setMode] = React.useState("Cash");

  const { data: searchResults } = usePatients({ page: 1, page_size: 6, filters: search ? { patient_name: ["like", `%${search}%`] } : undefined });
  const { data: invoices, isLoading } = useInvoices(patient?.name);
  const createInvoice = useCreateInvoice();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4" />{t("newInvoice")}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5 lg:col-span-2">
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
          <Input placeholder={t("itemCode")} value={itemCode} onChange={(e) => setItemCode(e.target.value)} />
          <Input type="number" placeholder={t("qty")} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          <Input type="number" placeholder={t("rate")} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="h-10 rounded-[var(--radius-md)] border border-input bg-card px-3 text-sm lg:col-span-1">
            {PAYMENT_MODES.map((m) => <option key={m} value={m}>{t(`mode.${m}`)}</option>)}
          </select>
          <Button
            className="lg:col-span-5"
            disabled={!patient || !itemCode || createInvoice.isPending}
            onClick={() =>
              patient &&
              createInvoice.mutate(
                { patient: patient.name, items: [{ item_code: itemCode, qty, rate }], mode_of_payment: mode, pay_immediately: true },
                { onSuccess: () => { toast.success(t("invoiceSuccess")); setItemCode(""); setQty(1); setRate(0); }, onError: () => toast.error(t("invoiceError")) }
              )
            }
          >
            {createInvoice.isPending ? t("creating") : t("createAndPay")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("invoices")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("invoiceId")}</TableHead>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("total")}</TableHead>
                <TableHead>{t("outstanding")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6}><div className="h-8 animate-pulse rounded bg-muted" /></TableCell></TableRow>}
              {!isLoading && invoices?.data.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{t("noInvoices")}</TableCell></TableRow>
              )}
              {invoices?.data.map((inv) => <InvoiceRow key={inv.name} invoice={inv} t={t} />)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function InvoiceRow({ invoice, t }: { invoice: Invoice; t: (key: string) => string }) {
  const recordPayment = useRecordPayment();
  const [amount, setAmount] = React.useState(invoice.outstanding_amount);
  const [mode, setMode] = React.useState("Cash");

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{invoice.name}</TableCell>
      <TableCell>{invoice.posting_date}</TableCell>
      <TableCell>{invoice.grand_total.toFixed(2)}</TableCell>
      <TableCell>{invoice.outstanding_amount.toFixed(2)}</TableCell>
      <TableCell><Badge variant={invoice.outstanding_amount > 0 ? "warning" : "success"}>{invoice.status}</Badge></TableCell>
      <TableCell>
        {invoice.outstanding_amount > 0 && (
          <Dialog>
            <DialogTrigger asChild><Button size="sm" variant="outline"><Receipt className="h-3.5 w-3.5" />{t("recordPayment")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("recordPayment")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
                <select value={mode} onChange={(e) => setMode(e.target.value)} className="h-10 w-full rounded-[var(--radius-md)] border border-input bg-card px-3 text-sm">
                  {PAYMENT_MODES.map((m) => <option key={m} value={m}>{t(`mode.${m}`)}</option>)}
                </select>
              </div>
              <DialogFooter>
                <Button
                  onClick={() =>
                    recordPayment.mutate(
                      { invoice: invoice.name, mode_of_payment: mode, amount },
                      { onSuccess: () => toast.success(t("paymentRecorded")) }
                    )
                  }
                >
                  {t("confirmPayment")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </TableCell>
    </TableRow>
  );
}

function DepositsTab({ t }: { t: (key: string) => string }) {
  const [search, setSearch] = React.useState("");
  const [patient, setPatient] = React.useState<{ name: string; patient_name: string } | null>(null);
  const [amount, setAmount] = React.useState(0);
  const [mode, setMode] = React.useState("Cash");
  const [paymentEntry, setPaymentEntry] = React.useState("");
  const [refundAmount, setRefundAmount] = React.useState(0);
  const [refundReason, setRefundReason] = React.useState("");

  const { data: searchResults } = usePatients({ page: 1, page_size: 6, filters: search ? { patient_name: ["like", `%${search}%`] } : undefined });
  const recordDeposit = useRecordDeposit();
  const recordRefund = useRecordRefund();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Banknote className="h-4 w-4" />{t("recordDeposit")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
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
          <Input type="number" placeholder={t("amount")} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="h-10 w-full rounded-[var(--radius-md)] border border-input bg-card px-3 text-sm">
            {PAYMENT_MODES.map((m) => <option key={m} value={m}>{t(`mode.${m}`)}</option>)}
          </select>
          <Button
            disabled={!patient || !amount}
            onClick={() => patient && recordDeposit.mutate({ patient: patient.name, amount, mode_of_payment: mode }, { onSuccess: () => toast.success(t("depositSuccess")) })}
          >
            {t("recordDeposit")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><RotateCcw className="h-4 w-4" />{t("processRefund")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder={t("paymentEntryId")} value={paymentEntry} onChange={(e) => setPaymentEntry(e.target.value)} />
          <Input type="number" placeholder={t("amount")} value={refundAmount} onChange={(e) => setRefundAmount(Number(e.target.value))} />
          <Input placeholder={t("refundReason")} value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
          <Button
            disabled={!paymentEntry || !refundAmount}
            onClick={() => recordRefund.mutate({ payment_entry: paymentEntry, amount: refundAmount, reason: refundReason }, { onSuccess: () => toast.success(t("refundSuccess")) })}
          >
            {t("processRefund")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function CashClosingTab({ t }: { t: (key: string) => string }) {
  const { data: today } = useTodaysClosing();
  const { data: history } = useCashClosings();
  const submitClosing = useSubmitCashClosing();
  const [opening, setOpening] = React.useState(0);
  const [actual, setActual] = React.useState(0);
  const [notes, setNotes] = React.useState("");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4" />{t("todaysClosing")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {today?.data && (
            <div className="rounded-[var(--radius-md)] bg-muted/50 p-3 text-sm">
              <p>{t("totalCollected")}: <span className="font-semibold">{today.data.total_collected}</span></p>
            </div>
          )}
          <div className="space-y-1.5"><Label>{t("openingBalance")}</Label><Input type="number" value={opening} onChange={(e) => setOpening(Number(e.target.value))} /></div>
          <div className="space-y-1.5"><Label>{t("actualCashCounted")}</Label><Input type="number" value={actual} onChange={(e) => setActual(Number(e.target.value))} /></div>
          <div className="space-y-1.5"><Label>{t("notes")}</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <Button onClick={() => submitClosing.mutate({ opening_balance: opening, actual_cash_balance: actual, notes }, { onSuccess: () => toast.success(t("closingSaved")) })}>
            {t("closeDrawer")}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t("closingHistory")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>{t("date")}</TableHead><TableHead>{t("total")}</TableHead><TableHead>{t("variance")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {(history?.data ?? []).map((c) => (
                <TableRow key={c.name}>
                  <TableCell>{c.closing_date}</TableCell>
                  <TableCell>{c.total_collected}</TableCell>
                  <TableCell><Badge variant={c.variance === 0 ? "success" : "warning"}>{c.variance}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
