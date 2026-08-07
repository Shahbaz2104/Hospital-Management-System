import { z } from "zod";

export const admissionSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  bedId: z.string().optional(),
  doctorId: z.string().optional(),
  reason: z.string().trim().optional(),
  diagnosis: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const transferSchema = z.object({
  bedId: z.string().min(1, "Target bed is required"),
});

export type AdmissionInput = z.infer<typeof admissionSchema>;
