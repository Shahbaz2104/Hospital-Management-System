import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { sendEmail } from "@/lib/email";

export type NotificationType =
  | "SYSTEM"
  | "STOCK_ALERT"
  | "EXPIRY_ALERT"
  | "APPOINTMENT"
  | "EMERGENCY"
  | "BILLING"
  | "HR";

/**
 * Creates a notification for a specific user or for every user holding one
 * of the given roles (e.g. pharmacy staff for stock alerts).
 */
export async function notify({
  userId,
  roles,
  title,
  message,
  type = "SYSTEM",
  entity,
  entityId,
  hospitalId,
  email,
}: {
  userId?: string;
  roles?: string[];
  title: string;
  message?: string;
  type?: NotificationType;
  entity?: string;
  entityId?: string;
  hospitalId?: string | null;
  email?: { to: string; subject: string; text: string };
}) {
  let targetIds: string[] = [];
  if (userId) {
    targetIds = [userId];
  } else if (roles?.length) {
    const users = await db.user.findMany({
      where: { role: { name: { in: roles } }, status: "ACTIVE" },
      select: { id: true, email: true },
    });
    targetIds = users.map((u) => u.id);
  }
  if (!targetIds.length) return [];

  // Per-user dedupe: skip if a notification for the same entity already exists
  // — regardless of read state, so "mark all read" (or polling) never spawns
  // duplicates for the same alert.
  const existing = entityId
    ? await db.notification.findMany({
        where: {
          entityId,
          userId: { in: targetIds },
        },
        select: { userId: true },
      })
    : [];
  const skip = new Set(existing.map((n) => n.userId));
  const targets = targetIds.filter((id) => !skip.has(id));
  if (!targets.length) return [];

  const created = await db.notification.createMany({
    data: targets.map((id) => ({
      userId: id,
      title,
      message: message ?? null,
      type,
      entity: entity ?? null,
      entityId: entityId ?? null,
      hospitalId: hospitalId ?? null,
    })),
  });

  // Best-effort email (no-op when SMTP unset). Only sent when a notification
  // was actually created — deduped alerts must not re-send email on polling.
  if (email && created.count > 0) {
    try {
      await sendEmail({
        to: email.to,
        subject: email.subject,
        text: email.text,
      });
    } catch (error) {
      console.error("[notify:email]", error);
    }
  }

  return created;
}

export async function listNotifications(
  userId: string,
  filters: { unreadOnly?: boolean; page?: number; pageSize?: number } = {}
) {
  const where: Record<string, unknown> = { userId };
  if (filters.unreadOnly) where.read = false;

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 30));

  const [items, total, unread] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.notification.count({ where }),
    db.notification.count({ where: { userId, read: false } }),
  ]);

  return { items, total, unread, page, pageSize };
}

export async function unreadCount(userId: string) {
  return db.notification.count({ where: { userId, read: false } });
}

export async function markRead(userId: string, id: string, read: boolean) {
  const existing = await db.notification.findFirst({ where: { id, userId } });
  if (!existing) throw new ApiError(404, "Notification not found");
  return db.notification.update({
    where: { id },
    data: { read, readAt: read ? new Date() : null },
  });
}

export async function markAllRead(userId: string) {
  const result = await db.notification.updateMany({
    where: { userId, read: false },
    data: { read: true, readAt: new Date() },
  });
  return { count: result.count };
}

/**
 * Lazily-generated alerts (called on notification reads): low stock,
 * near-expiry medicines, and appointment reminders for today.
 * Deduplicated per entity via unread-notification lookup in notify().
 */
export async function runAlerts() {
  const now = new Date();
  const expiryWindow = new Date(now.getTime() + 30 * 24 * 3600 * 1000);

  const pharmacyRoles = ["PHARMACIST", "HOSPITAL_ADMIN", "SUPER_ADMIN"];

  const [allMedicines, expiring] = await Promise.all([
    db.medicine.findMany({
      where: { active: true },
      select: { id: true, name: true, stock: true, reorderLevel: true, hospitalId: true },
      take: 200,
    }),
    db.medicine.findMany({
      where: { active: true, expiryDate: { lte: expiryWindow } },
      select: { id: true, name: true, expiryDate: true, hospitalId: true },
      take: 20,
    }),
  ]);
  const lowStock = allMedicines.filter((m) => m.stock <= m.reorderLevel).slice(0, 20);

  for (const m of lowStock) {
    await notify({
      roles: pharmacyRoles,
      title: `Low stock: ${m.name}`,
      message: `Only ${m.stock} units left (reorder level ${m.reorderLevel}).`,
      type: "STOCK_ALERT",
      entity: "Medicine",
      entityId: m.id,
      hospitalId: m.hospitalId,
    });
  }

  for (const m of expiring) {
    const days = m.expiryDate
      ? Math.max(0, Math.ceil((m.expiryDate.getTime() - now.getTime()) / 86_400_000))
      : null;
    await notify({
      roles: pharmacyRoles,
      title: `Expiring soon: ${m.name}`,
      message: days !== null ? `Expires in ${days} day${days === 1 ? "" : "s"}.` : "Expiry date approaching.",
      type: "EXPIRY_ALERT",
      entity: "Medicine",
      entityId: m.id,
      hospitalId: m.hospitalId,
    });
  }

  // Appointment reminders for today's confirmed appointments → the doctor.
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);

  const appointments = await db.appointment.findMany({
    where: { date: { gte: dayStart, lte: dayEnd }, status: "CONFIRMED", doctor: { isNot: null } },
    include: {
      doctor: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } },
      patient: { select: { firstName: true, lastName: true } },
    },
    take: 20,
  });

  for (const a of appointments) {
    if (!a.doctor?.user.id) continue;
    const patientName = `${a.patient.firstName} ${a.patient.lastName}`;
    await notify({
      userId: a.doctor.user.id,
      title: `Appointment today: ${patientName}`,
      message: `${patientName} at ${a.startTime} (${a.tokenNo}).`,
      type: "APPOINTMENT",
      entity: "Appointment",
      entityId: a.id,
      email: {
        to: a.doctor.user.email,
        subject: `Reminder: appointment with ${patientName} today at ${a.startTime}`,
        text: `You have a confirmed appointment with ${patientName} today at ${a.startTime} (token ${a.tokenNo}).`,
      },
    });
  }

  return {
    alerts: { lowStock: lowStock.length, expiring: expiring.length, appointmentReminders: appointments.length },
  };
}
