"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, PhoneCall, Search, Wallet, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePatients } from "@/lib/api/patients";
import { useCallNext, useCheckIn, useQueue, useUpdateTokenStatus, useVerifyPayment, type QueueToken } from "@/lib/api/reception";
import { Link } from "@/i18n/navigation";

const STATUS_TONE: Record<QueueToken["status"], "muted" | "warning" | "success" | "danger"> = {
  Waiting: "muted",
  Called: "warning",
  "In Consultation": "warning",
  Completed: "success",
  "No Show": "danger",
};

export default function ReceptionPage() {
  const t = useTranslations("reception");
  const [search, setSearch] = React.useState("");
  const [selectedPatient, setSelectedPatient] = React.useState<{ name: string; patient_name: string } | null>(null);

  const { data: searchResults } = usePatients({ page: 1, page_size: 6, filters: search ? { patient_name: ["like", `%${search}%`] } : undefined });
  const { data: queueData, isLoading } = useQueue();
  const checkIn = useCheckIn();
  const callNext = useCallNext();
  const updateStatus = useUpdateTokenStatus();
  const verifyPayment = useVerifyPayment();

  function onCheckIn() {
    if (!selectedPatient) return;
    checkIn.mutate(
      { patient: selectedPatient.name },
      {
        onSuccess: () => {
          toast.success(t("checkInSuccess", { name: selectedPatient.patient_name }));
          setSelectedPatient(null);
          setSearch("");
        },
        onError: () => toast.error(t("checkInError")),
      }
    );
  }

  const queue = queueData?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => callNext.mutate({})}>
            <PhoneCall className="h-4 w-4" />
            {t("callNext")}
          </Button>
          <Link href="/reception-display" target="_blank">
            <Button variant="outline">
              <Monitor className="h-4 w-4" />
              {t("openDisplay")}
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{t("checkIn")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-input bg-muted/40 px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                placeholder={t("searchPatient")}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedPatient(null);
                }}
              />
            </div>
            {search && !selectedPatient && (
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {searchResults?.data.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => setSelectedPatient({ name: p.name, patient_name: p.patient_name })}
                    className="flex w-full items-center justify-between rounded-[var(--radius-sm)] px-2 py-1.5 text-start text-sm hover:bg-muted"
                  >
                    <span>{p.patient_name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{p.name}</span>
                  </button>
                ))}
                {searchResults?.data.length === 0 && (
                  <p className="px-2 py-1.5 text-sm text-muted-foreground">{t("noMatches")}</p>
                )}
              </div>
            )}
            {selectedPatient && (
              <div className="rounded-[var(--radius-md)] border border-primary/30 bg-accent p-3 text-sm">
                <p className="font-medium">{selectedPatient.patient_name}</p>
                <p className="font-mono text-xs text-muted-foreground">{selectedPatient.name}</p>
              </div>
            )}
            <Button className="w-full" disabled={!selectedPatient || checkIn.isPending} onClick={onCheckIn}>
              <CheckCircle2 className="h-4 w-4" />
              {checkIn.isPending ? t("checkingIn") : t("checkIn")}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("queue")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colToken")}</TableHead>
                  <TableHead>{t("colPatient")}</TableHead>
                  <TableHead>{t("colStatus")}</TableHead>
                  <TableHead>{t("colPayment")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="h-8 animate-pulse rounded bg-muted" />
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && queue.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      {t("emptyQueue")}
                    </TableCell>
                  </TableRow>
                )}
                {queue.map((token) => (
                  <TableRow key={token.name}>
                    <TableCell className="font-mono text-xs">{token.name}</TableCell>
                    <TableCell>{token.patient_name}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_TONE[token.status]}>{token.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={token.payment_status === "Verified" ? "success" : "warning"}>{token.payment_status}</Badge>
                    </TableCell>
                    <TableCell className="flex flex-wrap gap-1">
                      {token.payment_status !== "Verified" && (
                        <Button size="sm" variant="outline" onClick={() => verifyPayment.mutate({ name: token.name, payment_status: "Verified" })}>
                          <Wallet className="h-3.5 w-3.5" />
                          {t("verifyPayment")}
                        </Button>
                      )}
                      {token.status !== "Completed" && (
                        <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ name: token.name, status: "Completed" })}>
                          {t("complete")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
