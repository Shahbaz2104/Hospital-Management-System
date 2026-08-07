import { z } from "zod";

export const LAB_CATEGORIES = [
  "HEMATOLOGY",
  "BIOCHEMISTRY",
  "MICROBIOLOGY",
  "URINALYSIS",
  "IMMUNOLOGY",
] as const;

export const labTestSchema = z.object({
  name: z.string().trim().min(2, "Test name is required"),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .toUpperCase(),
  category: z.enum(LAB_CATEGORIES).default("HEMATOLOGY"),
  unit: z.string().trim().optional(),
  normalRange: z.string().trim().optional(),
  price: z.coerce.number().min(0).default(0),
  description: z.string().trim().optional(),
});

export const labOrderSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  doctorId: z.string().optional(),
  priority: z.enum(["ROUTINE", "URGENT", "STAT"]).default("ROUTINE"),
  testIds: z.array(z.string()).min(1, "Select at least one test"),
  notes: z.string().trim().optional(),
});

export const labResultSchema = z.object({
  results: z
    .array(
      z.object({
        testId: z.string(),
        name: z.string(),
        value: z.string().min(1, "Value is required"),
        unit: z.string().optional(),
        normalRange: z.string().optional(),
        flag: z.enum(["NORMAL", "HIGH", "LOW"]).optional(),
      })
    )
    .min(1, "Enter at least one result"),
});

export const RAD_MODALITIES = ["XRAY", "MRI", "CT", "ULTRASOUND"] as const;

export const radiologyOrderSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  doctorId: z.string().optional(),
  modality: z.enum(RAD_MODALITIES).default("XRAY"),
  bodyPart: z.string().trim().optional(),
  scheduledAt: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
});

export const radiologyResultSchema = z.object({
  findings: z.string().trim().min(1, "Findings are required"),
  reports: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        url: z.string().min(1),
      })
    )
    .optional(),
});

export type LabOrderInput = z.infer<typeof labOrderSchema>;
export type RadiologyOrderInput = z.infer<typeof radiologyOrderSchema>;
