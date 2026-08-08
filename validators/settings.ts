import { z } from "zod";

export const hospitalSettingsSchema = z.object({
  name: z.string().trim().min(2, "Hospital name is required"),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  country: z.string().trim().optional(),
  logoUrl: z.string().trim().optional().or(z.literal("")),
  currency: z.string().trim().min(1).max(3),
  taxRate: z.coerce.number().min(0).max(100),
  timezone: z.string().trim().optional(),
  workingHoursStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm format"),
  workingHoursEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm format"),
  appointmentDuration: z.coerce.number().int().min(5).max(120),
});

export const smtpSettingsSchema = z.object({
  host: z.string().trim().min(1, "SMTP host is required"),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.boolean().default(false),
  user: z.string().trim().optional(),
  pass: z.string().optional(),
  from: z.string().trim().email().optional(),
});

export const notificationSettingsSchema = z.object({
  lowStockThreshold: z.coerce.number().int().min(0),
  expiryAlertDays: z.coerce.number().int().min(1).max(365),
  appointmentReminderMinutes: z.coerce.number().int().min(5).max(1440),
  emailOnAlerts: z.boolean().default(true),
});

export type HospitalSettingsInput = z.infer<typeof hospitalSettingsSchema>;
export type SmtpSettingsInput = z.infer<typeof smtpSettingsSchema>;
export type NotificationSettingsInput = z.infer<typeof notificationSettingsSchema>;
