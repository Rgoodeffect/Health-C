"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, FileWarning, Plus, ShieldCheck, XCircle } from "lucide-react";
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
  useInsuranceCompanies, useVerifyEligibility, usePreAuthorizations, useRequestPreAuthorization,
  useUpdatePreAuthorization, useClaims, useCreateClaim, useSubmitClaim, useRejectClaim,
  useRejections, useResubmitClaim, useSettleClaim, useSettlements, type InsuranceClaimItem,
} from "@/lib/api/insurance";

export default function InsurancePage() {
  const t = useTranslations("insurance");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <Tabs defaultValue="eligibility">
        <TabsList>
          <TabsTrigger value="eligibility">{t("tabEligibility")}</TabsTrigger>
          <TabsTrigger value="preauth">{t("tabPreAuth")}</TabsTrigger>
          <TabsTrigger value="claims">{t("tabClaims")}</TabsTrigger>
          <TabsTrigger value="settlements">{t("tabSettlements")}</TabsTrigger>
        </TabsList>
        <TabsContent value="eligibility"><EligibilityTab t={t} /></TabsContent>
        <TabsContent value="preauth"><PreAuthTab t={t} /></TabsContent>
        <TabsContent value="claims"><ClaimsTab t={t} /></TabsContent>
        <TabsContent value="settlements"><SettlementsTab t={t} /></TabsContent>
      </Tabs>
    </div>
  );
}

