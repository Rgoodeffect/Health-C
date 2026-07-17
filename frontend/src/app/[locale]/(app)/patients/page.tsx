"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, QrCode, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePatients, useCreatePatient } from "@/lib/api/patients";
import { Link } from "@/i18n/navigation";

const patientSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  sex: z.string().min(1),
  dob: z.string().min(1),
  mobile: z.string().min(6),
  email: z.string().email().optional().or(z.literal("")),
  national_id: z.string().optional(),
  passport_no: z.string().optional(),
});

type PatientFormValues = z.infer<typeof patientSchema>;

export default function PatientsPage() {
  const t = useTranslations("patients");
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [page, setPage] = React.useState(1);

  const { data, isLoading } = usePatients({
    page,
    page_size: 20,
    filters: search ? { patient_name: ["like", `%${search}%`] } : undefined,
  });
  const createPatient = useCreatePatient();

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: { first_name: "", last_name: "", sex: "", dob: "", mobile: "", email: "" },
  });

  function onSubmit(values: PatientFormValues) {
    createPatient.mutate(
      { ...values, email: values.email || undefined },
      {
        onSuccess: () => {
          toast.success(t("registerSuccess"));
          setOpen(false);
          form.reset();
        },
        onError: () => toast.error(t("registerError")),
      }
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              {t("register")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("registerTitle")}</DialogTitle>
              <DialogDescription>{t("registerDescription")}</DialogDescription>
            </DialogHeader>
            <form className="grid grid-cols-2 gap-4" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="col-span-1 space-y-1.5">
                <Label>{t("firstName")}</Label>
                <Input {...form.register("first_name")} />
              </div>
              <div className="col-span-1 space-y-1.5">
                <Label>{t("lastName")}</Label>
                <Input {...form.register("last_name")} />
              </div>
              <div className="col-span-1 space-y-1.5">
                <Label>{t("sex")}</Label>
                <Select onValueChange={(v) => form.setValue("sex", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectSex")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">{t("male")}</SelectItem>
                    <SelectItem value="Female">{t("female")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 space-y-1.5">
                <Label>{t("dob")}</Label>
                <Input type="date" {...form.register("dob")} />
              </div>
              <div className="col-span-1 space-y-1.5">
                <Label>{t("mobile")}</Label>
                <Input {...form.register("mobile")} />
              </div>
              <div className="col-span-1 space-y-1.5">
                <Label>{t("email")}</Label>
                <Input type="email" {...form.register("email")} />
              </div>
              <div className="col-span-1 space-y-1.5">
                <Label>{t("nationalId")}</Label>
                <Input {...form.register("national_id")} />
              </div>
              <div className="col-span-1 space-y-1.5">
                <Label>{t("passportNo")}</Label>
                <Input {...form.register("passport_no")} />
              </div>
              <DialogFooter className="col-span-2 mt-2">
                <Button type="submit" disabled={createPatient.isPending}>
                  {createPatient.isPending ? t("registering") : t("register")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex items-center gap-2 rounded-[var(--radius-md)] border border-input bg-muted/40 px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colPatient")}</TableHead>
                <TableHead>{t("colMrn")}</TableHead>
                <TableHead>{t("colSex")}</TableHead>
                <TableHead>{t("colMobile")}</TableHead>
                <TableHead>{t("colInsurance")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <div className="h-8 animate-pulse rounded bg-muted" />
                    </TableCell>
                  </TableRow>
                ))}
              {!isLoading && data?.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    {t("empty")}
                  </TableCell>
                </TableRow>
              )}
              {data?.data.map((patient) => (
                <TableRow key={patient.name}>
                  <TableCell>
                    <Link href={`/patients/${patient.name}`} className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={patient.image ?? undefined} />
                        <AvatarFallback>{patient.patient_name?.[0] ?? "P"}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium hover:text-primary">{patient.patient_name}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{patient.name}</TableCell>
                  <TableCell>{patient.sex}</TableCell>
                  <TableCell>{patient.mobile}</TableCell>
                  <TableCell>
                    {patient.primary_insurance_company ? (
                      <Badge variant={patient.insurance_verified ? "success" : "warning"}>
                        {patient.primary_insurance_company}
                      </Badge>
                    ) : (
                      <Badge variant="muted">{t("selfPay")}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={patient.status === "Active" ? "success" : "muted"}>{patient.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" title={t("viewQr")}>
                      <QrCode className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {data?.meta && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>{t("pageInfo", { page: data.meta.page, totalPages: data.meta.total_pages, total: data.meta.total })}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  {t("previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.meta.page >= data.meta.total_pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t("next")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
