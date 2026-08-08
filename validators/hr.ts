import { z } from "zod";

export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"] as const;
export const EMPLOYEE_STATUSES = ["ACTIVE", "INACTIVE", "ON_LEAVE", "TERMINATED"] as const;
export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "HALF_DAY", "LEAVE"] as const;
export const LEAVE_TYPES = ["CASUAL", "SICK", "ANNUAL", "UNPAID", "MATERNITY", "PATERNITY", "OTHER"] as const;
export const LEAVE_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export const REVIEW_RATINGS = [1, 2, 3, 4, 5] as const;

const money = (label: string) => z.coerce.number().min(0, `${label} must be zero or more`);

export const employeeSchema = z.object({
  firstName: z.string().trim().min(2, "First name is required"),
  lastName: z.string().trim().min(2, "Last name is required"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  phone: z.string().trim().optional(),
  roleName: z.string().min(1, "Role is required"),
  departmentId: z.string().optional(),
  designation: z.string().trim().optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).default("FULL_TIME"),
  joiningDate: z.string().trim().optional(),
  salary: money("Salary").default(0),
  allowances: money("Allowances").default(0),
  gender: z.string().trim().optional(),
  birthDate: z.string().trim().optional(),
  address: z.string().trim().optional(),
  emergencyContact: z.string().trim().optional(),
  bankName: z.string().trim().optional(),
  bankAccountNo: z.string().trim().optional(),
  bankIfsc: z.string().trim().optional(),
  status: z.enum(EMPLOYEE_STATUSES).default("ACTIVE"),
});

export const employeeUpdateSchema = employeeSchema.partial().extend({
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
});

export const attendanceMarkSchema = z.object({
  entries: z
    .array(
      z.object({
        employeeId: z.string().min(1, "Employee is required"),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
        status: z.enum(ATTENDANCE_STATUSES).default("PRESENT"),
        checkIn: z.string().trim().optional(),
        checkOut: z.string().trim().optional(),
        hoursWorked: z.coerce.number().min(0).optional(),
        notes: z.string().trim().optional(),
      })
    )
    .min(1, "Add at least one attendance entry"),
});

export const leaveSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  type: z.enum(LEAVE_TYPES).default("CASUAL"),
  fromDate: z.string().trim().min(1, "Start date is required"),
  toDate: z.string().trim().min(1, "End date is required"),
  reason: z.string().trim().min(2, "Reason is required"),
  notes: z.string().trim().optional(),
});

export const leaveDecisionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  notes: z.string().trim().optional(),
});

export const payrollGenerateSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM"),
  overrides: z
    .array(
      z.object({
        employeeId: z.string().min(1),
        bonus: z.coerce.number().min(0).optional(),
        overtime: z.coerce.number().min(0).optional(),
        deductions: z.coerce.number().min(0).optional(),
        notes: z.string().trim().optional(),
      })
    )
    .optional(),
});

export const payrollMarkPaidSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Select at least one payroll record"),
});

export const performanceReviewSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  period: z.string().trim().min(3, "Period is required (e.g. 2026-Q3)"),
  rating: z.coerce.number().int().min(1).max(5).default(3),
  strengths: z.string().trim().optional(),
  improvements: z.string().trim().optional(),
  goals: z.string().trim().optional(),
});
