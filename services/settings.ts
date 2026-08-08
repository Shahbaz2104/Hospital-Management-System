import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { logAudit } from "@/services/audit";
import type { HospitalSettingsInput, NotificationSettingsInput, SmtpSettingsInput } from "@/validators/settings";

type SettingsKey =
  | "smtp.host"
  | "smtp.port"
  | "smtp.secure"
  | "smtp.user"
  | "smtp.pass"
  | "smtp.from"
  | "notify.lowStockThreshold"
  | "notify.expiryAlertDays"
  | "notify.appointmentReminderMinutes"
  | "notify.emailOnAlerts";

async function getSettings(hospitalId: string): Promise<Record<string, string>> {
  const rows = await db.settings.findMany({ where: { hospitalId } });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

async function upsertSettings(hospitalId: string, key: SettingsKey, value: string) {
  await db.settings.upsert({
    where: { hospitalId_key: { hospitalId, key } },
    update: { value },
    create: { hospitalId, key, value },
  });
}

export async function getSettingsOverview() {
  const hospital = await db.hospital.findFirst({ orderBy: { createdAt: "asc" } });
  if (!hospital) throw new ApiError(404, "Hospital not found");
  const settings = await getSettings(hospital.id);

  return {
    hospital: {
      id: hospital.id,
      name: hospital.name,
      slug: hospital.slug,
      email: hospital.email ?? "",
      phone: hospital.phone ?? "",
      address: hospital.address ?? "",
      city: hospital.city ?? "",
      country: hospital.country ?? "",
      logoUrl: hospital.logoUrl ?? "",
      currency: hospital.currency,
      taxRate: hospital.taxRate,
      timezone: hospital.timezone,
      workingHoursStart: hospital.workingHoursStart,
      workingHoursEnd: hospital.workingHoursEnd,
      appointmentDuration: hospital.appointmentDuration,
    },
    smtp: {
      host: settings["smtp.host"] ?? "",
      port: Number(settings["smtp.port"]) || 587,
      secure: settings["smtp.secure"] === "true",
      user: settings["smtp.user"] ?? "",
      pass: settings["smtp.pass"] ?? "",
      from: settings["smtp.from"] ?? "",
    },
    notifications: {
      lowStockThreshold: Number(settings["notify.lowStockThreshold"]) || 10,
      expiryAlertDays: Number(settings["notify.expiryAlertDays"]) || 30,
      appointmentReminderMinutes: Number(settings["notify.appointmentReminderMinutes"]) || 60,
      emailOnAlerts: settings["notify.emailOnAlerts"] !== "false",
    },
  };
}

export async function updateHospitalSettings(actor: { id: string }, input: HospitalSettingsInput) {
  const hospital = await db.hospital.findFirst({ orderBy: { createdAt: "asc" } });
  if (!hospital) throw new ApiError(404, "Hospital not found");
  const updated = await db.hospital.update({
    where: { id: hospital.id },
    data: {
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      address: input.address || null,
      city: input.city || null,
      country: input.country || null,
      logoUrl: input.logoUrl || null,
      currency: input.currency,
      taxRate: input.taxRate,
      timezone: input.timezone || hospital.timezone,
      workingHoursStart: input.workingHoursStart,
      workingHoursEnd: input.workingHoursEnd,
      appointmentDuration: input.appointmentDuration,
    },
  });
  logAudit({ userId: actor.id, action: "SETTINGS_HOSPITAL_UPDATED", entity: "Hospital", entityId: hospital.id });
  return updated;
}

export async function updateSmtpSettings(actor: { id: string }, input: SmtpSettingsInput) {
  const hospital = await db.hospital.findFirst({ orderBy: { createdAt: "asc" } });
  if (!hospital) throw new ApiError(404, "Hospital not found");
  await Promise.all([
    upsertSettings(hospital.id, "smtp.host", input.host),
    upsertSettings(hospital.id, "smtp.port", String(input.port)),
    upsertSettings(hospital.id, "smtp.secure", String(input.secure)),
    upsertSettings(hospital.id, "smtp.user", input.user ?? ""),
    upsertSettings(hospital.id, "smtp.pass", input.pass ?? ""),
    upsertSettings(hospital.id, "smtp.from", input.from ?? ""),
  ]);
  logAudit({ userId: actor.id, action: "SETTINGS_SMTP_UPDATED", entity: "Hospital", entityId: hospital.id });
  return { ok: true };
}

export async function updateNotificationSettings(actor: { id: string }, input: NotificationSettingsInput) {
  const hospital = await db.hospital.findFirst({ orderBy: { createdAt: "asc" } });
  if (!hospital) throw new ApiError(404, "Hospital not found");
  await Promise.all([
    upsertSettings(hospital.id, "notify.lowStockThreshold", String(input.lowStockThreshold)),
    upsertSettings(hospital.id, "notify.expiryAlertDays", String(input.expiryAlertDays)),
    upsertSettings(hospital.id, "notify.appointmentReminderMinutes", String(input.appointmentReminderMinutes)),
    upsertSettings(hospital.id, "notify.emailOnAlerts", String(input.emailOnAlerts)),
  ]);
  logAudit({ userId: actor.id, action: "SETTINGS_NOTIFICATIONS_UPDATED", entity: "Hospital", entityId: hospital.id });
  return { ok: true };
}
