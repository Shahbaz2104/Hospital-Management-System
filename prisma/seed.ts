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
  await prisma.permission.upsert({
    where: { key: "*" },
    update: { label: "Full Access", module: "system" },
    create: { key: "*", label: "Full Access", module: "system" },
  });

  for (const key of ALL_PERMISSIONS) {
    const { module, label } = permissionMeta(key);
    await prisma.permission.upsert({
      where: { key },
      update: { label, module },
      create: { key, label, module },
    });
  }
  console.log(`✔ ${ALL_PERMISSIONS.length + 1} permissions (incl. wildcard)`);
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

    const wildcard = name === "SUPER_ADMIN"
      ? await prisma.permission.findUnique({ where: { key: "*" } })
      : null;

    await prisma.rolePermission.createMany({
      data: wildcard
        ? [{ roleId: role.id, permissionId: wildcard.id }]
        : permissionRows.map((p) => ({
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

async function seedPatients() {
  const hospital = await prisma.hospital.findFirst();
  const hospitalId = hospital?.id ?? undefined;

  const patientSeed = [
    { firstName: "Zara", lastName: "Ali", dob: new Date("1992-03-14"), bloodGroup: "B+", phone: "+1 555 010 2001", allergies: "Penicillin", insuranceProvider: "BlueShield" },
    { firstName: "David", lastName: "Chen", dob: new Date("1985-07-22"), bloodGroup: "A+", phone: "+1 555 010 2002", insuranceProvider: "Aetna" },
    { firstName: "Maria", lastName: "Lopez", dob: new Date("1978-11-02"), bloodGroup: "AB-", phone: "+1 555 010 2003", allergies: "Sulfa", insuranceProvider: "Medicare" },
    { firstName: "Omar", lastName: "Wilson", dob: new Date("1960-05-30"), bloodGroup: "O-", phone: "+1 555 010 2004", insuranceProvider: "Aetna" },
    { firstName: "Aisha", lastName: "Khan", dob: new Date("2001-12-09"), bloodGroup: "B-", phone: "+1 555 010 2005", allergies: "Latex" },
    { firstName: "Peter", lastName: "Novak", dob: new Date("1995-01-18"), bloodGroup: "A-", phone: "+1 555 010 2006", insuranceProvider: "BlueShield" },
    { firstName: "Lena", lastName: "Fischer", dob: new Date("1988-09-25"), bloodGroup: "O+", phone: "+1 555 010 2007", allergies: "Peanuts", insuranceProvider: "Cigna" },
    { firstName: "Sam", lastName: "Okafor", dob: new Date("2015-04-12"), bloodGroup: "B+", phone: "+1 555 010 2008", insuranceProvider: "Medicaid" },
    { firstName: "Rachel", lastName: "Green", dob: new Date("1970-02-28"), bloodGroup: "AB+", phone: "+1 555 010 2009", insuranceProvider: "Medicare" },
    { firstName: "Tom", lastName: "Baldwin", dob: new Date("1999-08-03"), bloodGroup: "A+", phone: "+1 555 010 2010", allergies: "Aspirin" },
  ];

  for (const p of patientSeed) {
    const existing = await prisma.patient.findFirst({
      where: { firstName: p.firstName, lastName: p.lastName },
    });
    if (existing) continue;
    const count = await prisma.patient.count();
    await prisma.patient.create({
      data: {
        patientNo: `PT-${String(count + 1).padStart(4, "0")}`,
        firstName: p.firstName,
        lastName: p.lastName,
        dob: p.dob,
        bloodGroup: p.bloodGroup,
        phone: p.phone,
        allergies: p.allergies,
        insuranceProvider: p.insuranceProvider,
        hospitalId,
      },
    });
  }
  console.log(`✔ ${patientSeed.length} patients`);
}

async function seedAppointments() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const doctors = await prisma.doctor.findMany({ include: { user: true } });
  const doctorId = doctors[0]?.id ?? undefined;
  const patients = await prisma.patient.findMany({ take: 6 });

  let token = 1;
  const starts = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "15:00"];
  const statuses: { status: string; type: string }[] = [
    { status: "CONFIRMED", type: "WALKIN" },
    { status: "CONFIRMED", type: "ONLINE" },
    { status: "PENDING", type: "WALKIN" },
    { status: "COMPLETED", type: "FOLLOWUP" },
    { status: "CONFIRMED", type: "ONLINE" },
  ];

  for (let i = 0; i < statuses.length && patients[i]; i++) {
    const tokenNo = `TKN-${String(token).padStart(4, "0")}`;
    const start = starts[i] ?? "09:00";
    const startMinutes = parseInt(start.slice(0, 2)) * 60 + parseInt(start.slice(3, 5));
    const endMinutes = startMinutes + 30;
    const end = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
    await prisma.appointment.upsert({
      where: { tokenNo },
      update: {},
      create: {
        tokenNo,
        patientId: patients[i].id,
        doctorId,
        date: today,
        startTime: start,
        endTime: end,
        type: statuses[i].type,
        status: statuses[i].status,
      },
    });
    token++;
  }
  console.log(`✔ ${statuses.length} appointments today`);
}

async function seedConsultations() {
  const completed = await prisma.appointment.findMany({
    where: { status: "COMPLETED" },
    include: { patient: true, doctor: true },
    take: 2,
  });

  if (completed.length === 0) {
    console.log(`✔ 0 consultations (no completed appointments yet)`);
    return;
  }

  let seq = 1;
  for (const appt of completed) {
    const consultationNo = `OPD-${String(seq).padStart(4, "0")}`;
    await prisma.consultation.upsert({
      where: { consultationNo },
      update: {},
      create: {
        consultationNo,
        appointmentId: appt.id,
        patientId: appt.patientId,
        doctorId: appt.doctorId,
        diagnosis: "Hypertension, stable on medication",
        notes: "Advised low-sodium diet and light exercise.",
        followUpDate: new Date(Date.now() + 14 * 24 * 3600 * 1000),
        vitals: JSON.stringify([
          { name: "Temperature", value: "36.8", unit: "°C" },
          { name: "Pulse", value: "78", unit: "bpm" },
          { name: "Blood pressure", value: "128/84", unit: "mmHg" },
          { name: "SpO₂", value: "98", unit: "%" },
          { name: "Resp. rate", value: "16", unit: "/min" },
          { name: "Weight", value: "72", unit: "kg" },
        ]),
        prescriptions: JSON.stringify([
          {
            medicine: "Amlodipine",
            dose: "5mg",
            frequency: "1× daily",
            duration: "30 days",
            instructions: "Take in the morning",
          },
          {
            medicine: "Paracetamol",
            dose: "500mg",
            frequency: "1× daily",
            duration: "5 days",
            instructions: "Only if fever",
          },
        ]),
      },
    });
    seq++;
  }
  console.log(`✔ ${completed.length} consultations`);
}

const MEDICINE_SEED = [
  { name: "Paracetamol", genericName: "Acetaminophen", category: "ANALGESIC", manufacturer: "MediPharm", unit: "tablet", packSize: 10, price: 1.5, cost: 0.8, stock: 480, reorderLevel: 100, expiryDate: new Date(Date.now() + 300 * 24 * 3600 * 1000) },
  { name: "Amoxicillin", genericName: "Amoxicillin trihydrate", category: "ANTIBIOTIC", manufacturer: "BioCure", unit: "capsule", packSize: 15, price: 4.2, cost: 2.1, stock: 260, reorderLevel: 80, expiryDate: new Date(Date.now() + 240 * 24 * 3600 * 1000) },
  { name: "Amlodipine", genericName: "Amlodipine besylate", category: "CARDIAC", manufacturer: "CardioLab", unit: "tablet", packSize: 30, price: 6.0, cost: 3.2, stock: 12, reorderLevel: 60, expiryDate: new Date(Date.now() + 180 * 24 * 3600 * 1000) },
  { name: "Metformin", genericName: "Metformin HCl", category: "DIABETIC", manufacturer: "GlucoMed", unit: "tablet", packSize: 30, price: 5.0, cost: 2.6, stock: 340, reorderLevel: 90, expiryDate: new Date(Date.now() + 210 * 24 * 3600 * 1000) },
  { name: "Salbutamol", genericName: "Salbutamol sulfate", category: "RESPIRATORY", manufacturer: "AirflowRx", unit: "inhaler", packSize: 1, price: 9.5, cost: 5.4, stock: 75, reorderLevel: 25, expiryDate: new Date(Date.now() + 45 * 24 * 3600 * 1000) },
  { name: "Cetirizine", genericName: "Cetirizine HCl", category: "ANTIALLERGIC", manufacturer: "AllerGen", unit: "tablet", packSize: 10, price: 2.0, cost: 0.9, stock: 410, reorderLevel: 100, expiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000) },
  { name: "Omeprazole", genericName: "Omeprazole", category: "ANTACID", manufacturer: "GastroMed", unit: "capsule", packSize: 14, price: 3.8, cost: 1.9, stock: 18, reorderLevel: 70, expiryDate: new Date(Date.now() + 150 * 24 * 3600 * 1000) },
  { name: "Vitamin D3", genericName: "Cholecalciferol", category: "VITAMIN", manufacturer: "NutriWell", unit: "tablet", packSize: 30, price: 4.0, cost: 1.7, stock: 520, reorderLevel: 120, expiryDate: new Date(Date.now() + 400 * 24 * 3600 * 1000) },
  { name: "Ibuprofen", genericName: "Ibuprofen", category: "ANALGESIC", manufacturer: "MediPharm", unit: "tablet", packSize: 10, price: 1.8, cost: 0.8, stock: 35, reorderLevel: 100, expiryDate: new Date(Date.now() + 200 * 24 * 3600 * 1000) },
  { name: "Losartan", genericName: "Losartan potassium", category: "CARDIAC", manufacturer: "CardioLab", unit: "tablet", packSize: 28, price: 7.5, cost: 4.0, stock: 150, reorderLevel: 50, expiryDate: new Date(Date.now() + 330 * 24 * 3600 * 1000) },
];

const SUPPLIER_SEED = [
  { name: "MediPharm Distributors", contactPerson: "Sarah Khan", phone: "+1 555 011 2200", email: "sales@medipharm.example" },
  { name: "BioCure Supplies", contactPerson: "James Lee", phone: "+1 555 011 3300", email: "orders@biocure.example" },
  { name: "CardioLab Medical", contactPerson: "Priya Nair", phone: "+1 555 011 4400", email: "supply@cardiolab.example" },
];

const EQUIPMENT_SEED = [
  { name: "ECG Monitor", category: "MONITORING", manufacturer: "Philips", serialNo: "PH-ECG-2210", purchaseCost: 4200, warrantyExpiry: new Date(Date.now() + 700 * 24 * 3600 * 1000), location: "ICU — Room 1", nextMaintenance: new Date(Date.now() + 30 * 24 * 3600 * 1000) },
  { name: "Ventilator", category: "SUPPORT", manufacturer: "Draeger", serialNo: "DR-VNT-8841", purchaseCost: 18500, warrantyExpiry: new Date(Date.now() + 500 * 24 * 3600 * 1000), location: "ICU — Room 2", nextMaintenance: new Date(Date.now() - 5 * 24 * 3600 * 1000) },
  { name: "Ultrasound Machine", category: "DIAGNOSTIC", manufacturer: "GE Healthcare", serialNo: "GE-US-3317", purchaseCost: 24000, warrantyExpiry: new Date(Date.now() + 40 * 24 * 3600 * 1000), location: "Radiology", nextMaintenance: new Date(Date.now() + 60 * 24 * 3600 * 1000) },
  { name: "Defibrillator", category: "SUPPORT", manufacturer: "Zoll", serialNo: "ZL-DEF-9922", purchaseCost: 3900, warrantyExpiry: new Date(Date.now() + 900 * 24 * 3600 * 1000), location: "Emergency", nextMaintenance: new Date(Date.now() + 90 * 24 * 3600 * 1000) },
  { name: "Surgical Cautery", category: "SURGICAL", manufacturer: "Stryker", serialNo: "ST-CAU-5510", purchaseCost: 6100, warrantyExpiry: new Date(Date.now() - 10 * 24 * 3600 * 1000), location: "OT — Room 1", nextMaintenance: new Date(Date.now() + 45 * 24 * 3600 * 1000) },
  { name: "Infusion Pump", category: "SUPPORT", manufacturer: "B Braun", serialNo: "BB-INF-1204", purchaseCost: 2100, warrantyExpiry: new Date(Date.now() + 800 * 24 * 3600 * 1000), location: "Ward B", nextMaintenance: new Date(Date.now() + 20 * 24 * 3600 * 1000) },
];

async function seedPharmacy() {
  for (const s of SUPPLIER_SEED) {
    await prisma.supplier.upsert({
      where: { name: s.name },
      update: {},
      create: s,
    });
  }
  console.log(`✔ ${SUPPLIER_SEED.length} suppliers`);

  for (const m of MEDICINE_SEED) {
    await prisma.medicine.upsert({
      where: { name: m.name },
      update: {},
      create: m,
    });
  }
  console.log(`✔ ${MEDICINE_SEED.length} medicines`);

  const supplier = await prisma.supplier.findFirst({ where: { name: SUPPLIER_SEED[0].name } });
  const amox = await prisma.medicine.findUnique({ where: { name: "Amoxicillin" } });
  if (supplier && amox) {
    const poNo = "PO-0001";
    await prisma.purchaseOrder.upsert({
      where: { poNo },
      update: {},
      create: {
        poNo,
        supplierId: supplier.id,
        items: JSON.stringify([
          { medicineId: amox.id, name: amox.name, quantity: 300, unitCost: 2.1, batchNo: "AMX-2207", expiryDate: new Date(Date.now() + 240 * 24 * 3600 * 1000).toISOString() },
        ]),
        total: 630,
        status: "ORDERED",
      },
    });
    console.log("✔ 1 purchase order (PO-0001)");
  }

  for (const e of EQUIPMENT_SEED) {
    const existing = await prisma.medicalEquipment.findUnique({ where: { code: `EQ-${String(EQUIPMENT_SEED.indexOf(e) + 1).padStart(4, "0")}` } });
    if (existing) continue;
    await prisma.medicalEquipment.create({
      data: {
        code: `EQ-${String(EQUIPMENT_SEED.indexOf(e) + 1).padStart(4, "0")}`,
        ...e,
      },
    });
  }
  console.log(`✔ ${EQUIPMENT_SEED.length} equipment`);
}

async function seedHr() {
  const hospital = await prisma.hospital.findFirst();
  const hospitalId = hospital?.id ?? undefined;

  const depts = await prisma.department.findMany();
  const dept = (code: string) => depts.find((d) => d.code === code)?.id ?? null;

  const employeeSeed: {
    email: string;
    employeeNo: string;
    designation: string;
    deptCode: string;
    salary: number;
    allowances: number;
    employmentType: string;
    joiningDate: string;
    status: string;
  }[] = [
    { email: "hospital@hospital.com", employeeNo: "EMP-0001", designation: "Hospital Administrator", deptCode: "GENMED", salary: 6200, allowances: 500, employmentType: "FULL_TIME", joiningDate: "2019-03-01", status: "ACTIVE" },
    { email: "account@hospital.com", employeeNo: "EMP-0002", designation: "Senior Accountant", deptCode: "GENMED", salary: 4100, allowances: 300, employmentType: "FULL_TIME", joiningDate: "2020-07-15", status: "ACTIVE" },
    { email: "pharmacist@hospital.com", employeeNo: "EMP-0003", designation: "Chief Pharmacist", deptCode: "GENMED", salary: 3800, allowances: 250, employmentType: "FULL_TIME", joiningDate: "2021-01-10", status: "ACTIVE" },
    { email: "lab@hospital.com", employeeNo: "EMP-0004", designation: "Lab Technician", deptCode: "GENMED", salary: 2900, allowances: 200, employmentType: "FULL_TIME", joiningDate: "2022-04-05", status: "ACTIVE" },
    { email: "reception@hospital.com", employeeNo: "EMP-0005", designation: "Front Desk Receptionist", deptCode: "GENMED", salary: 2400, allowances: 150, employmentType: "FULL_TIME", joiningDate: "2023-08-20", status: "ACTIVE" },
    { email: "nurse@hospital.com", employeeNo: "EMP-0006", designation: "Head Nurse", deptCode: "PED", salary: 3500, allowances: 220, employmentType: "FULL_TIME", joiningDate: "2020-11-02", status: "ON_LEAVE" },
  ];

  const employeeIds: { id: string; employeeNo: string }[] = [];
  for (const s of employeeSeed) {
    const user = await prisma.user.findUnique({ where: { email: s.email } });
    if (!user) continue;
    const employee = await prisma.employee.upsert({
      where: { employeeNo: s.employeeNo },
      update: { status: s.status, salary: s.salary, allowances: s.allowances },
      create: {
        userId: user.id,
        employeeNo: s.employeeNo,
        departmentId: dept(s.deptCode),
        designation: s.designation,
        employmentType: s.employmentType,
        joiningDate: new Date(s.joiningDate),
        salary: s.salary,
        allowances: s.allowances,
        bankName: "First National Bank",
        bankAccountNo: `0044-${s.employeeNo.slice(-4)}`,
        bankIfsc: `FNBL000${s.employeeNo.slice(-1)}`,
        status: s.status,
        hospitalId,
      },
    });
    employeeIds.push({ id: employee.id, employeeNo: s.employeeNo });
  }
  console.log(`✔ ${employeeIds.length} employees`);

  const now = new Date();
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const month = ymd(now).slice(0, 7);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rows: {
    employeeId: string;
    date: string;
    status: string;
    checkIn: string;
    checkOut: string;
    hoursWorked: number | null;
    hospitalId?: string;
  }[] = [];
  for (const emp of employeeIds) {
    for (let d = new Date(today.getTime()); d.getTime() <= today.getTime(); d.setDate(d.getDate() - 1)) {
      if (rows.length >= 180) break;
      const day = d.getDay();
      if (day === 0 || day === 6) continue;
      const dateStr = ymd(d);
      const dayOfMonth = d.getDate();
      let status = "PRESENT";
      const checkIn = "09:00";
      const checkOut = "17:00";
      if (dayOfMonth === 3) status = "ABSENT";
      if (dayOfMonth === 14) status = "HALF_DAY";
      if (dayOfMonth === 21 && emp.employeeNo === "EMP-0006") status = "LEAVE";
      rows.push({
        employeeId: emp.id,
        date: dateStr,
        status,
        checkIn,
        checkOut,
        hoursWorked: status === "PRESENT" ? 8 : status === "HALF_DAY" ? 4 : null,
        hospitalId,
      });
    }
  }
  if (rows.length) {
    await prisma.attendance.deleteMany({ where: { date: { startsWith: ymd(today).slice(0, 7) } } });
    const earliest = rows[rows.length - 1].date;
    await prisma.attendance.deleteMany({ where: { date: { gte: earliest } } });
    await prisma.attendance.createMany({ data: rows });
  }
  console.log(`✔ ${rows.length} attendance records for ${month}`);

  const adminUser = await prisma.user.findUnique({ where: { email: "hospital@hospital.com" } });
  const emp1 = employeeIds[1]; // accountant
  const emp5 = employeeIds[5]; // head nurse
  if (emp1) {
    await prisma.leave.upsert({
      where: { leaveNo: "LV-0001" },
      update: {},
      create: {
        leaveNo: "LV-0001",
        employeeId: emp1.id,
        type: "ANNUAL",
        fromDate: new Date(now.getFullYear(), now.getMonth(), 18),
        toDate: new Date(now.getFullYear(), now.getMonth(), 20),
        days: 3,
        reason: "Family event",
        status: "PENDING",
        hospitalId,
      },
    });
  }
  if (emp5 && adminUser) {
    await prisma.leave.upsert({
      where: { leaveNo: "LV-0002" },
      update: {},
      create: {
        leaveNo: "LV-0002",
        employeeId: emp5.id,
        type: "SICK",
        fromDate: new Date(now.getFullYear(), now.getMonth(), 10),
        toDate: new Date(now.getFullYear(), now.getMonth(), 12),
        days: 3,
        reason: "Medical leave",
        status: "APPROVED",
        approverId: adminUser.id,
        decidedAt: new Date(),
        hospitalId,
      },
    });
  }
  console.log("✔ 2 leave requests");

  for (const emp of employeeIds) {
    const record = await prisma.employee.findUnique({ where: { id: emp.id } });
    if (!record) continue;
    const bonus = emp.employeeNo === "EMP-0001" ? 400 : 0;
    const netPay = Math.round((record.salary + record.allowances + bonus) * 100) / 100;
    await prisma.payroll.upsert({
      where: { employeeId_month: { employeeId: emp.id, month } },
      update: {},
      create: {
        employeeId: emp.id,
        month,
        basicSalary: record.salary,
        allowances: record.allowances,
        bonus,
        netPay,
        status: emp.employeeNo === "EMP-0001" ? "PAID" : "GENERATED",
        paidAt: emp.employeeNo === "EMP-0001" ? new Date() : null,
        hospitalId,
      },
    });
  }
  console.log(`✔ ${employeeIds.length} payroll records for ${month}`);
}

async function seedNotifications() {
  const hospital = await prisma.hospital.findFirst();
  if (!hospital) return;
  const hospitalId = hospital.id;

  const targets = await prisma.user.findMany({
    where: {
      OR: [
        { email: "hospital@hospital.com" },
        { email: "admin@hospital.com" },
        { email: "pharmacist@hospital.com" },
        { email: "doctor@hospital.com" },
      ],
    },
    select: { id: true, email: true },
  });

  const samples: Array<{
    email: string;
    title: string;
    message: string;
    type: string;
    createdAt: Date;
  }> = [
    {
      email: "hospital@hospital.com",
      title: "Welcome to HMS",
      message: "Your hospital workspace is ready. Explore patients, billing and reports.",
      type: "SYSTEM",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26),
    },
    {
      email: "admin@hospital.com",
      title: "Low stock: Amoxicillin",
      message: "Amoxicillin 500mg is below reorder level. Reorder to avoid shortages.",
      type: "STOCK_ALERT",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
    },
    {
      email: "pharmacist@hospital.com",
      title: "Expiring: Paracetamol syrup",
      message: "Paracetamol 120mg/5ml syrup expires within 30 days. Check inventory.",
      type: "EXPIRY_ALERT",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
    },
    {
      email: "doctor@hospital.com",
      title: "Upcoming appointments",
      message: "You have appointments scheduled today. View them from the dashboard.",
      type: "APPOINTMENT",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 1),
    },
    {
      email: "hospital@hospital.com",
      title: "Payroll run completed",
      message: "August payroll was generated for 6 employees. Review and mark as paid.",
      type: "HR",
      createdAt: new Date(Date.now() - 1000 * 60 * 30),
    },
  ];

  let created = 0;
  for (const sample of samples) {
    const target = targets.find((t) => t.email === sample.email);
    if (!target) continue;
    const exists = await prisma.notification.findFirst({
      where: { userId: target.id, title: sample.title },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.notification.create({
      data: {
        userId: target.id,
        title: sample.title,
        message: sample.message,
        type: sample.type,
        hospitalId,
        createdAt: sample.createdAt,
      },
    });
    created++;
  }
  console.log(`✔ ${created} notifications`);
}

async function seedPhase9() {
  const hospital = await prisma.hospital.findFirst();
  if (!hospital) return;
  const hospitalId = hospital.id;

  const patients = await prisma.patient.findMany({ orderBy: { createdAt: "asc" }, take: 3 });
  const doctor = await prisma.doctor.findFirst({ include: { user: true } });
  const admin = await prisma.user.findUnique({ where: { email: "hospital@hospital.com" } });
  if (!patients.length || !doctor || !admin) return;

  // Emergency cases
  const existingCases = await prisma.emergencyCase.count();
  if (existingCases === 0) {
    const samples = [
      {
        caseNo: "ER-0001",
        patientId: patients[0]?.id ?? null,
        walkInName: patients[0] ? null : "Unknown male",
        walkInPhone: "+1 555 014 2211",
        age: 34,
        gender: "MALE",
        triageLevel: "RED",
        condition: "Chest pain, suspected cardiac event",
        vitals: JSON.stringify({ bp: "180/110", pulse: "112", temp: "37.1", spo2: "94", rr: "22" }),
        status: "IN_PROGRESS",
        ambulanceRequested: true,
        ambulanceDispatchedAt: new Date(Date.now() - 1000 * 60 * 42),
        ambulanceEtaMinutes: 8,
        ambulanceNotes: "Unit 2 dispatched from East depot.",
        createdAt: new Date(Date.now() - 1000 * 60 * 50),
      },
      {
        caseNo: "ER-0002",
        patientId: patients[1]?.id ?? null,
        walkInName: null,
        walkInPhone: null,
        age: 28,
        gender: "FEMALE",
        triageLevel: "ORANGE",
        condition: "Road traffic accident, possible fracture",
        vitals: JSON.stringify({ bp: "120/80", pulse: "98", temp: "36.8", spo2: "97", rr: "18" }),
        status: "WAITING",
        ambulanceRequested: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 18),
      },
      {
        caseNo: "ER-0003",
        patientId: null,
        walkInName: "Arjun Nair",
        walkInPhone: "+1 555 014 9988",
        age: 52,
        gender: "MALE",
        triageLevel: "YELLOW",
        condition: "Severe abdominal pain",
        vitals: JSON.stringify({ bp: "135/85", pulse: "88", temp: "37.4", spo2: "98", rr: "16" }),
        status: "STABILIZED",
        ambulanceRequested: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
      },
    ];

    for (const s of samples) {
      const created = await prisma.emergencyCase.create({
        data: {
          ...s,
          assignedDoctorId: doctor.id,
          createdById: admin.id,
          hospitalId,
        },
      });
      await prisma.emergencyEvent.create({
        data: {
          caseId: created.id,
          type: "NOTE",
          note: `Case opened. Triage: ${s.triageLevel}.`,
          createdById: admin.id,
          createdAt: s.createdAt,
        },
      });
      if (s.ambulanceDispatchedAt) {
        await prisma.emergencyEvent.create({
          data: {
            caseId: created.id,
            type: "AMBULANCE",
            note: `Ambulance dispatched, ETA ${s.ambulanceEtaMinutes} min — ${s.ambulanceNotes}.`,
            createdById: admin.id,
            createdAt: s.ambulanceDispatchedAt,
          },
        });
      }
    }
    console.log("✔ 3 emergency cases");
  } else {
    console.log("✔ emergency cases (already present)");
  }

  // Medical records
  const recordsExist = await prisma.medicalRecord.count();
  if (recordsExist === 0) {
    const records = [
      { patientId: patients[0]!.id, type: "DIAGNOSIS", title: "Hypertension diagnosed", summary: "Stage 2 hypertension. Started on Amlodipine 5mg. Lifestyle counseling given.", daysAgo: 20 },
      { patientId: patients[0]!.id, type: "LAB", title: "CBC — full blood count", summary: "Hemoglobin 13.2 g/dL, WBC 6.4, platelets 240k. Within normal limits.", daysAgo: 12 },
      { patientId: patients[1]!.id, type: "PRESCRIPTION", title: "Antibiotic course", summary: "Amoxicillin 500mg TDS for 7 days for respiratory infection.", daysAgo: 6 },
      { patientId: patients[1]!.id, type: "RADIOLOGY", title: "Chest X-ray PA view", summary: "No acute cardiopulmonary abnormality. Heart size normal.", daysAgo: 3 },
    ];
    for (const r of records) {
      const no = await prisma.medicalRecord.count();
      await prisma.medicalRecord.create({
        data: {
          recordNo: `MR-${String(no + 1).padStart(4, "0")}`,
          patientId: r.patientId,
          type: r.type,
          title: r.title,
          summary: r.summary,
          doctorId: doctor.id,
          hospitalId,
          createdAt: new Date(Date.now() - r.daysAgo * 86400_000),
        },
      });
    }
    console.log("✔ 4 medical records");
  } else {
    console.log("✔ medical records (already present)");
  }

  // Prescriptions (standalone, QR-verifiable)
  const rxExist = await prisma.prescription.count();
  if (rxExist === 0) {
    const consultation = await prisma.consultation.findFirst({
      where: { patientId: patients[0]!.id },
      orderBy: { createdAt: "desc" },
    });
    const samples = [
      {
        patientId: patients[0]!.id,
        diagnosis: "Hypertension",
        notes: "Monitor BP daily. Review in 2 weeks.",
        items: JSON.stringify([
          { medicine: "Amlodipine", dose: "5 mg", frequency: "1× daily", duration: "30 days", instructions: "Morning, after food" },
          { medicine: "Vitamin D3", dose: "1000 IU", frequency: "1× daily", duration: "60 days", instructions: "With meals" },
        ]),
      },
      {
        patientId: patients[1]!.id,
        diagnosis: "Acute bronchitis",
        notes: "Complete full course even if symptoms improve.",
        items: JSON.stringify([
          { medicine: "Amoxicillin", dose: "500 mg", frequency: "3× daily", duration: "7 days", instructions: "After meals" },
          { medicine: "Paracetamol", dose: "650 mg", frequency: "As needed", duration: "5 days", instructions: "Max 4 doses/day" },
        ]),
      },
    ];
    for (const s of samples) {
      const no = await prisma.prescription.count();
      await prisma.prescription.create({
        data: {
          prescriptionNo: `RX-${String(no + 1).padStart(4, "0")}`,
          patientId: s.patientId,
          doctorId: doctor.id,
          consultationId: consultation?.id ?? null,
          diagnosis: s.diagnosis,
          notes: s.notes,
          items: s.items,
          hospitalId,
          issuedAt: new Date(Date.now() - (no + 1) * 86400_000),
        },
      });
    }
    console.log("✔ 2 prescriptions");
  } else {
    console.log("✔ prescriptions (already present)");
  }
}

// ============================================================================
// Phase 10 — spec-scale dataset. Idempotent top-ups: each function only
// creates the difference between the current count and the target.
// ============================================================================

const FIRST_NAMES = [
  "James", "Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan", "Sophia", "Mason", "Isabella",
  "Lucas", "Mia", "Alexander", "Charlotte", "Daniel", "Amelia", "Henry", "Harper", "Sebastian", "Evelyn",
  "Jack", "Abigail", "Owen", "Emily", "Gabriel", "Ella", "Julian", "Scarlett", "Leo", "Grace",
  "Adam", "Layla", "Rayan", "Zoya", "Kabir", "Meera", "Arnav", "Diya", "Vihaan", "Ananya",
  "Ibrahim", "Fatima", "Omar", "Hana", "Yusuf", "Noor", "Khalid", "Amira", "Tariq", "Sana",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
  "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
  "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
  "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
  "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts",
];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const INSURERS = ["BlueShield", "Aetna", "Cigna", "Medicare", "Medicaid", "UnitedHealth", "Humana"];
const ALLERGY_POOL = ["Penicillin", "Sulfa", "Aspirin", "Latex", "Peanuts", "Iodine", "Codeine"];

const DEPT_POOL = [
  { name: "Dermatology", code: "DERM" },
  { name: "ENT", code: "ENT" },
  { name: "Ophthalmology", code: "OPHTH" },
  { name: "Psychiatry", code: "PSYCH" },
  { name: "Gastroenterology", code: "GASTRO" },
  { name: "Pulmonology", code: "PULM" },
];

const MEDICINE_POOL = [
  "Amlodipine", "Metformin", "Atorvastatin", "Lisinopril", "Omeprazole", "Paracetamol", "Ibuprofen",
  "Amoxicillin", "Azithromycin", "Ciprofloxacin", "Ceftriaxone", "Metronidazole", "Doxycycline",
  "Fluoxetine", "Sertraline", "Escitalopram", "Alprazolam", "Lorazepam", "Diazepam", "Olanzapine",
  "Prednisone", "Hydrocortisone", "Dexamethasone", "Salbutamol", "Budesonide", "Montelukast",
  "Cetirizine", "Loratadine", "Fexofenadine", "Diphenhydramine", "Losartan", "Telmisartan",
  "Valsartan", "Metoprolol", "Propranolol", "Carvedilol", "Furosemide", "Spironolactone",
  "Hydrochlorothiazide", "Insulin Glargine", "Insulin Lispro", "Glimepiride", "Sitagliptin",
  "Warfarin", "Apixaban", "Rivaroxaban", "Clopidogrel", "Aspirin", "Nitroglycerin",
];

const MEDICINE_CATEGORIES = ["ANALGESIC", "ANTIBIOTIC", "ANTIPYRETIC", "ANTACID", "VITAMIN", "ANTIALLERGIC", "CARDIAC", "DIABETIC", "RESPIRATORY", "GENERAL"];

const DIAGNOSIS_POOL = [
  "Hypertension", "Type 2 diabetes", "Lower respiratory infection", "Acute gastroenteritis",
  "Migraine", "Cervical spondylosis", "Iron deficiency anemia", "Urinary tract infection",
  "Gastroesophageal reflux", "Hypothyroidism", "Osteoarthritis", "Acute bronchitis",
  "Dengue fever", "Cellulitis", "Peptic ulcer disease", "Asthma exacerbation",
];

const LAB_TESTS = [
  { name: "Complete Blood Count", code: "CBC", unit: "—", normalRange: "See report" },
  { name: "Hemoglobin", code: "HB", unit: "g/dL", normalRange: "13.0–17.0" },
  { name: "Blood Sugar (Fasting)", code: "FBS", unit: "mg/dL", normalRange: "70–100" },
  { name: "HbA1c", code: "A1C", unit: "%", normalRange: "4.0–5.6" },
  { name: "Total Cholesterol", code: "CHOL", unit: "mg/dL", normalRange: "<200" },
  { name: "Liver Function (ALT)", code: "ALT", unit: "U/L", normalRange: "7–56" },
  { name: "Kidney Function (Creatinine)", code: "CREAT", unit: "mg/dL", normalRange: "0.6–1.3" },
  { name: "Thyroid (TSH)", code: "TSH", unit: "mIU/L", normalRange: "0.4–4.0" },
  { name: "Urine Analysis", code: "UA", unit: "—", normalRange: "Normal" },
  { name: "Lipid Profile", code: "LIPID", unit: "mg/dL", normalRange: "LDL <100" },
];

const STAFF_TITLES = ["Dr.", "Prof. Dr.", "Dr. (Maj)", "Asst. Prof. Dr."];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pad(n: number): string {
  return String(n).padStart(4, "0");
}

/** Runs `fn` over items in bounded-parallel chunks (fast on remote DBs). */
async function runBatch<T>(items: T[], fn: (item: T) => Promise<unknown>, size = 25): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

async function topUpPatients(target: number) {
  const hospital = await prisma.hospital.findFirst();
  const existing = await prisma.patient.count();
  const need = target - existing;
  if (need <= 0) {
    console.log(`✔ patients (already ${existing})`);
    return;
  }
  const rows = Array.from({ length: need }, (_, i) => {
    const no = existing + i + 1;
    return {
      patientNo: `PT-${pad(no)}`,
      firstName: pick(FIRST_NAMES),
      lastName: pick(LAST_NAMES),
      dob: new Date(Date.now() - (18 + Math.floor(Math.random() * 60)) * 365.25 * 86400_000),
      bloodGroup: pick(BLOOD_GROUPS),
      phone: `+1 555 300 0${String(no).padStart(4, "0")}`,
      allergies: Math.random() < 0.25 ? pick(ALLERGY_POOL) : null,
      insuranceProvider: Math.random() < 0.7 ? pick(INSURERS) : null,
      hospitalId: hospital?.id ?? null,
    };
  });
  await runBatch(rows, (data) => prisma.patient.create({ data }));
  console.log(`✔ +${need} patients (total ${target})`);
}

async function topUpDepartments(target: number) {
  const existing = await prisma.department.count();
  const need = target - existing;
  if (need <= 0) {
    console.log(`✔ departments (already ${existing})`);
    return;
  }
  for (let i = 0; i < need; i++) {
    const d = DEPT_POOL[i];
    if (!d) break;
    await prisma.department.create({
      data: { name: d.name, code: d.code, description: `${d.name} department`, hospitalId: (await prisma.hospital.findFirst())?.id ?? null },
    });
  }
  console.log(`✔ +${Math.min(need, DEPT_POOL.length)} departments`);
}

async function topUpDoctors(target: number) {
  const hospital = await prisma.hospital.findFirst();
  const departments = await prisma.department.findMany();
  const role = await prisma.role.findUnique({ where: { name: "DOCTOR" } });
  if (!role) return;
  const existing = await prisma.doctor.count();
  const need = target - existing;
  if (need <= 0) {
    console.log(`✔ doctors (already ${existing})`);
    return;
  }
  for (let i = 0; i < need; i++) {
    const no = existing + i + 1;
    const email = `doctor${no}@hospital.com`;
    if (await prisma.user.findUnique({ where: { email } })) continue;
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const user = await prisma.user.create({
      data: {
        email,
        firstName: first,
        lastName: last,
        title: pick(STAFF_TITLES),
        passwordHash: await hashPassword("Doctor@1234"),
        roleId: role.id,
        hospitalId: hospital?.id ?? null,
        emailVerified: true,
      },
    });
    const dept = departments[no % departments.length];
    await prisma.doctor.create({
      data: {
        userId: user.id,
        departmentId: dept?.id ?? null,
        specialization: dept?.name ?? "General Medicine",
        qualification: "MD",
        experienceYears: 2 + (no % 25),
        consultationFee: 60 + (no % 15) * 15,
        licenseNumber: `MD-SC-${10000 + no}`,
        available: true,
      },
    });
  }
  console.log(`✔ +${need} doctors (total ${target})`);
}

async function topUpNurses(target: number) {
  const hospital = await prisma.hospital.findFirst();
  const departments = await prisma.department.findMany();
  const role = await prisma.role.findUnique({ where: { name: "NURSE" } });
  if (!role) return;
  const existing = await prisma.nurse.count();
  const need = target - existing;
  if (need <= 0) {
    console.log(`✔ nurses (already ${existing})`);
    return;
  }
  for (let i = 0; i < need; i++) {
    const no = existing + i + 1;
    const email = `nurse${no}@hospital.com`;
    if (await prisma.user.findUnique({ where: { email } })) continue;
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const user = await prisma.user.create({
      data: {
        email,
        firstName: first,
        lastName: last,
        passwordHash: await hashPassword("Nurse@1234"),
        roleId: role.id,
        hospitalId: hospital?.id ?? null,
        emailVerified: true,
      },
    });
    const dept = departments[no % departments.length];
    await prisma.nurse.create({
      data: {
        userId: user.id,
        departmentId: dept?.id ?? null,
        ward: `Ward ${String.fromCharCode(65 + (no % 5))}`,
        shift: pick(["DAY", "NIGHT", "EVENING"]),
        licenseNo: `RN-${50000 + no}`,
        designation: pick(["Staff Nurse", "Senior Nurse", "Charge Nurse"]),
      },
    });
  }
  console.log(`✔ +${need} nurses (total ${target})`);
}

async function topUpMedicines(target: number) {
  const hospital = await prisma.hospital.findFirst();
  const existing = await prisma.medicine.count();
  const need = target - existing;
  if (need <= 0) {
    console.log(`✔ medicines (already ${existing})`);
    return;
  }
  const rows = Array.from({ length: need }, (_, i) => {
    const no = existing + i + 1;
    return {
      name: `${MEDICINE_POOL[no % MEDICINE_POOL.length]}${no > MEDICINE_POOL.length ? " XR" : ""} ${10 + (no % 8) * 10}mg`,
      category: pick(MEDICINE_CATEGORIES),
      price: Math.round((2 + Math.random() * 90) * 100) / 100,
      stock: Math.floor(Math.random() * 450) + 10,
      reorderLevel: 10 + Math.floor(Math.random() * 40),
      expiryDate: new Date(Date.now() + (90 + Math.floor(Math.random() * 700)) * 86400_000),
      hospitalId: hospital?.id ?? null,
    };
  });
  await runBatch(rows, (data) => prisma.medicine.create({ data }));
  console.log(`✔ +${need} medicines (total ${target})`);
}

async function topUpAppointments(target: number) {
  const hospital = await prisma.hospital.findFirst();
  const doctors = await prisma.doctor.findMany();
  const patients = await prisma.patient.findMany();
  const admin = await prisma.user.findUnique({ where: { email: "hospital@hospital.com" } });
  if (!doctors.length || !patients.length) return;
  const existing = await prisma.appointment.count();
  const need = target - existing;
  if (need <= 0) {
    console.log(`✔ appointments (already ${existing})`);
    return;
  }
  const slots = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "14:00", "14:30", "15:00", "15:30", "16:00"];
  const statusPool = ["CONFIRMED", "CONFIRMED", "PENDING", "COMPLETED", "COMPLETED", "CANCELLED", "MISSED"];
  const rows = Array.from({ length: need }, (_, i) => {
    const no = existing + i + 1;
    const doctor = pick(doctors);
    const slot = pick(slots);
    const [hh, mm] = slot.split(":").map(Number);
    const startMin = hh * 60 + mm;
    const endMin = startMin + 30;
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + Math.floor(Math.random() * 61) - 30);
    return {
      tokenNo: `TKN-${pad(no)}`,
      patientId: pick(patients).id,
      doctorId: doctor.id,
      departmentId: doctor.departmentId,
      date,
      startTime: slot,
      endTime: `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`,
      type: pick(["ONLINE", "WALKIN", "FOLLOWUP"]),
      status: pick(statusPool),
      createdById: admin?.id ?? null,
    };
  });
  await runBatch(rows, (data) => prisma.appointment.create({ data }));
  console.log(`✔ +${need} appointments (total ${target})`);
}

