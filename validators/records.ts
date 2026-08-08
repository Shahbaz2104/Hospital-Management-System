import { z } from "zod";

export const RECORD_TYPES = [
  "PRESCRIPTION",
  "DIAGNOSIS",
  "LAB",
  "RADIOLOGY",
  "ADMISSION",
  "OPD",
  "GENERAL",
] as const;

export const medicalRecordCreateSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  type: z.enum(RECORD_TYPES).default("GENERAL"),
  title: z.string().trim().min(2, "Title is required").max(200),
  summary: z.string().trim().max(2000).optional(),
  doctorId: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
});

export type MedicalRecordCreateInput = z.infer<typeof medicalRecordCreateSchema>;
