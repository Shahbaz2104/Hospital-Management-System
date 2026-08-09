export type PermissionKey =
  | "*"
  | "dashboard:read"
  | "patients:read"
  | "patients:create"
  | "patients:update"
  | "patients:delete"
  | "doctors:read"
  | "doctors:create"
  | "doctors:update"
  | "doctors:delete"
  | "doctors:manage"
  | "nurses:read"
  | "nurses:manage"
  | "appointments:read"
  | "appointments:create"
  | "appointments:update"
  | "appointments:delete"
  | "departments:read"
  | "departments:manage"
  | "rooms:read"
  | "rooms:manage"
  | "admissions:read"
  | "admissions:manage"
  | "discharges:read"
  | "discharges:manage"
  | "laboratory:read"
  | "laboratory:manage"
  | "radiology:read"
  | "radiology:manage"
  | "pharmacy:read"
  | "pharmacy:manage"
  | "inventory:read"
  | "inventory:manage"
  | "prescriptions:read"
  | "consultations:read"
  | "consultations:manage"
  | "prescriptions:create"
  | "billing:read"
  | "billing:manage"
  | "payments:read"
  | "payments:manage"
  | "insurance:read"
  | "insurance:manage"
  | "hr:read"
  | "hr:manage"
  | "payroll:read"
  | "payroll:manage"
  | "reports:read"
  | "reports:export"
  | "analytics:read"
  | "notifications:read"
  | "records:read"
  | "records:manage"
  | "emergency:read"
  | "emergency:manage"
  | "prescriptions:manage"
  | "profile:read"
  | "users:read"
  | "users:manage"
  | "audit:read"
  | "settings:manage";

export const ALL_PERMISSIONS: PermissionKey[] = [
  "dashboard:read",
  "patients:read",
  "patients:create",
  "patients:update",
  "patients:delete",
  "doctors:read",
  "doctors:create",
  "doctors:update",
  "doctors:delete",
  "doctors:manage",
  "nurses:read",
  "nurses:manage",
  "appointments:read",
  "appointments:create",
  "appointments:update",
  "appointments:delete",
  "departments:read",
  "departments:manage",
  "rooms:read",
  "rooms:manage",
  "admissions:read",
  "admissions:manage",
  "discharges:read",
  "discharges:manage",
  "laboratory:read",
  "laboratory:manage",
  "radiology:read",
  "radiology:manage",
  "pharmacy:read",
  "pharmacy:manage",
  "inventory:read",
  "inventory:manage",
  "prescriptions:read",
  "prescriptions:create",
  "consultations:read",
  "consultations:manage",
  "billing:read",
  "billing:manage",
  "payments:read",
  "payments:manage",
  "insurance:read",
  "insurance:manage",
  "hr:read",
  "hr:manage",
  "payroll:read",
  "payroll:manage",
  "reports:read",
  "reports:export",
  "analytics:read",
  "notifications:read",
  "emergency:read",
  "emergency:manage",
  "records:read",
  "records:manage",
  "prescriptions:manage",
  "profile:read",
  "users:read",
  "users:manage",
  "audit:read",
  "settings:manage",
];

export type RoleKey =
  | "SUPER_ADMIN"
  | "HOSPITAL_ADMIN"
  | "DOCTOR"
  | "NURSE"
  | "RECEPTIONIST"
  | "PHARMACIST"
  | "LAB_TECHNICIAN"
  | "ACCOUNTANT"
  | "PATIENT";

/** Wildcard meaning "everything" for super admins. */
export const hasPermission = (
  granted: PermissionKey[],
  required: PermissionKey
): boolean => granted.includes("*" as PermissionKey) || granted.includes(required);

export const ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  SUPER_ADMIN: ["*"],
  HOSPITAL_ADMIN: [...ALL_PERMISSIONS],
  DOCTOR: [
    "dashboard:read",
    "patients:read",
    "patients:update",
    "doctors:read",
    "appointments:read",
    "appointments:update",
    "appointments:create",
    "admissions:read",
    "discharges:read",
    "laboratory:read",
    "radiology:read",
    "pharmacy:read",
    "prescriptions:read",
    "prescriptions:create",
    "consultations:read",
    "consultations:manage",
    "records:read",
    "records:manage",
    "emergency:read",
    "emergency:manage",
    "prescriptions:manage",
    "profile:read",
    "analytics:read",
    "notifications:read",
    "reports:read",
  ],
  NURSE: [
    "dashboard:read",
    "patients:read",
    "patients:update",
    "appointments:read",
    "rooms:read",
    "nurses:read",
    "admissions:read",
    "admissions:manage",
    "discharges:read",
    "laboratory:read",
    "pharmacy:read",
    "prescriptions:read",
    "consultations:read",
    "records:read",
    "records:manage",
    "emergency:read",
    "emergency:manage",
    "profile:read",
    "notifications:read",
  ],
  RECEPTIONIST: [
    "dashboard:read",
    "patients:read",
    "patients:create",
    "patients:update",
    "appointments:read",
    "appointments:create",
    "appointments:update",
    "doctors:read",
    "departments:read",
    "billing:read",
    "profile:read",
    "notifications:read",
  ],
  PHARMACIST: [
    "dashboard:read",
    "patients:read",
    "pharmacy:read",
    "pharmacy:manage",
    "inventory:read",
    "inventory:manage",
    "prescriptions:read",
    "prescriptions:manage",
    "billing:read",
    "profile:read",
    "notifications:read",
  ],
  LAB_TECHNICIAN: [
    "dashboard:read",
    "patients:read",
    "laboratory:read",
    "laboratory:manage",
    "radiology:read",
    "reports:read",
    "profile:read",
    "notifications:read",
  ],
  ACCOUNTANT: [
    "dashboard:read",
    "patients:read",
    "billing:read",
    "billing:manage",
    "payments:read",
    "payments:manage",
    "insurance:read",
    "insurance:manage",
    "payroll:read",
    "reports:read",
    "reports:export",
    "analytics:read",
    "dashboard:read",
    "profile:read",
    "notifications:read",
  ],
  PATIENT: [
    "dashboard:read",
    "patients:read",
    "records:read",
    "profile:read",
    "appointments:read",
    "appointments:create",
    "doctors:read",
    "notifications:read",
  ],
};

export const ROLE_LABELS: Record<RoleKey, string> = {
  SUPER_ADMIN: "Super Admin",
  HOSPITAL_ADMIN: "Hospital Admin",
  DOCTOR: "Doctor",
  NURSE: "Nurse",
  RECEPTIONIST: "Receptionist",
  PHARMACIST: "Pharmacist",
  LAB_TECHNICIAN: "Laboratory Technician",
  ACCOUNTANT: "Accountant",
  PATIENT: "Patient",
};