async function topUpInvoices(target: number) {
  const hospital = await prisma.hospital.findFirst();
  const patients = await prisma.patient.findMany();
  const admin = await prisma.user.findUnique({ where: { email: "hospital@hospital.com" } });
  if (!patients.length) return;
  const existing = await prisma.invoice.count();
  const need = target - existing;
  if (need <= 0) {
    console.log(`✔ invoices (already ${existing})`);
    return;
  }
  const invoices = Array.from({ length: need }, (_, i) => {
    const no = existing + i + 1;
    const subtotal = Math.round((50 + Math.random() * 1950) * 100) / 100;
    const taxRate = hospital?.taxRate ?? 0;
    const total = Math.round(subtotal * (1 + taxRate / 100) * 100) / 100;
    const status = pick(["PENDING", "PENDING", "PARTIAL", "PAID", "PAID", "PAID", "CANCELLED"]);
    const paid = status === "PAID" ? total : status === "PARTIAL" ? Math.round(total * (0.3 + Math.random() * 0.4) * 100) / 100 : 0;
    const createdAt = new Date(Date.now() - Math.floor(Math.random() * 120) * 86400_000);
    return {
      no,
      invoiceNo: `INV-${pad(no)}`,
      patientId: pick(patients).id,
      subtotal,
      taxRate,
      total,
      paid,
      status,
      notes: null,
      issuedById: admin?.id ?? null,
      hospitalId: hospital?.id ?? null,
      createdAt,
    };
  });
  await runBatch(invoices, async (inv) => {
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNo: inv.invoiceNo,
        patientId: inv.patientId,
        subtotal: inv.subtotal,
        taxRate: inv.taxRate,
        total: inv.total,
        paid: inv.paid,
        status: inv.status,
        notes: inv.notes,
        issuedById: inv.issuedById,
        hospitalId: inv.hospitalId,
        createdAt: inv.createdAt,
      },
    });
    if (inv.paid > 0) {
      await prisma.payment.create({
        data: {
          paymentNo: `PAY-${pad(inv.no)}`,
          invoiceId: invoice.id,
          amount: inv.paid,
          method: pick(["CASH", "CARD", "BANK_TRANSFER", "INSURANCE"]),
          receivedById: admin?.id ?? null,
          paidAt: new Date(inv.createdAt.getTime() + 86400_000),
          hospitalId: hospital?.id ?? null,
        },
      });
    }
  });
  console.log(`✔ +${need} invoices (total ${target})`);
}

