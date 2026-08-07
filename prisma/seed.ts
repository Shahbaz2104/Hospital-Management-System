import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/auth/password";
import {
  ALL_PERMISSIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  type PermissionKey,
  type RoleKey,
} from "../constants/permissions";

const prisma = new PrismaClient();

function permissionMeta(key: PermissionKey) {
  const [module, action] = key.split(":");
  const label = `${action} ${module.replace(/_/g, " ")}`
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { module, label };
}

async function seedPermissions() {
  for (const key of ALL_PERMISSIONS) {
    const { module, label } = permissionMeta(key);
    await prisma.permission.upsert({
      where: { key },
      update: { label, module },
      create: { key, label, module },
    });
  }
  console.log(`✔ ${ALL_PERMISSIONS.length} permissions`);
}

async function seedRoles() {
  const roleKeys = Object.keys(ROLE_LABELS) as RoleKey[];

  for (const name of roleKeys) {
    const role = await prisma.role.upsert({
      where: { name },
      update: { label: ROLE_LABELS[name], isSystem: true },
      create: {
        name,
        label: ROLE_LABELS[name],
        isSystem: true,
        description: `${ROLE_LABELS[name]} role with built-in permissions`,
      },
    });

    const granted = ROLE_PERMISSIONS[name];
    const permissionRows = await prisma.permission.findMany({
      where: { key: { in: granted } },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (name === "SUPER_ADMIN") continue; // wildcard — no rows needed

    await prisma.rolePermission.createMany({
      data: permissionRows.map((p) => ({
        roleId: role.id,
        permissionId: p.id,
      })),
    });
  }
  console.log(`✔ ${roleKeys.length} roles`);
}

async function seedUsers() {
  const hospital = await prisma.hospital.findFirst();
  const hospitalId = hospital?.id ?? undefined;

  const accounts: { email: string; password: string; role: RoleKey; name: string }[] = [
    { email: "admin@hospital.com", password: "Admin@1234", role: "SUPER_ADMIN", name: "Ayesha Rahman" },
    { email: "hospital@hospital.com", password: "Admin@1234", role: "HOSPITAL_ADMIN", name: "Imran Sheikh" },
    { email: "doctor@hospital.com", password: "Doctor@1234", role: "DOCTOR", name: "Dr. Arjun Mehta" },
    { email: "nurse@hospital.com", password: "Nurse@1234", role: "NURSE", name: "Priya Nair" },
    { email: "reception@hospital.com", password: "Reception@1234", role: "RECEPTIONIST", name: "Fatima Noor" },
    { email: "pharmacist@hospital.com", password: "Pharma@1234", role: "PHARMACIST", name: "Rohan Gupta" },
    { email: "lab@hospital.com", password: "LabTech@1234", role: "LAB_TECHNICIAN", name: "Sana Iqbal" },
    { email: "account@hospital.com", password: "Account@1234", role: "ACCOUNTANT", name: "Vikram Joshi" },
    { email: "patient@hospital.com", password: "Patient@1234", role: "PATIENT", name: "Zara Ali" },
  ];

  for (const acc of accounts) {
    const role = await prisma.role.findUnique({ where: { name: acc.role } });
    if (!role) throw new Error(`Role not found: ${acc.role}`);

    const [firstName, ...rest] = acc.name.split(" ");
    await prisma.user.upsert({
      where: { email: acc.email },
      update: { status: "ACTIVE" },
      create: {
        email: acc.email,
        firstName,
        lastName: rest.join(" "),
        passwordHash: await hashPassword(acc.password),
        roleId: role.id,
        hospitalId,
        emailVerified: true,
      },
    });
  }
  console.log(`✔ ${accounts.length} demo users`);
}

async function seedMasterData() {
  const hospital = await prisma.hospital.findFirst();
  const hospitalId = hospital?.id ?? undefined;

  const departmentSeed = [
    { name: "Cardiology", code: "CARD", description: "Heart and cardiovascular care" },
    { name: "Neurology", code: "NEURO", description: "Brain, spine and nervous system" },
    { name: "Pediatrics", code: "PED", description: "Care for infants and children" },
    { name: "Orthopedics", code: "ORTHO", description: "Bones, joints and muscles" },
    { name: "Emergency", code: "ER", description: "24/7 emergency and critical care" },
    { name: "General Medicine", code: "GENMED", description: "Internal medicine and primary care" },
  ];

  const departments = new Map<string, { id: string }>();
  for (const d of departmentSeed) {
    const dept = await prisma.department.upsert({
      where: { code: d.code },
      update: { name: d.name, description: d.description, hospitalId },
      create: { name: d.name, code: d.code, description: d.description, hospitalId },
    });
    departments.set(d.code, dept);
  }
  console.log(`✔ ${departmentSeed.length} departments`);

  const doctor = await prisma.user.findUnique({ where: { email: "doctor@hospital.com" } });
  const nurse = await prisma.user.findUnique({ where: { email: "nurse@hospital.com" } });
  const doctorRole = await prisma.role.findUnique({ where: { name: "DOCTOR" } });
  const nurseRole = await prisma.role.findUnique({ where: { name: "NURSE" } });

  if (doctor && doctorRole) {
    await prisma.doctor.upsert({
      where: { userId: doctor.id },
      update: {},
      create: {
        userId: doctor.id,
        departmentId: departments.get("CARD")?.id ?? null,
        specialization: "Cardiology",
        qualification: "MD, FACC",
        experienceYears: 12,
        consultationFee: 150,
        licenseNumber: "MD-CA-88421",
        available: true,
        bio: "Interventional cardiologist specialising in preventive heart health.",
      },
    });
    const dept = await prisma.department.findUnique({ where: { code: "CARD" } });
    if (dept) {
      await prisma.department.update({
        where: { id: dept.id },
        data: { headDoctorId: (await prisma.doctor.findUnique({ where: { userId: doctor.id } }))?.id },
      });
    }
  }

  if (nurse && nurseRole) {
    await prisma.nurse.upsert({
      where: { userId: nurse.id },
      update: {},
      create: {
        userId: nurse.id,
        departmentId: departments.get("PED")?.id ?? null,
        ward: "Ward A",
        shift: "DAY",
        licenseNo: "RN-48371",
        designation: "Head Nurse",
      },
    });
  }

  const roomSeed = [
    { number: "101", type: "GENERAL", floor: 1, capacity: 2, ratePerDay: 120, dept: "GENMED", beds: 2 },
    { number: "102", type: "PRIVATE", floor: 1, capacity: 1, ratePerDay: 300, dept: "GENMED", beds: 1 },
    { number: "ICU-1", type: "ICU", floor: 2, capacity: 3, ratePerDay: 650, dept: "CARD", beds: 3 },
    { number: "OR1", type: "OT", floor: 3, capacity: 1, ratePerDay: 1200, dept: "ORTHO", beds: 1 },
  ];

  for (const r of roomSeed) {
    const room = await prisma.room.upsert({
      where: { number: r.number },
      update: {},
      create: {
        number: r.number,
        type: r.type,
        floor: r.floor,
        capacity: r.capacity,
        ratePerDay: r.ratePerDay,
        departmentId: departments.get(r.dept)?.id ?? null,
      },
    });
    const existing = await prisma.bed.count({ where: { roomId: room.id } });
    if (existing === 0) {
      await prisma.bed.createMany({
        data: Array.from({ length: r.beds }, (_, i) => ({
          number: `${r.number}-B${i + 1}`,
          roomId: room.id,
        })),
      });
    }
  }
  console.log(`✔ ${roomSeed.length} rooms + beds`);
}

async function main() {
  console.log("Seeding HMS database…");

  await prisma.hospital.upsert({
    where: { slug: "city-care" },
    update: {},
    create: {
      name: "City Care Hospital",
      slug: "city-care",
      email: "info@citycare.example",
      phone: "+1 555 010 1234",
      address: "120 Health Boulevard",
      city: "Springfield",
      country: "US",
      currency: "USD",
    },
  });
  console.log("✔ hospital");

  await seedPermissions();
  await seedRoles();
  await seedUsers();
  await seedMasterData();

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());