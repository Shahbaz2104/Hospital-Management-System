import { z } from "zod";

export const departmentSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  code: z
    .string()
    .trim()
    .min(2, "Code is required")
    .max(10)
    .toUpperCase()
    .regex(/^[A-Z0-9_-]+$/, "Only letters, numbers, - and _"),
  description: z.string().trim().max(500).optional(),
  headDoctorId: z.string().optional(),
});

export const doctorSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  firstName: z.string().trim().min(2, "First name is required"),
  lastName: z.string().trim().min(2, "Last name is required"),
  phone: z.string().trim().optional(),
  title: z.string().trim().optional(),
  departmentId: z.string().optional(),
  specialization: z.string().trim().optional(),
  qualification: z.string().trim().optional(),
  experienceYears: z.coerce.number().min(0).max(60).default(0),
  consultationFee: z.coerce.number().min(0).default(0),
  licenseNumber: z.string().trim().optional(),
  bio: z.string().trim().max(2000).optional(),
  available: z.boolean().default(true),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const doctorUpdateSchema = doctorSchema
  .omit({ password: true, email: true })
  .partial();

export const nurseSchema = z.object({
  email: z.string().email("Enter a valid email"),
  firstName: z.string().trim().min(2, "First name is required"),
  lastName: z.string().trim().min(2, "Last name is required"),
  phone: z.string().trim().optional(),
  departmentId: z.string().optional(),
  ward: z.string().trim().optional(),
  shift: z.enum(["DAY", "NIGHT", "ROTATING"]).default("DAY"),
  licenseNo: z.string().trim().optional(),
  designation: z.string().trim().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const roomSchema = z.object({
  number: z.string().trim().min(1, "Room number is required"),
  name: z.string().trim().optional(),
  type: z
    .enum(["ICU", "GENERAL", "PRIVATE", "SEMI_PRIVATE", "OT"])
    .default("GENERAL"),
  floor: z.coerce.number().min(0).default(1),
  capacity: z.coerce.number().min(1).max(50).default(2),
  ratePerDay: z.coerce.number().min(0).default(0),
  departmentId: z.string().optional(),
  bedCount: z.coerce.number().min(1).default(2),
  status: z.enum(["AVAILABLE", "FULL", "MAINTENANCE"]).default("AVAILABLE"),
});

export const bedStatusSchema = z.object({
  status: z.enum(["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"]),
  patientId: z.string().optional(),
  currentAdmissionId: z.string().optional(),
});

export type DepartmentInput = z.infer<typeof departmentSchema>;
export type DoctorInput = z.infer<typeof doctorSchema>;
export type DoctorUpdateInput = z.infer<typeof doctorUpdateSchema>;
export type NurseInput = z.infer<typeof nurseSchema>;
export type RoomInput = z.infer<typeof roomSchema>;
export type BedStatusInput = z.infer<typeof bedStatusSchema>;