async function topUpAdmissions(target: number) {
  const hospital = await prisma.hospital.findFirst();
  const patients = await prisma.patient.findMany();
  const doctors = await prisma.doctor.findMany();
  if (!patients.length || !doctors.length) return;
  const existing = await prisma.admission.count();
  const need = target - existing;
  if (need <= 0) {
    console.log(`✔ admissions (already ${existing})`);
    return;
  }
  const rows = Array.from({ length: need }, (_, i) => {
    const no = existing + i + 1;
    const roll = Math.random();
    const status = roll < 0.25 ? "DISCHARGED" : roll < 0.3 ? "TRANSFERRED" : "ADMITTED";
    const admittedAt = new Date(Date.now() - Math.floor(Math.random() * 90) * 86400_000);
    return {
      admissionNo: `IPD-${pad(no)}`,
      patientId: pick(patients).id,
      doctorId: pick(doctors).id,
      bedId: null,
      status,
      diagnosis: pick(DIAGNOSIS_POOL),
      notes: Math.random() < 0.5 ? "Admitted for observation and further evaluation." : null,
      admittedAt,
      dischargeAt: status === "DISCHARGED" ? new Date(admittedAt.getTime() + (2 + Math.floor(Math.random() * 10)) * 86400_000) : null,
      hospitalId: hospital?.id ?? null,
    };
  });
  await runBatch(rows, (data) => prisma.admission.create({ data }));
  console.log(`✔ +${need} admissions (total ${target})`);
}

