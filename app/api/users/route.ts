import { z } from "zod";

import { requirePermission } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { ApiError, assertInput, getIp, ok, route } from "@/lib/http";
import { logAudit } from "@/services/audit";
import { passwordSchema } from "@/validators/auth";

const createUserSchema = z.object({
  firstName: z.string().trim().min(2, "First name is required"),
  lastName: z.string().trim().min(2, "Last name is required"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: passwordSchema,
  phone: z.string().trim().optional(),
  title: z.string().trim().optional(),
  roleName: z.string().min(1, "Role is required"),
});

export const GET = route(async (req: Request) => {
  await requirePermission("users:read");

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("pageSize")) || 15)
  );
  const search = url.searchParams.get("search")?.trim() ?? "";

  const where = search
    ? {
        OR: [
          { firstName: { contains: search, mode: "insensitive" as const } },
          { lastName: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      include: { role: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return ok({
    items: users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone,
      title: u.title,
      roleName: u.role.name,
      roleLabel: u.role.label,
      status: u.status,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    })),
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

export const POST = route(async (req: Request) => {
  const actor = await requirePermission("users:manage");
  const input = assertInput(
    createUserSchema,
    await req.json().catch(() => null)
  );

  const role = await db.role.findUnique({ where: { name: input.roleName } });
  if (!role) throw new ApiError(400, `Unknown role: ${input.roleName}`);

  // Privilege escalation guard: SUPER_ADMIN may only be provisioned by the
  // seed script, never through the user-management API.
  if (role.name === "SUPER_ADMIN") {
    throw new ApiError(403, "SUPER_ADMIN accounts can only be created via the seed script");
  }

  const exists = await db.user.findUnique({ where: { email: input.email } });
  if (exists) throw new ApiError(409, "A user with this email already exists");

  const user = await db.user.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      phone: input.phone ?? null,
      title: input.title ?? null,
      roleId: role.id,
      hospitalId: actor.hospitalId ?? null,
    },
  });

  await logAudit({
    userId: actor.id,
    action: "USER_CREATED",
    entity: "User",
    entityId: user.id,
    meta: { email: user.email, role: role.name },
    ipAddress: getIp(req),
  });

  return ok(
    { user: { id: user.id, email: user.email, roleName: role.name } },
    { status: 201 }
  );
});