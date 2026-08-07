import { db } from "@/lib/db";

export async function logAudit({
  userId,
  action,
  entity,
  entityId,
  meta,
  ipAddress,
  userAgent,
}: {
  userId?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  meta?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  try {
    await db.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        entity: entity ?? null,
        entityId: entityId ?? null,
        meta: meta ? JSON.stringify(meta) : null,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    });
  } catch (error) {
    // Audit logging must never break the primary operation.
    console.error("[audit]", error);
  }
}