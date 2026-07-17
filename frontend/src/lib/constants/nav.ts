import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  ClipboardList,
  Stethoscope,
  Pill,
  FlaskConical,
  ScanLine,
  BedDouble,
  Scissors,
  Warehouse,
  Receipt,
  ShieldCheck,
  BarChart3,
  UserRound,
} from "lucide-react";

export interface NavItem {
  key: string;
  href: string;
  icon: LucideIcon;
  roles: string[] | "all";
}

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard, roles: "all" },
  { key: "patients", href: "/patients", icon: Users, roles: [
    "CEO", "Medical Director", "Receptionist", "Doctor", "Nurse", "System Manager",
  ] },
  { key: "appointments", href: "/appointments", icon: CalendarClock, roles: [
    "Receptionist", "Doctor", "Nurse", "Medical Director", "System Manager",
  ] },
  { key: "reception", href: "/reception", icon: ClipboardList, roles: ["Receptionist", "System Manager"] },
  { key: "emr", href: "/emr", icon: Stethoscope, roles: ["Doctor", "Nurse", "Medical Director", "System Manager"] },
  { key: "prescriptions", href: "/prescriptions", icon: Pill, roles: ["Doctor", "Pharmacist", "System Manager"] },
  { key: "laboratory", href: "/laboratory", icon: FlaskConical, roles: ["Laboratory Technician", "Doctor", "System Manager"] },
  { key: "radiology", href: "/radiology", icon: ScanLine, roles: ["Radiologist", "Doctor", "System Manager"] },
  { key: "admissions", href: "/admissions", icon: BedDouble, roles: ["Nurse", "Doctor", "Medical Director", "System Manager"] },
  { key: "surgery", href: "/surgery", icon: Scissors, roles: ["Doctor", "Nurse", "Medical Director", "System Manager"] },
  { key: "pharmacy", href: "/pharmacy", icon: Warehouse, roles: ["Pharmacist", "System Manager"] },
  { key: "billing", href: "/billing", icon: Receipt, roles: ["Cashier", "Finance Director", "System Manager"] },
  { key: "insurance", href: "/insurance", icon: ShieldCheck, roles: ["Insurance Officer", "Finance Director", "System Manager"] },
  { key: "analytics", href: "/analytics", icon: BarChart3, roles: [
    "CEO", "Medical Director", "Finance Director", "System Manager",
  ] },
  { key: "portal", href: "/portal", icon: UserRound, roles: ["Patient"] },
];

export function navItemsForRoles(roles: string[]): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles === "all" || item.roles.some((r) => roles.includes(r)));
}
