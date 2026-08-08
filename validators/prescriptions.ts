import { z } from "zod";

export const prescriptionItemSchema = z.object({
  medicine: z.string().trim().min(1, "Medicine name is required"),
  medicineId: z.string().optional(),
  dose: z.string().trim().optional(),
  frequency: z.string().trim().optional(),
  duration: z.string().trim().optional(),
  instructions: z.string().trim().optional(),
});

export const prescriptionCreateSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  doctorId: z.string().optional(),
  consultationId: z.string().optional(),
  appointmentId: z.string().optional(),
  diagnosis: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
  items: z.array(prescriptionItemSchema).min(1, "At least one medicine is required"),
});

export const prescriptionStatusSchema = z.object({
  status: z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]),
});

export type PrescriptionCreateInput = z.infer<typeof prescriptionCreateSchema>;