async function topUpLabOrders(target: number) {
  const hospital = await prisma.hospital.findFirst();
  const patients = await prisma.patient.findMany();
  const doctors = await prisma.doctor.findMany();
  const admin = await prisma.user.findUnique({ where: { email: "hospital@hospital.com" } });
  if (!patients.length || !doctors.length) return;
  const existing = await prisma.labOrder.count();
  const need = target - existing;
  if (need <= 0) {
    console.log(`✔ lab orders (already ${existing})`);
    return;
  }
  const rows = Array.from({ length: need }, (_, i) => {
    const no = existing + i + 1;
    const testCount = 1 + Math.floor(Math.random() * 3);
    const tests = Array.from({ length: testCount }, () => pick(LAB_TESTS));
    const status = pick(["COMPLETED", "COMPLETED", "COMPLETED", "SAMPLE_COLLECTED", "ORDERED", "CANCELLED"]);
    const results = status === "COMPLETED"
      ? JSON.stringify(tests.map((t) => ({ testId: t.code, name: t.name, value: String(50 + Math.floor(Math.random() * 150)), unit: t.unit, normalRange: t.normalRange, flag: Math.random() < 0.2 ? "HIGH" : "NORMAL" })))
      : "[]";
    return {
      orderNo: `LAB-${pad(no)}`,
      patientId: pick(patients).id,
      doctorId: pick(doctors).id,
      status,
      tests: JSON.stringify(tests.map((t) => ({ testId: t.code, name: t.name, code: t.code, unit: t.unit, normalRange: t.normalRange }))),
      results,
      createdById: admin?.id ?? null,
      hospitalId: hospital?.id ?? null,
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 60) * 86400_000),
    };
  });
  await runBatch(rows, (data) => prisma.labOrder.create({ data }));
  console.log(`✔ +${need} lab orders (total ${target})`);
}

