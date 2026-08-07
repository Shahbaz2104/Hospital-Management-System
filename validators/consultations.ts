import { z } from "zod";

export const vitalSchema = z.object({
  name: z.string().trim().min(1),
  value: z.string().trim().min(1),
  unit: z.string().trim().optional(),
});

export const prescriptionItemSchema = z.object({
  medicine: z.string().trim().min(1, "Medicine is required"),
  dose: z.string().trim().optional(),
  frequency: z.string().trim().optional(),
  duration: z.string().trim().optional(),
  instructions: z.string().trim().optional(),
});

export const consultationSchema = z.object({
  appointmentId: z.string().optional(),
  patientId: z.string().min(1, "Patient is required"),
  doctorId: z.string().optional(),
  diagnosis: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  followUpDate: z.coerce.date().optional(),
  vitals: z.array(vitalSchema).optional(),
  prescriptions: z.array(prescriptionItemSchema).optional(),
});

export type ConsultationInput = z.infer<typeof consultationSchema>;
