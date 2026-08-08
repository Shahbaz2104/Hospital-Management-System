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
    await prisma.attendance.deleteMany({ where: { date: { startsWith: month } } });
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

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());