async function topUpLabTests(target: number) {
  const hospital = await prisma.hospital.findFirst();
  const existing = await prisma.labTest.count();
  let created = 0;
  for (const t of LAB_TESTS) {
    const no = LAB_TESTS.indexOf(t) + 1;
    if (no > target) break;
    const exists = await prisma.labTest.findUnique({ where: { code: t.code } });
    if (exists) continue;
    await prisma.labTest.create({
      data: {
        name: t.name,
        code: t.code,
        category: t.name.includes("Blood") || t.name.includes("Hemoglobin") ? "HEMATOLOGY" : "BIOCHEMISTRY",
        unit: t.unit,
        normalRange: t.normalRange,
        price: 5 + (no % 8) * 5,
        hospitalId: hospital?.id ?? null,
      },
    });
    created++;
  }
  console.log(`✔ +${created} lab tests (total ${existing + created}/${target})`);
}

async function seedPhase10() {
  console.log("\nSeeding spec-scale dataset…");
  await topUpDepartments(10);
  await topUpPatients(150);
  await topUpDoctors(30);
  await topUpNurses(20);
  await topUpMedicines(100);
  await topUpAppointments(500);
  await topUpInvoices(200);
  await topUpAdmissions(100);
  await topUpLabTests(10);
  await topUpLabOrders(50);
  console.log("Spec-scale dataset complete.");
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
  await seedPatients();
  await seedAppointments();
  await seedConsultations();
  await seedPharmacy();
  await seedHr();
  await seedNotifications();
  await seedPhase9();
  await seedPhase10();

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());