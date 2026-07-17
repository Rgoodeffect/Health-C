"use client";

import { useTranslations } from "next-intl";
import { Activity } from "lucide-react";
import { useWaitingRoomDisplay } from "@/lib/api/reception";

export default function ReceptionDisplayPage() {
  const t = useTranslations("receptionDisplay");
  const { data, isLoading } = useWaitingRoomDisplay();
  const departments = Object.entries(data?.data ?? {});

  return (
    <div className="min-h-screen bg-[#0b1220] p-10 text-white">
      <div className="mb-10 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-primary">
          <Activity className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold">{t("title")}</h1>
          <p className="text-white/60">{t("subtitle")}</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-white/60">{t("loading")}</p>
      ) : departments.length === 0 ? (
        <p className="text-2xl text-white/60">{t("empty")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {departments.map(([department, info]) => (
            <div key={department} className="rounded-[var(--radius-lg)] border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-xl font-semibold text-white/80">{department}</h2>
              {info.now_serving.length === 0 ? (
                <p className="text-white/40">{t("noneCalled")}</p>
              ) : (
                <div className="space-y-3">
                  {info.now_serving.map((s) => (
                    <div key={s.token} className="flex items-center justify-between rounded-[var(--radius-md)] bg-primary/20 px-4 py-3">
                      <span className="font-mono text-2xl font-bold text-primary">{s.token}</span>
                      <span className="text-lg">{s.patient_first_name}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-4 text-sm text-white/40">{t("waitingCount", { count: info.waiting_count })}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
