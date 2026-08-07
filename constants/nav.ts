import type { LucideIcon } from "lucide-react";
import {
  AlarmClock,
  AudioWaveform,
  BedDouble,
  Bell,
  Building2,
  CalendarClock,
  Calculator,
  ClipboardList,
  CreditCard,
  FileBarChart,
  FileText,
  Fingerprint,
  FlaskConical,
  FolderOpen,
  HeartPulse,
  LayoutDashboard,
  ListChecks,
  Microscope,
  Package,
  Phone,
  Pill,
  Receipt,
  RotateCcw,
  Settings,
  ShieldCheck,
  Stethoscope,
  UserCog,
  UserRound,
  Users,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon?: LucideIcon;
  permission?: string;
  badge?: string;
};

export type NavSection = {
  title?: string;
  items: NavItem[];
};

export const navConfig: NavSection[] = [
  {
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard:read" }],
  },
  {
    title: "Clinical",
    items: [
      { title: "Patients", href: "/patients", icon: HeartPulse, permission: "patients:read" },
      { title: "Appointments", href: "/appointments", icon: CalendarClock, permission: "appointments:read" },
      { title: "Doctors", href: "/doctors", icon: Stethoscope, permission: "doctors:read" },
      { title: "Departments", href: "/departments", icon: Building2 },
      { title: "Rooms & Beds", href: "/rooms", icon: BedDouble, permission: "rooms:read" },
      { title: "Admissions", href: "/admissions", icon: ClipboardList, permission: "admissions:read" },
      { title: "Discharges", href: "/discharges", icon: RotateCcw, permission: "discharges:read" },
      { title: "OPD", href: "/opd", icon: ListChecks, permission: "appointments:read" },
      { title: "Emergency", href: "/emergency", icon: AlarmClock, permission: "admissions:manage" },
      { title: "Nurses", href: "/nurses", icon: AudioWaveform, permission: "hr:read" },
    ],
  },
  {
    title: "Diagnostics",
    items: [
      { title: "Laboratory", href: "/laboratory", icon: FlaskConical, permission: "laboratory:read" },
      { title: "Radiology", href: "/radiology", icon: Microscope, permission: "radiology:read" },
    ],
  },
  {
    title: "Pharmacy & Stock",
    items: [
      { title: "Pharmacy", href: "/pharmacy", icon: Pill, permission: "pharmacy:read" },
      { title: "Medicine Inventory", href: "/inventory", icon: Package, permission: "inventory:read" },
    ],
  },
  {
    title: "Finance",
    items: [
      { title: "Billing", href: "/billing", icon: Receipt, permission: "billing:read" },
      { title: "Payments", href: "/payments", icon: CreditCard, permission: "payments:read" },
      { title: "Insurance", href: "/insurance", icon: ShieldCheck, permission: "insurance:read" },
    ],
  },
  {
    title: "People",
    items: [
      { title: "Staff", href: "/staff", icon: Users, permission: "hr:read" },
      { title: "HR", href: "/hr", icon: UserCog, permission: "hr:read" },
      { title: "Payroll", href: "/payroll", icon: Calculator, permission: "payroll:read" },
    ],
  },
  {
    title: "Operations",
    items: [
      { title: "Reception", href: "/reception", icon: Phone, permission: "patients:create" },
      { title: "Reports", href: "/reports", icon: FileBarChart, permission: "reports:read" },
      { title: "Prescriptions", href: "/prescriptions", icon: FileText, permission: "prescriptions:read" },
      { title: "Medical Records", href: "/records", icon: FolderOpen, permission: "records:read" },
      { title: "Analytics", href: "/analytics", icon: AudioWaveform, permission: "analytics:read" },
      { title: "Notifications", href: "/notifications", icon: Bell, permission: "notifications:read" },
    ],
  },
  {
    title: "System",
    items: [
      { title: "Users", href: "/users", icon: UserCog, permission: "users:read" },
      { title: "Settings", href: "/settings", icon: Settings, permission: "settings:manage" },
      { title: "Audit Logs", href: "/audit-logs", icon: Fingerprint, permission: "audit:read" },
      { title: "Profile", href: "/profile", icon: UserRound, permission: "profile:read" },
    ],
  },
];