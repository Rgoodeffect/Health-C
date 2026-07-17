"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { addDays, addMonths, addWeeks, format, isSameDay, startOfMonth, startOfWeek } from "date-fns";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  useAppointmentCalendar,
  useRescheduleAppointment,
  useCancelAppointment,
  type AppointmentItem,
  type CalendarView,
} from "@/lib/api/appointments";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 11 }, (_, i) => 8 + i); // 08:00–18:00

export default function AppointmentsPage() {
  const t = useTranslations("appointments");
  const [view, setView] = React.useState<CalendarView>("week");
  const [anchor, setAnchor] = React.useState(() => new Date());

  const dateParam = format(anchor, "yyyy-MM-dd");
  const { data, isLoading } = useAppointmentCalendar(view, dateParam);
  const reschedule = useRescheduleAppointment();
  const cancel = useCancelAppointment();

  function shift(step: number) {
    setAnchor((prev) =>
      view === "day" ? addDays(prev, step) : view === "week" ? addWeeks(prev, step) : addMonths(prev, step)
    );
  }

  function onDrop(appointment: AppointmentItem, newDate: Date, hour: number) {
    reschedule.mutate(
      {
        name: appointment.name,
        appointment_date: format(newDate, "yyyy-MM-dd"),
        appointment_time: `${String(hour).padStart(2, "0")}:00:00`,
      },
      {
        onSuccess: () => toast.success(t("rescheduled")),
        onError: () => toast.error(t("rescheduleError")),
      }
    );
  }

  const appointments = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          {t("newAppointment")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v as CalendarView)}>
          <TabsList>
            <TabsTrigger value="day">{t("day")}</TabsTrigger>
            <TabsTrigger value="week">{t("week")}</TabsTrigger>
            <TabsTrigger value="month">{t("month")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shift(-1)}>
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <span className="min-w-40 text-center text-sm font-medium">
            {view === "month" ? format(anchor, "MMMM yyyy") : format(anchor, "MMM d, yyyy")}
          </span>
          <Button variant="outline" size="icon" onClick={() => shift(1)}>
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date())}>
            {t("today")}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="h-64 animate-pulse rounded bg-muted" />
          ) : view === "month" ? (
            <MonthView anchor={anchor} appointments={appointments} t={t} onDayClick={(d) => { setAnchor(d); setView("day"); }} />
          ) : view === "week" ? (
            <WeekView anchor={anchor} appointments={appointments} onDrop={onDrop} onCancel={(name) => cancel.mutate({ name })} t={t} />
          ) : (
            <DayView anchor={anchor} appointments={appointments} onCancel={(name) => cancel.mutate({ name })} t={t} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AppointmentCard({
  appointment,
  onCancel,
  t,
  draggable = true,
}: {
  appointment: AppointmentItem;
  onCancel: (name: string) => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  draggable?: boolean;
}) {
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", appointment.name)}
      className="cursor-grab rounded-[var(--radius-sm)] border border-primary/20 bg-accent px-2 py-1.5 text-xs shadow-sm active:cursor-grabbing"
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-medium text-accent-foreground">{appointment.appointment_time?.slice(0, 5)}</span>
        <Badge variant={appointment.status === "Cancelled" ? "danger" : "success"} className="px-1.5 py-0 text-[10px]">
          {appointment.status}
        </Badge>
      </div>
      <p className="mt-0.5 truncate font-medium">{appointment.patient_name}</p>
      <p className="truncate text-muted-foreground">{appointment.practitioner_name}</p>
      {appointment.status !== "Cancelled" && (
        <button
          className="mt-1 text-[10px] text-danger hover:underline"
          onClick={() => onCancel(appointment.name)}
        >
          {t("cancel")}
        </button>
      )}
    </div>
  );
}

function WeekView({
  anchor,
  appointments,
  onDrop,
  onCancel,
  t,
}: {
  anchor: Date;
  appointments: AppointmentItem[];
  onDrop: (a: AppointmentItem, date: Date, hour: number) => void;
  onCancel: (name: string) => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  const start = startOfWeek(anchor, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  function apptsFor(day: Date, hour: number) {
    return appointments.filter(
      (a) => isSameDay(new Date(a.appointment_date), day) && Number(a.appointment_time?.slice(0, 2)) === hour
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[900px] grid-cols-[60px_repeat(7,1fr)]">
        <div />
        {days.map((day) => (
          <div key={day.toISOString()} className="border-b border-border px-2 pb-2 text-center">
            <p className="text-xs text-muted-foreground">{format(day, "EEE")}</p>
            <p className={cn("text-sm font-semibold", isSameDay(day, new Date()) && "text-primary")}>{format(day, "d")}</p>
          </div>
        ))}
        {HOURS.map((hour) => (
          <React.Fragment key={hour}>
            <div className="border-e border-border py-2 pe-2 text-end text-xs text-muted-foreground">
              {String(hour).padStart(2, "0")}:00
            </div>
            {days.map((day) => (
              <div
                key={`${day.toISOString()}-${hour}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const name = e.dataTransfer.getData("text/plain");
                  const appt = appointments.find((a) => a.name === name);
                  if (appt) onDrop(appt, day, hour);
                }}
                className="min-h-16 space-y-1 border-b border-s border-border p-1"
              >
                {apptsFor(day, hour).map((a) => (
                  <AppointmentCard key={a.name} appointment={a} onCancel={onCancel} t={t} />
                ))}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function DayView({
  anchor,
  appointments,
  onCancel,
  t,
}: {
  anchor: Date;
  appointments: AppointmentItem[];
  onCancel: (name: string) => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  const dayAppointments = appointments.filter((a) => isSameDay(new Date(a.appointment_date), anchor));

  if (dayAppointments.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">{t("noAppointmentsForDay")}</p>;
  }

  return (
    <div className="space-y-2">
      {dayAppointments
        .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time))
        .map((a) => (
          <div key={a.name} className="max-w-md">
            <AppointmentCard appointment={a} onCancel={onCancel} t={t} draggable={false} />
          </div>
        ))}
    </div>
  );
}

function MonthView({
  anchor,
  appointments,
  onDayClick,
  t,
}: {
  anchor: Date;
  appointments: AppointmentItem[];
  onDayClick: (date: Date) => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  const monthStart = startOfMonth(anchor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-[var(--radius-md)] border border-border bg-border">
      {days.map((day) => {
        const dayAppointments = appointments.filter((a) => isSameDay(new Date(a.appointment_date), day));
        const inMonth = day.getMonth() === anchor.getMonth();
        return (
          <button
            key={day.toISOString()}
            onClick={() => onDayClick(day)}
            className={cn(
              "min-h-24 bg-card p-2 text-start transition-colors hover:bg-accent",
              !inMonth && "bg-muted/40 text-muted-foreground"
            )}
          >
            <span className={cn("text-xs font-medium", isSameDay(day, new Date()) && "text-primary")}>{format(day, "d")}</span>
            {dayAppointments.length > 0 && (
              <p className="mt-1 text-[11px] text-primary">{t("appointmentsCount", { count: dayAppointments.length })}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}
