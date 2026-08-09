import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Patient IDOR guard: a PATIENT may only see their own patient record,
 * appointments and medical records. Staff keep hospital-wide access.
 * Returns the actor's Patient id (or null for non-patients / no linked record).
 */
export async function getPatientScope(user: SessionUser): Promise<string | null> {
  if (user.roleName !== "PATIENT") return null;
  const patient = await db.patient.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  return patient?.id ?? null;
}

/** Throws 403 when a PATIENT actor tries to reach another patient's data. */
export function assertPatientScope(
  user: SessionUser,
  patientId: string,
  scopedPatientId: string | null
): void {
  if (user.roleName === "PATIENT" && scopedPatientId !== patientId) {
    throw new ApiError(403, "You can only access your own records");
  }
}
