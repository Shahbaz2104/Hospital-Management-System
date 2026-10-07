/**
 * Prisma `select` fragment that excludes sensitive fields (passwordHash, etc.)
 * from User queries. Use with `include: { user: { select: safeUserSelect } }`.
 */
export const safeUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  title: true,
  avatarUrl: true,
  phone: true,
  status: true,
  hospitalId: true,
  createdAt: true,
} as const;
