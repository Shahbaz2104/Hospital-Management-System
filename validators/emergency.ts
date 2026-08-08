import { z } from "zod";

export const TRIAGE_LEVELS = ["RED", "ORANGE", "YELLOW", "GREEN"] as const;
export const CASE_STATUSES = [
  "WAITING",
  "IN_PROGRESS",
  "STABILIZED",
  "TRANSFERRED",
  "ADMITTED",
  "DISCHARGED",
] as const;

export const emergencyCaseCreateSchema = z
  .object({
    patientId: z.string().optional(),
    walkInName: z.string().trim().optional(),
    walkInPhone: z.string().trim().optional(),
    age: z.coerce.number().int().min(0).max(120).optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
    triageLevel: z.enum(TRIAGE_LEVELS).default("GREEN"),
    condition: z.string().trim().max(500).optional(),
    vitals: z
      .object({
        bp: z.string().optional(),
        pulse: z.string().optional(),
        temp: z.string().optional(),
        spo2: z.string().optional(),
        rr: z.string().optional(),
        gcs: z.string().optional(),
      })
      .optional(),
    ambulanceRequested: z.boolean().default(false),
    ambulanceNotes: z.string().trim().max(300).optional(),
  })
  .refine(
    (d) => d.patientId || d.walkInName,
    "Provide either a registered patient or a walk-in name"
  );

export const emergencyUpdateSchema = z.object({
  status: z.enum(CASE_STATUSES).optional(),
  triageLevel: z.enum(TRIAGE_LEVELS).optional(),
  assignedDoctorId: z.string().nullable().optional(),
  condition: z.string().trim().max(500).optional(),
  vitals: z
    .object({
      bp: z.string().optional(),
      pulse: z.string().optional(),
      temp: z.string().optional(),
      spo2: z.string().optional(),
      rr: z.string().optional(),
      gcs: z.string().optional(),
    })
    .optional(),
});

export const ambulanceDispatchSchema = z.object({
  etaMinutes: z.coerce.number().int().min(1).max(600),
  notes: z.string().trim().max(300).optional(),
});

export const emergencyEventSchema = z.object({
  type: z.enum(["STATUS", "AMBULANCE", "DOCTOR", "ADMISSION", "NOTE"]).default("NOTE"),
  note: z.string().trim().max(500).optional(),
});

export type EmergencyCaseCreateInput = z.infer<typeof emergencyCaseCreateSchema>;
export type EmergencyUpdateInput = z.infer<typeof emergencyUpdateSchema>;
export type AmbulanceDispatchInput = z.infer<typeof ambulanceDispatchSchema>;
export type EmergencyEventInput = z.infer<typeof emergencyEventSchema>;
