import { z } from "zod";

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

export const patientSchema = z.object({
  firstName: z.string().trim().min(2, "First name is required"),
  lastName: z.string().trim().min(2, "Last name is required"),
  dob: z.coerce.date().optional(),
  gender: z.enum(GENDERS).optional(),
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  emergencyContact: z.string().trim().optional(),
  heightCm: z.coerce.number().min(30).max(250).optional(),
  weightKg: z.coerce.number().min(1).max(400).optional(),
  allergies: z.string().trim().optional(),
  medicalHistory: z.string().trim().optional(),
  previousDiseases: z.string().trim().optional(),
  currentMedication: z.string().trim().optional(),
  vaccinationHistory: z.string().trim().optional(),
  insuranceProvider: z.string().trim().optional(),
  insuranceNumber: z.string().trim().optional(),
  insurancePlan: z.string().trim().optional(),
  insuranceExpiry: z.coerce.date().optional(),
});

export const appointmentSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  doctorId: z.string().optional(),
  departmentId: z.string().optional(),
  date: z.coerce.date(),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm format"),
  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm format"),
  type: z.enum(["ONLINE", "WALKIN", "FOLLOWUP"]).default("WALKIN"),
  reason: z.string().trim().max(300).optional(),
});

export const appointmentStatusSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "MISSED"]),
});

export type PatientInput = z.infer<typeof patientSchema>;
export type AppointmentInput = z.infer<typeof appointmentSchema>;