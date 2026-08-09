import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { hashPassword } from "@/lib/auth/password";
import { logAudit } from "@/services/audit";
import type {
  DepartmentInput,
  DoctorInput,
  DoctorUpdateInput,
  NurseInput,
  RoomInput,
} from "@/validators/master-data";

type Actor = { userId: string; hospitalId?: string | null };

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export async function listDepartments(search = "") {
  return db.department.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { code: { contains: search, mode: "insensitive" } },
          ],
        }
      : {},
    include: {
      _count: { select: { doctors: true, nurses: true, rooms: true } },
      headDoctor: { include: { user: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function createDepartment(actor: Actor, input: DepartmentInput) {
  const existing = await db.department.findUnique({ where: { code: input.code } });
  if (existing) throw new ApiError(409, `Department code ${input.code} already exists`);

  const dept = await db.department.create({
    data: {
      name: input.name,
      code: input.code,
      description: input.description ?? null,
      headDoctorId: input.headDoctorId ?? null,
      hospitalId: actor.hospitalId ?? null,
    },
  });

  return dept;
}

export async function updateDepartment(
  _actor: Actor,
  id: string,
  input: Partial<DepartmentInput>
) {
  const dept = await db.department.findUnique({ where: { id } });
  if (!dept) throw new ApiError(404, "Department not found");

  return db.department.update({
    where: { id },
    data: {
      name: input.name,
      code: input.code,
      description: input.description ?? undefined,
      headDoctorId: input.headDoctorId ?? undefined,
    },
  });
}

export async function deleteDepartment(actor: Actor, id: string) {
  const dept = await db.department.findUnique({ where: { id } });
  if (!dept) throw new ApiError(404, "Department not found");

  await db.department.delete({ where: { id } });
  await logAudit({
    userId: actor.userId,
    action: "DEPARTMENT_DELETED",
    entity: "Department",
    entityId: id,
    meta: { name: dept.name },
  });
}

// ---------------------------------------------------------------------------
// Doctors
// ---------------------------------------------------------------------------

export async function listDoctors(search = "") {
  return db.doctor.findMany({
    where: search
      ? {
          OR: [
            { user: { firstName: { contains: search, mode: "insensitive" } } },
            { user: { lastName: { contains: search, mode: "insensitive" } } },
            { specialization: { contains: search, mode: "insensitive" } },
          ],
        }
      : {},
    include: { user: true, department: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createDoctor(actor: Actor, input: DoctorInput) {
  const role = await db.role.findUnique({ where: { name: "DOCTOR" } });
  if (!role) throw new ApiError(500, "DOCTOR role missing — run the seed script");

  const exists = await db.user.findUnique({ where: { email: input.email } });
  if (exists) throw new ApiError(409, "A user with this email already exists");

  const passwordHash = await hashPassword(input.password);
  const doctor = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone ?? null,
        title: input.title ?? null,
        passwordHash,
        roleId: role.id,
        hospitalId: actor.hospitalId ?? null,
      },
    });
    return tx.doctor.create({
      data: {
        userId: user.id,
        departmentId: input.departmentId || null,
        specialization: input.specialization ?? null,
        qualification: input.qualification ?? null,
        experienceYears: input.experienceYears,
        consultationFee: input.consultationFee,
        licenseNumber: input.licenseNumber ?? null,
        available: input.available,
      },
    });
  });

  return doctor;
}

export async function updateDoctor(
  _actor: Actor,
  id: string,
  input: DoctorUpdateInput
) {
  const doctor = await db.doctor.findUnique({ where: { id } });
  if (!doctor) throw new ApiError(404, "Doctor not found");

  return db.doctor.update({
    where: { id },
    data: {
      departmentId: input.departmentId ?? undefined,
      specialization: input.specialization ?? undefined,
      qualification: input.qualification ?? undefined,
      experienceYears: input.experienceYears,
      consultationFee: input.consultationFee,
      licenseNumber: input.licenseNumber ?? undefined,
      available: input.available,
      bio: input.bio ?? undefined,
    },
  });
}

export async function deleteDoctor(actor: Actor, id: string) {
  const doctor = await db.doctor.findUnique({ where: { id }, include: { user: true } });
  if (!doctor) throw new ApiError(404, "Doctor not found");

  await db.doctor.delete({ where: { id } }); // cascades to user
  await logAudit({
    userId: actor.userId,
    action: "DOCTOR_DELETED",
    entity: "Doctor",
    entityId: id,
    meta: { email: doctor.user.email },
  });
}

// ---------------------------------------------------------------------------
// Nurses
// ---------------------------------------------------------------------------

export async function listNurses(search = "") {
  return db.nurse.findMany({
    where: search
      ? {
          OR: [
            { user: { firstName: { contains: search, mode: "insensitive" } } },
            { user: { lastName: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {},
    include: { user: true, department: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createNurse(actor: Actor, input: NurseInput) {
  const role = await db.role.findUnique({ where: { name: "NURSE" } });
  if (!role) throw new ApiError(500, "NURSE role missing — run the seed script");

  const exists = await db.user.findUnique({ where: { email: input.email } });
  if (exists) throw new ApiError(409, "A user with this email already exists");

  const passwordHash = await hashPassword(input.password);
  const nurse = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone ?? null,
        passwordHash,
        roleId: role.id,
        hospitalId: actor.hospitalId ?? null,
      },
    });
    return tx.nurse.create({
      data: {
        userId: user.id,
        departmentId: input.departmentId || null,
        ward: input.ward ?? null,
        shift: input.shift,
        licenseNo: input.licenseNo ?? null,
        designation: input.designation ?? null,
      },
    });
  });

  return nurse;
}

export async function deleteNurse(_actor: Actor, id: string) {
  const nurse = await db.nurse.findUnique({ where: { id } });
  if (!nurse) throw new ApiError(404, "Nurse not found");
  await db.nurse.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Rooms & Beds
// ---------------------------------------------------------------------------

export async function listRooms(search = "") {
  return db.room.findMany({
    where: search
      ? {
          OR: [
            { number: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
          ],
        }
      : {},
    include: {
      department: true,
      beds: { orderBy: { number: "asc" } },
      _count: { select: { beds: true } },
    },
    orderBy: { floor: "asc" },
  });
}

export async function createRoom(_actor: Actor, input: RoomInput) {
  const existing = await db.room.findUnique({ where: { number: input.number } });
  if (existing) throw new ApiError(409, `Room ${input.number} already exists`);

  const room = await db.room.create({
    data: {
      number: input.number,
      name: input.name ?? null,
      type: input.type,
      floor: input.floor,
      capacity: input.capacity,
      ratePerDay: input.ratePerDay,
      departmentId: input.departmentId || null,
      status: input.status,
    },
  });

  const beds = Array.from({ length: input.bedCount }, (_, i) => ({
    number: `${input.number}-B${i + 1}`,
    roomId: room.id,
  }));
  await db.bed.createMany({ data: beds });

  return { ...room, bedCount: beds.length };
}

export async function updateRoom(_actor: Actor, id: string, input: Partial<RoomInput>) {
  const room = await db.room.findUnique({ where: { id } });
  if (!room) throw new ApiError(404, "Room not found");

  return db.room.update({
    where: { id },
    data: {
      name: input.name ?? undefined,
      type: input.type,
      floor: input.floor,
      ratePerDay: input.ratePerDay,
      departmentId: input.departmentId ?? undefined,
      status: input.status,
    },
  });
}

export async function setBedStatus(
  actor: Actor,
  bedId: string,
  input: { status: string; patientId?: string }
) {
  const bed = await db.bed.findUnique({ where: { id: bedId } });
  if (!bed) throw new ApiError(404, "Bed not found");

  const updated = await db.bed.update({
    where: { id: bedId },
    data: {
      status: input.status,
      patientId: input.patientId ?? null,
    },
  });

  await logAudit({
    userId: actor.userId,
    action: "BED_STATUS_CHANGED",
    entity: "Bed",
    entityId: bedId,
    meta: { number: bed.number, status: input.status },
  });
  return updated;
}