function PatientPicker({
  patient, setPatient, t,
}: {
  patient: { name: string; patient_name: string } | null;
  setPatient: (p: { name: string; patient_name: string } | null) => void;
  t: (key: string) => string;
}) {
  const [search, setSearch] = React.useState("");
  const { data } = usePatients({ page: 1, page_size: 6, filters: search ? { patient_name: ["like", `%${search}%`] } : undefined });
  return (
    <div className="space-y-1.5">
      <Label>{t("patient")}</Label>
      <Input placeholder={t("searchPatient")} value={patient ? patient.patient_name : search} onChange={(e) => { setPatient(null); setSearch(e.target.value); }} />
      {search && !patient && (
        <div className="max-h-32 space-y-1 overflow-y-auto rounded-[var(--radius-sm)] border border-border">
          {data?.data.map((p) => (
            <button key={p.name} onClick={() => setPatient({ name: p.name, patient_name: p.patient_name })} className="flex w-full justify-between px-2 py-1 text-start text-sm hover:bg-muted">
              <span>{p.patient_name}</span><span className="font-mono text-xs text-muted-foreground">{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EligibilityTab({ t }: { t: (key: string) => string }) {
  const [patient, setPatient] = React.useState<{ name: string; patient_name: string } | null>(null);
  const [company, setCompany] = React.useState("");
  const { data: companies } = useInsuranceCompanies();
  const verify = useVerifyEligibility();
  const [result, setResult] = React.useState<{ eligible: boolean } | null>(null);

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />{t("verifyEligibility")}</CardTitle></CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <PatientPicker patient={patient} setPatient={setPatient} t={t} />
        <div className="space-y-1.5">
          <Label>{t("insuranceCompany")}</Label>
          <select value={company} onChange={(e) => setCompany(e.target.value)} className="h-10 w-full rounded-[var(--radius-md)] border border-input bg-card px-3 text-sm">
            <option value="">{t("selectCompany")}</option>
            {companies?.data.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <Button
            disabled={!patient || !company || verify.isPending}
            onClick={() =>
              patient &&
              verify.mutate(
                { patient: patient.name, insurance_company: company },
                { onSuccess: (res) => setResult(res.data) }
              )
            }
          >
            {verify.isPending ? t("verifying") : t("verify")}
          </Button>
        </div>
        {result && (
          <div className={`sm:col-span-3 flex items-center gap-2 rounded-[var(--radius-md)] p-3 text-sm ${result.eligible ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
            {result.eligible ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {result.eligible ? t("eligibleMessage") : t("notEligibleMessage")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PreAuthTab({ t }: { t: (key: string) => string }) {
  const [patient, setPatient] = React.useState<{ name: string; patient_name: string } | null>(null);
  const [company, setCompany] = React.useState("");
  const [service, setService] = React.useState("");
  const [cost, setCost] = React.useState(0);
  const { data: companies } = useInsuranceCompanies();
  const { data: preAuths } = usePreAuthorizations();
  const requestAuth = useRequestPreAuthorization();
  const updateAuth = useUpdatePreAuthorization();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4" />{t("newPreAuth")}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <PatientPicker patient={patient} setPatient={setPatient} t={t} />
          <select value={company} onChange={(e) => setCompany(e.target.value)} className="h-10 rounded-[var(--radius-md)] border border-input bg-card px-3 text-sm">
            <option value="">{t("selectCompany")}</option>
            {companies?.data.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
          <Input placeholder={t("procedureService")} value={service} onChange={(e) => setService(e.target.value)} />
          <Input type="number" placeholder={t("estimatedCost")} value={cost} onChange={(e) => setCost(Number(e.target.value))} />
          <Button
            className="sm:col-span-4"
            disabled={!patient || !company || !service}
            onClick={() =>
              patient &&
              requestAuth.mutate(
                { patient: patient.name, insurance_company: company, procedure_or_service: service, estimated_cost: cost },
                { onSuccess: () => toast.success(t("preAuthRequested")) }
              )
            }
          >
            {t("requestPreAuth")}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t("preAuthList")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>{t("patient")}</TableHead><TableHead>{t("procedureService")}</TableHead><TableHead>{t("colStatus")}</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {(preAuths?.data ?? []).map((a) => (
                <TableRow key={a.name}>
                  <TableCell>{a.patient}</TableCell>
                  <TableCell>{a.procedure_or_service}</TableCell>
                  <TableCell><Badge variant={a.status === "Approved" ? "success" : a.status === "Denied" ? "danger" : "muted"}>{a.status}</Badge></TableCell>
                  <TableCell>
                    {a.status === "Requested" && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => updateAuth.mutate({ name: a.name, status: "Approved", auth_number: `AUTH-${a.name.slice(-4)}` })}>{t("approve")}</Button>
                        <Button size="sm" variant="ghost" onClick={() => updateAuth.mutate({ name: a.name, status: "Denied" })}>{t("deny")}</Button>
                      </div>
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

function ClaimsTab({ t }: { t: (key: string) => string }) {
  const [patient, setPatient] = React.useState<{ name: string; patient_name: string } | null>(null);
  const [company, setCompany] = React.useState("");
  const [amount, setAmount] = React.useState(0);
  const [coverageType, setCoverageType] = React.useState("Full Coverage");
  const { data: companies } = useInsuranceCompanies();
  const { data: claims } = useClaims();
  const createClaim = useCreateClaim();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4" />{t("newClaim")}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <PatientPicker patient={patient} setPatient={setPatient} t={t} />
          <select value={company} onChange={(e) => setCompany(e.target.value)} className="h-10 rounded-[var(--radius-md)] border border-input bg-card px-3 text-sm">
            <option value="">{t("selectCompany")}</option>
            {companies?.data.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
          <Input type="number" placeholder={t("claimAmount")} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          <select value={coverageType} onChange={(e) => setCoverageType(e.target.value)} className="h-10 rounded-[var(--radius-md)] border border-input bg-card px-3 text-sm">
            <option value="Full Coverage">{t("fullCoverage")}</option>
            <option value="Co-Payment">{t("coPayment")}</option>
            <option value="Deductible">{t("deductible")}</option>
          </select>
          <Button
            className="sm:col-span-4"
            disabled={!patient || !company || !amount}
            onClick={() =>
              patient &&
              createClaim.mutate(
                { patient: patient.name, insurance_company: company, claim_amount: amount, coverage_type: coverageType },
                { onSuccess: () => toast.success(t("claimCreated")) }
              )
            }
          >
            {t("createClaim")}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t("claims")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("patient")}</TableHead>
                <TableHead>{t("claimAmount")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(claims?.data ?? []).map((c) => <ClaimRow key={c.name} claim={c} t={t} />)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <RejectionsPanel t={t} />
    </div>
  );
}

function ClaimRow({ claim, t }: { claim: InsuranceClaimItem; t: (key: string) => string }) {
  const submitClaim = useSubmitClaim();
  const rejectClaim = useRejectClaim();
  const settleClaim = useSettleClaim();
  const [reason, setReason] = React.useState("");
  const [settledAmount, setSettledAmount] = React.useState(claim.claim_amount);

  return (
    <TableRow>
      <TableCell>{claim.patient}</TableCell>
      <TableCell>{claim.claim_amount}</TableCell>
      <TableCell><Badge variant={claim.status === "Settled" ? "success" : claim.status === "Rejected" ? "danger" : "muted"}>{claim.status}</Badge></TableCell>
      <TableCell className="flex flex-wrap gap-1">
        {claim.status === "Draft" && <Button size="sm" variant="outline" onClick={() => submitClaim.mutate(claim.name)}>{t("submit")}</Button>}
        {["Submitted", "Under Review"].includes(claim.status) && (
          <>
            <Dialog>
              <DialogTrigger asChild><Button size="sm" variant="ghost"><FileWarning className="h-3.5 w-3.5" />{t("reject")}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("rejectClaim")}</DialogTitle></DialogHeader>
                <Input placeholder={t("rejectionReason")} value={reason} onChange={(e) => setReason(e.target.value)} />
                <DialogFooter><Button onClick={() => rejectClaim.mutate({ claim: claim.name, reason })}>{t("confirmReject")}</Button></DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog>
              <DialogTrigger asChild><Button size="sm" variant="outline">{t("settle")}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("settleClaim")}</DialogTitle></DialogHeader>
                <Input type="number" value={settledAmount} onChange={(e) => setSettledAmount(Number(e.target.value))} />
                <DialogFooter><Button onClick={() => settleClaim.mutate({ claim: claim.name, settled_amount: settledAmount })}>{t("confirmSettle")}</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </TableCell>
    </TableRow>
  );
}

function RejectionsPanel({ t }: { t: (key: string) => string }) {
  const { data } = useRejections("Open");
  const resubmit = useResubmitClaim();
  if (!data?.data.length) return null;
  return (
    <Card className="border-warning/40">
      <CardHeader><CardTitle className="text-warning">{t("openRejections")}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {data.data.map((r) => (
          <div key={r.name} className="flex items-center justify-between rounded-[var(--radius-sm)] border border-warning/30 bg-warning/5 p-3 text-sm">
            <div>
              <p className="font-medium">{r.claim}</p>
              <p className="text-muted-foreground">{r.reason}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => resubmit.mutate(r.name)}>{t("resubmit")}</Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SettlementsTab({ t }: { t: (key: string) => string }) {
  const { data } = useSettlements();
  return (
    <Card>
      <CardHeader><CardTitle>{t("settlements")}</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>{t("claim")}</TableHead><TableHead>{t("settledAmount")}</TableHead><TableHead>{t("settlementDate")}</TableHead><TableHead>{t("colStatus")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {(data?.data ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">{t("noSettlements")}</TableCell></TableRow>}
            {data?.data.map((s) => (
              <TableRow key={s.name}>
                <TableCell>{s.claim}</TableCell>
                <TableCell>{s.settled_amount}</TableCell>
                <TableCell>{s.settlement_date}</TableCell>
                <TableCell><Badge variant="success">{s.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
