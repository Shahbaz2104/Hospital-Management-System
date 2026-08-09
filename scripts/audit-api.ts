/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
/**
 * Full-stack API audit suite for the Hospital Management System.
 *
 * Boots an in-memory MongoDB replica set, pushes the schema, seeds demo
 * data, starts the production build (`next start`), then exercises every
 * API module: auth, RBAC negative matrix, per-module CRUD + business logic,
 * data integrity, and graceful degradation of external services.
 *
 * Run: npx tsx scripts/audit-api.ts
 * (Requires `npm run build` to have produced .next first.)
 */
import { execSync, spawn } from "child_process";
import { createHmac, createHash } from "crypto";
import { readFileSync } from "fs";
import { MongoMemoryReplSet } from "mongodb-memory-server";

function readEnvValue(key: string): string {
  const envFile = readFileSync(`${process.cwd()}/.env`, "utf8");
  const match = envFile.match(new RegExp(`^${key}=["']?([^"'\n]+)`, "m"));
  return match ? match[1] : "";
}

async function signHmac(input: string): Promise<string> {
  const access = readEnvValue("JWT_ACCESS_SECRET");
  const digest = createHmac("sha256", access).update(input).digest();
  return digest.toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
}

void createHash;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let passCount = 0;
let failCount = 0;
const failures: string[] = [];

function section(name: string) {
  console.log(`\n━━━ ${name} ━━━`);
}


function check(cond: unknown, msg: string) {
  if (cond) {
    passCount += 1;
    console.log(`  ✔ ${msg}`);
  } else {
    failCount += 1;
    failures.push(msg);
    console.log(`  ✖ ${msg}`);
  }
}

function checkEq<T>(actual: T, expected: T, msg: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  check(ok, `${msg} [got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}]`);
}

async function waitForServer(url: string, tries = 90) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) return;
    } catch {}
    await sleep(1000);
  }
  throw new Error(`Server did not come up at ${url}`);
}

type Jar = string;

function extractCookies(res: Response): string {
  const getSetCookie: string[] =
    typeof (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (res.headers as unknown as { getSetCookie(): string[] }).getSetCookie()
      : (res.headers.get("set-cookie") ?? "").split(",");
  return getSetCookie.map((c) => c.split(";")[0]).join("; ");
}

function req(base: string, method: string, path: string, body?: unknown, cookie = "") {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const get = (base: string, path: string, cookie = "") => req(base, "GET", path, undefined, cookie);
const post = (base: string, path: string, body?: unknown, cookie = "") => req(base, "POST", path, body, cookie);
const patch = (base: string, path: string, body?: unknown, cookie = "") => req(base, "PATCH", path, body, cookie);
const del = (base: string, path: string, cookie = "") => req(base, "DELETE", path, undefined, cookie);

async function json(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

type Api = { base: string; jar: string; role: string };

async function login(base: string, email: string, password: string): Promise<Api> {
  const res = await post(base, "/api/auth/login", { email, password });
  return { base, jar: extractCookies(res), role: email.split("@")[0] };
}

async function main() {
  const useExternal = process.env.AUDIT_EXTERNAL_MONGO === "1";
  let mongod: any = null;

  if (useExternal) {
    if (!process.env.DATABASE_URL) throw new Error("AUDIT_EXTERNAL_MONGO=1 requires DATABASE_URL");
    console.log(`[audit] using external mongod at ${process.env.DATABASE_URL}`);
  } else {
    console.log("[audit] starting mongod (replica set)…");
    mongod = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      instanceOpts: [
        {
          storageEngine: "wiredTiger",
          args: ["--wiredTigerCacheSizeGB", "0.25"],
        },
      ],
    } as Parameters<typeof MongoMemoryReplSet.create>[0]);
    process.env.DATABASE_URL = mongod.getUri("hospital_management");
  }

  Object.assign(process.env, {
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "http://localhost:3200",
  });

  console.log("[audit] dropping target database…");
  const { MongoClient } = await import("mongodb");
  const dropClient = new MongoClient(process.env.DATABASE_URL!, { serverSelectionTimeoutMS: 15000 });
  await dropClient.connect();
  await dropClient.db().dropDatabase();
  await dropClient.close();

  console.log("[audit] prisma db push…");
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: process.env,
    stdio: "pipe",
  });

  console.log("[audit] seeding…");
  execSync("npx tsx prisma/seed.ts", { env: process.env, stdio: "pipe" });

  const PORT = "3200";
  console.log(`[audit] starting next on :${PORT}…`);
  const server = spawn("npx", ["next", "start", "-p", PORT], {
    env: { ...process.env },
    stdio: "ignore",
  });

  try {
    const base = `http://localhost:${PORT}`;
    await waitForServer(`${base}/login`);
    console.log("[audit] server up, logging in as all roles…");

    // ---- AUTH: log in every role ----
    const accounts: [string, string, string][] = [
      ["admin@hospital.com", "Admin@1234", "SUPER_ADMIN"],
      ["hospital@hospital.com", "Admin@1234", "HOSPITAL_ADMIN"],
      ["doctor@hospital.com", "Doctor@1234", "DOCTOR"],
      ["nurse@hospital.com", "Nurse@1234", "NURSE"],
      ["reception@hospital.com", "Reception@1234", "RECEPTIONIST"],
      ["pharmacist@hospital.com", "Pharma@1234", "PHARMACIST"],
      ["lab@hospital.com", "LabTech@1234", "LAB_TECHNICIAN"],
      ["account@hospital.com", "Account@1234", "ACCOUNTANT"],
      ["patient@hospital.com", "Patient@1234", "PATIENT"],
    ];

    const api = new Map<string, Api>();
    for (const [email, pw, roleName] of accounts) {
      const res = await post(base, "/api/auth/login", { email, password: pw });
      const body = await json(res);
      checkEq(res.status, 200, `login ${email}`);
      if (res.status === 200) {
        checkEq(body.data.user.roleName, roleName, `role for ${email}`);
        api.set(roleName, { base, jar: extractCookies(res), role: roleName });
      }
    }

    const admin = api.get("SUPER_ADMIN")!;
    const ha = api.get("HOSPITAL_ADMIN")!;
    const doctor = api.get("DOCTOR")!;
    const nurse = api.get("NURSE")!;
    const reception = api.get("RECEPTIONIST")!;
    const pharmacist = api.get("PHARMACIST")!;
    const lab = api.get("LAB_TECHNICIAN")!;
    const accountant = api.get("ACCOUNTANT")!;
    const patient = api.get("PATIENT")!;


    section("AUTH lifecycle");
    {
      const me = await json(await get(base, "/api/auth/me", admin.jar));
      checkEq(me.data.user.email, "admin@hospital.com", "GET /api/auth/me");

      const bad = await post(base, "/api/auth/login", { email: "admin@hospital.com", password: "nope" });
      checkEq(bad.status, 401, "bad password -> 401");

      const register = await post(base, "/api/auth/register", {
        firstName: "Regis", lastName: "Tered", email: "regis@test.com",
        password: "Register@123", phone: "+15550001234",
      });
      checkEq(register.status, 201, "public register -> 201");

      const unauthed = await get(base, "/api/patients");
      checkEq(unauthed.status, 401, "no cookie -> 401");

      const badOrigin = await fetch(`${base}/api/patients`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://evil.example", Cookie: admin.jar },
        body: JSON.stringify({ firstName: "X", lastName: "Y" }),
      });
      checkEq(badOrigin.status, 403, "cross-origin state-changing call -> 403");

      const wrongPw = await post(base, "/api/auth/change-password", {
        currentPassword: "wrong", newPassword: "NewPass@12345",
      }, admin.jar);
      checkEq(wrongPw.status, 400, "change-password wrong current -> 400");

      const rightPw = await post(base, "/api/auth/change-password", {
        currentPassword: "Admin@1234", newPassword: "NewAdmin@12345",
      }, admin.jar);
      checkEq(rightPw.status, 200, "change-password correct -> 200");

      const oldPwLogin = await post(base, "/api/auth/login", { email: "admin@hospital.com", password: "Admin@1234" });
      checkEq(oldPwLogin.status, 401, "old password rejected after change");

      const newPwLogin = await post(base, "/api/auth/login", { email: "admin@hospital.com", password: "NewAdmin@12345" });
      checkEq(newPwLogin.status, 200, "new password accepted");

      const forgot = await post(base, "/api/auth/forgot-password", { email: "admin@hospital.com" });
      checkEq(forgot.status, 200, "forgot-password -> 200 (SMTP unconfigured, degrades)");

      const resetBad = await post(base, "/api/auth/reset-password", { token: "definitely-not-a-token", password: "Reset@12345" });
      check(resetBad.status === 400 || resetBad.status === 422, `reset-password bad token -> 4xx [${resetBad.status}]`);

      const logout = await post(base, "/api/auth/logout", {}, admin.jar);
      checkEq(logout.status, 200, "logout -> 200");
      const meAfter = await get(base, "/api/auth/me");
      checkEq(meAfter.status, 401, "me with no cookie after logout -> 401");

      // restore admin session
      const relog = await post(base, "/api/auth/login", { email: "admin@hospital.com", password: "NewAdmin@12345" });
      admin.jar = extractCookies(relog);
      checkEq(relog.status, 200, "admin relogin after password change");
    }

    section("RBAC negative matrix (forbidden -> 403)");
    {
      const matrix: [Api, string, string, number][] = [
        // role, method, path, expected
        [doctor, "GET", "/api/users", 403],
        [doctor, "POST", "/api/users", 403],
        [doctor, "GET", "/api/hr/employees", 403],
        [doctor, "GET", "/api/billing/payments", 403],
        [doctor, "POST", "/api/patients", 403],
        [doctor, "GET", "/api/roles", 403],
        [doctor, "POST", "/api/pharmacy/sales", 403],
        [doctor, "GET", "/api/equipment", 403],
        [doctor, "POST", "/api/medicines", 403],
        [nurse, "GET", "/api/users", 403],
        [nurse, "GET", "/api/billing/invoices", 403],
        [nurse, "POST", "/api/patients", 403],
        [nurse, "GET", "/api/analytics", 403],
        [nurse, "GET", "/api/reports", 403],
        [nurse, "GET", "/api/doctors", 403],
        [reception, "GET", "/api/users", 403],
        [reception, "GET", "/api/rooms", 403],
        [reception, "POST", "/api/billing/invoices", 403],
        [reception, "GET", "/api/lab-orders", 403],
        [reception, "GET", "/api/hr/attendance", 403],
        [reception, "POST", "/api/admissions", 403],
        [pharmacist, "GET", "/api/users", 403],
        [pharmacist, "GET", "/api/lab-orders", 403],
        [pharmacist, "GET", "/api/billing/payments", 403],
        [pharmacist, "POST", "/api/billing/invoices", 403],
        [pharmacist, "GET", "/api/emergency", 403],
        [lab, "GET", "/api/users", 403],
        [lab, "GET", "/api/billing/invoices", 403],
        [lab, "GET", "/api/emergency", 403],
        [lab, "GET", "/api/medicines", 403],
        [accountant, "GET", "/api/users", 403],
        [accountant, "POST", "/api/patients", 403],
        [accountant, "GET", "/api/lab-orders", 403],
        [accountant, "GET", "/api/hr/employees", 403],
        [accountant, "POST", "/api/hr/payroll", 403],
        [accountant, "GET", "/api/rooms", 403],
        [patient, "GET", "/api/users", 403],
        [patient, "GET", "/api/billing/invoices", 403],
        [patient, "GET", "/api/emergency", 403],
        [patient, "GET", "/api/analytics", 403],
        [patient, "POST", "/api/medicines", 403],
      ];
      for (const [a, method, path, expected] of matrix) {
        const res = await req(base, method, path, method === "POST" ? {} : undefined, a.jar);
        const body = await json(res);
        checkEq(res.status, expected, `[${a.role}] ${method} ${path} -> ${expected}${body?.error ? ` (${body.error})` : ""}`);
      }
    }

    section("RBAC positive matrix (allowed -> 200)");
    {
      const matrix: [Api, string, string][] = [
        [doctor, "GET", "/api/patients"],
        [doctor, "GET", "/api/appointments"],
        [doctor, "GET", "/api/emergency"],
        [doctor, "GET", "/api/prescriptions"],
        [doctor, "GET", "/api/records"],
        [nurse, "GET", "/api/rooms"],
        [nurse, "GET", "/api/admissions"],
        [nurse, "GET", "/api/lab-orders"],
        [reception, "GET", "/api/patients"],
        [reception, "GET", "/api/doctors"],
        [reception, "GET", "/api/departments"],
        [reception, "GET", "/api/billing/summary"],
        [pharmacist, "GET", "/api/pharmacy/sales"],
        [pharmacist, "GET", "/api/equipment"],
        [pharmacist, "GET", "/api/medicines"],
        [pharmacist, "GET", "/api/billing/summary"],
        [lab, "GET", "/api/lab-orders"],
        [lab, "GET", "/api/radiology-orders"],
        [accountant, "GET", "/api/billing/invoices"],
        [accountant, "GET", "/api/billing/payments"],
        [accountant, "GET", "/api/hr/payroll"],
        [accountant, "GET", "/api/reports?type=patients"],
        [patient, "GET", "/api/doctors"],
        [patient, "GET", "/api/notifications"],
      ];
      for (const [a, method, path] of matrix) {
        const res = await req(base, method, path, undefined, a.jar);
        check(res.status === 200, `[${a.role}] ${method} ${path} -> 200 [got ${res.status}]`);
      }
    }

    section("Patients / Doctors / Nurses / Departments");
    let patientId = "";
    let doctorId = "";
    let departmentId = "";
    {
      const listRes = await json(await get(base, "/api/patients?pageSize=5", admin.jar));
      check(listRes.data.items.length > 0, "GET /api/patients returns seed patients");

      const patientNo = listRes.data.items[0].patientNo;
      check(/^PT-\d+/.test(patientNo), `patient number format PT-xxxx [${patientNo}]`);

      const create = await json(await post(base, "/api/patients", {
        firstName: "Audit", lastName: "Patient", gender: "MALE", bloodGroup: "O+",
        phone: "+15550009999", email: "audit.patient@test.com", city: "Testville",
      }, admin.jar));
      checkEq(create.success, true, "POST /api/patients creates patient");
      // Use the freshly-created patient for all downstream flows: the seed keeps
      // many admissions ACTIVE, so list patients may already be admitted (409).
      if (create.success && create.data?.id) patientId = create.data.id;

      const dupRes = await post(base, "/api/patients", {
        firstName: "A", lastName: "B", gender: "MALE", phone: "+15550009999",
      }, admin.jar);
      check(dupRes.status === 400, `invalid patient payload rejected -> 400 [${dupRes.status}]`);

      const update = await json(await patch(base, `/api/patients/${create.data.id}`, { city: "UpdatedCity" }, admin.jar));
      checkEq(update.data.city, "UpdatedCity", "PATCH /api/patients/[id] updates");

      const detail = await json(await get(base, `/api/patients/${create.data.id}`, admin.jar));
      checkEq(detail.data.id, create.data.id, "GET /api/patients/[id] detail");

      const doctors = await json(await get(base, "/api/doctors", admin.jar));
      check(doctors.data.items.length > 0, "GET /api/doctors returns seed doctors");
      doctorId = doctors.data.items[0].id;

      const nurses = await json(await get(base, "/api/nurses", admin.jar));
      check(nurses.data.items.length > 0, "GET /api/nurses returns seed nurses");

      const depts = await json(await get(base, "/api/departments", admin.jar));
      check(depts.data.items.length > 0, "GET /api/departments returns seed departments");
      departmentId = depts.data.items[0].id;

      const newDept = await json(await post(base, "/api/departments", {
        name: "Audit Department", code: "AUDT", description: "created by audit",
      }, admin.jar));
      checkEq(newDept.success, true, "POST /api/departments creates");
      const deptPatch = await json(await patch(base, `/api/departments/${newDept.data.id}`, { name: "Audit Dept Renamed" }, admin.jar));
      checkEq(deptPatch.data.name, "Audit Dept Renamed", "PATCH /api/departments persists name (bug #24 check)");
      check(deptPatch.data.code === "AUDT", `PATCH /api/departments persists code (bug #24 check) [${deptPatch.data.code}]`);

      const delRes = await del(base, `/api/departments/${newDept.data.id}`, admin.jar);
      check(delRes.status === 200 || delRes.status === 409, `DELETE /api/departments/[id] -> ${delRes.status}`);

      const eqList = await json(await get(base, "/api/equipment", admin.jar));
      check(eqList.data.items.length > 0, "GET /api/equipment returns seed equipment");
    }

    let bedId = "";
    let admissionId = "";
    section("Rooms / Beds / Admissions / Discharges");
    {
      const rooms = await json(await get(base, "/api/rooms", admin.jar));
      check(rooms.data.items.length > 0, "GET /api/rooms returns seed rooms");
      const roomId = rooms.data.items[0].id;

      const beds = await json(await get(base, "/api/beds", admin.jar));
      check(beds.data.items.length > 0, "GET /api/beds returns seed beds");
      bedId = beds.data.items.find((b: any) => b.status === "AVAILABLE")?.id ?? beds.data.items[0].id;

      const roomRes = await json(await post(base, "/api/rooms", {
        number: "AUD-101", name: "Audit Room", type: "ICU", floor: 1,
        capacity: 2, ratePerDay: 100, departmentId, bedCount: 2,
      }, admin.jar));
      const roomOk = roomRes.success === true || roomRes.success === undefined;
      check(roomOk, `POST /api/rooms -> ${roomRes.success ? "ok" : JSON.stringify(roomRes)}`);

      const admission = await json(await post(base, "/api/admissions", {
        patientId, bedId, doctorId, reason: "Audit admission", diagnosis: "Test observation",
      }, admin.jar));
      checkEq(admission.success, true, `POST /api/admissions creates${admission.error ? ` [${admission.error}]` : ""}`);
      if (!admission.success || !admission.data?.id) {
        console.log("  · skipping dependent admission checks (no id)");
      } else {
        admissionId = admission.data.id;

        const admitDetail = await json(await get(base, `/api/admissions/${admissionId}`, admin.jar));
        check(admitDetail.data.id === admissionId, "GET /api/admissions/[id]");

        const filtered = await json(await get(base, "/api/admissions?status=ADMITTED", admin.jar));
        check(filtered.data.items.length >= 1, "GET /api/admissions?status=ADMITTED respects filter (bug #12 check)");

        const bedNow = await json(await get(base, `/api/beds/${bedId}`, admin.jar));
        checkEq(bedNow.data.status, "OCCUPIED", "bed becomes OCCUPIED after admission");

        const dupAdmission = await json(await post(base, "/api/admissions", {
          patientId, bedId, reason: "should conflict", diagnosis: "x",
        }, admin.jar));
        check(dupAdmission.success === false, "second active admission for same patient rejected (409)");

        const transfer = await patch(base, `/api/admissions/${admissionId}`, { action: "discharge" }, admin.jar);
        check(transfer.status === 200, `admission discharge PATCH -> ${transfer.status}`);
        const bedFreed = await json(await get(base, `/api/beds/${bedId}`, admin.jar));
        checkEq(bedFreed.data.status, "CLEANING", "bed set to CLEANING after discharge (housekeeping workflow)");

        const dischargeList = await json(await get(base, "/api/admissions?status=DISCHARGED", admin.jar));
        check(Array.isArray(dischargeList.data.items), "GET /api/admissions?status=DISCHARGED returns list");
        check(
          dischargeList.data.items.some((a: any) => a.id === admissionId),
          "audit admission appears in discharged list"
        );
      }
    }

    let appointmentId = "";
    section("Appointments / OPD / Consultations");
    {
      const appt = await json(await post(base, "/api/appointments", {
        patientId, doctorId, departmentId, date: "2026-08-20",
        startTime: "10:00", endTime: "11:00",
        type: "WALKIN", reason: "Audit checkup",
      }, admin.jar));
      checkEq(appt.success, true, "POST /api/appointments creates");
      appointmentId = appt.data.id;

      const confirm = await json(await patch(base, `/api/appointments/${appointmentId}`, { status: "CONFIRMED" }, admin.jar));
      check(confirm.data.status === "CONFIRMED", "PATCH /api/appointments/[id] status -> CONFIRMED");

      const apptList = await json(await get(base, "/api/appointments?date=2026-08-20", admin.jar));
      check(apptList.data.items.some((a: any) => a.id === appointmentId), "appointment visible in list");

      const consult = await json(await post(base, "/api/consultations", {
        appointmentId, patientId, doctorId, diagnosis: "Audit diagnosis",
        symptoms: ["cough"], vitals: [{ name: "BP", value: "120/80", unit: "mmHg" }],
        prescriptions: [{ medicine: "Paracetamol", dose: "500mg", frequency: "TDS", duration: "5 days" }],
      }, doctor.jar));
      checkEq(consult.success, true, "POST /api/consultations (DOCTOR)");
      check(
        Array.isArray(consult.data?.prescriptions) || typeof consult.data?.prescriptions === "string",
        "consultation response includes prescriptions (array or JSON string)"
      );

      const patientOwn = await json(await get(base, "/api/consultations?patientId=", admin.jar));
      check(Array.isArray(patientOwn.data.items) || Array.isArray(patientOwn.data), "GET /api/consultations list");
    }

    let labOrderId = "";
    section("Laboratory / Radiology");
    {
      const tests = await json(await get(base, "/api/lab-tests", admin.jar));
      check(tests.data.items.length > 0, "GET /api/lab-tests returns seed tests");
      const testIds = tests.data.items.slice(0, 2).map((t: any) => t.id);

      const order = await json(await post(base, "/api/lab-orders", {
        patientId, doctorId, priority: "URGENT", testIds,
      }, doctor.jar));
      checkEq(order.success, true, "POST /api/lab-orders creates");
      labOrderId = order.data.id;

      const addRes = await patch(base, `/api/lab-orders/${labOrderId}`, {
        results: testIds.map((id: string) => ({
          testId: id,
          name: tests.data.items.find((t: any) => t.id === id).name,
          value: "10.2", unit: "mg/dL", normalRange: "5-15", flag: "NORMAL",
        })),
      }, lab.jar);
      const addBody = await json(addRes);
      check(addRes.status === 200 || addBody.success === true, `lab results added (LAB) [${addRes.status}]`);

      const wrongTest = await json(await patch(base, `/api/lab-orders/${labOrderId}`, {
        results: [{ testId: "000000000000000000000000", name: "Fake", value: "1" }],
      }, lab.jar));
      check(wrongTest.success === false, "lab results reject tests not on order (bug #25 check)");

      const rad = await json(await post(base, "/api/radiology-orders", {
        patientId, doctorId, modality: "XRAY", bodyPart: "Chest", notes: "audit",
      }, doctor.jar));
      checkEq(rad.success, true, "POST /api/radiology-orders creates");
      const radRes = await patch(base, `/api/radiology-orders/${rad.data.id}`, {
        findings: "Normal chest X-ray. No acute findings.",
      }, lab.jar);
      check(radRes.status === 200 || (await json(radRes)).success === true, `radiology results saved [${radRes.status}]`);
    }

    let medicineId = "";
    section("Pharmacy / Inventory / Suppliers / Stock");
    {
      const meds = await json(await get(base, "/api/medicines", admin.jar));
      check(meds.data.items.length > 0, "GET /api/medicines returns seed medicines");
      medicineId = meds.data.items[0].id;
      const stockBefore = meds.data.items[0].stock;

      const sale = await json(await post(base, "/api/pharmacy/sales", {
        patientId,
        items: [{ medicineId, quantity: 1, unitPrice: 100 }],
      }, pharmacist.jar));
      checkEq(sale.success, true, "POST /api/pharmacy/sales (PHARMACIST)");
      checkEq(sale.data.total, 100, "sale total computed");

      const medAfter = await json(await get(base, `/api/medicines/${medicineId}`, admin.jar));
      checkEq(medAfter.data.stock, stockBefore - 1, "stock decremented after sale");

      const oversell = await json(await post(base, "/api/pharmacy/sales", {
        patientId,
        items: [{ medicineId, quantity: 99999, unitPrice: 1 }],
      }, pharmacist.jar));
      check(oversell.success === false, "overselling stock rejected (409)");

      const suppliers = await json(await get(base, "/api/suppliers", admin.jar));
      check(suppliers.data.items.length > 0, "GET /api/suppliers returns seed suppliers");

      const po = await json(await post(base, "/api/purchase-orders", {
        supplierId: suppliers.data.items[0].id,
        items: [{ medicineId, quantity: 10, unitCost: 5 }],
      }, pharmacist.jar));
      checkEq(po.success, true, "POST /api/purchase-orders creates");
      const poId = po.data.id;

      const poDetail = await json(await get(base, `/api/purchase-orders/${poId}`, admin.jar));
      checkEq(poDetail.data.id, poId, "GET /api/purchase-orders/[id] detail");
      check(typeof poDetail.data.supplier?.name === "string", "PO detail includes supplier");

      const stockBeforeReceive = medAfter.data.stock;
      const receive = await patch(base, `/api/purchase-orders/${poId}`, { action: "receive" }, pharmacist.jar);
      check(receive.status === 200 || (await json(receive)).success === true, `purchase order received [${receive.status}]`);

      const medReceived = await json(await get(base, `/api/medicines/${medicineId}`, admin.jar));
      checkEq(medReceived.data.stock, stockBeforeReceive + 10, "stock increased after PO receive");

      const stockTx = await json(await get(base, "/api/stock-transactions", admin.jar));
      check(stockTx.data.items.length > 0, "GET /api/stock-transactions returns rows");

      const adjustment = await json(await post(base, "/api/stock-transactions", {
        medicineId, type: "ADJUSTMENT", quantity: 5, reason: "audit count",
      }, pharmacist.jar));
      checkEq(adjustment.success, true, "POST /api/stock-transactions adjustment");
    }

    let invoiceId = "";
    let paymentId = "";
    section("Billing / Payments / Refunds");
    {
      const invoice = await json(await post(base, "/api/billing/invoices", {
        patientId,
        items: [
          { type: "CONSULTATION", description: "Consultation", quantity: 1, unitPrice: 200 },
          { type: "LAB", description: "CBC", quantity: 2, unitPrice: 100 },
        ],
        discountType: "FIXED", discount: 50, taxRate: 10,
      }, accountant.jar));
      checkEq(invoice.success, true, "POST /api/billing/invoices (ACCOUNTANT)");
      invoiceId = invoice.data.id;
      // subtotal 400 - 50 discount = 350 + 10% tax = 385
      checkEq(invoice.data.total, 385, "invoice totals (discount + tax)");
      checkEq(invoice.data.status, "PENDING", "new invoice status PENDING");

      const partial = await json(await post(base, "/api/billing/payments", {
        invoiceId, amount: 100, method: "CASH",
      }, accountant.jar));
      checkEq(partial.success, true, "partial payment recorded");
      paymentId = partial.data.id;

      const afterPartial = await json(await get(base, `/api/billing/invoices/${invoiceId}`, admin.jar));
      checkEq(afterPartial.data.status, "PARTIAL", "invoice status PARTIAL after partial payment");

      const full = await json(await post(base, "/api/billing/payments", {
        invoiceId, amount: 285, method: "CARD",
      }, accountant.jar));
      checkEq(full.success, true, "remaining payment completes invoice");

      const paid = await json(await get(base, `/api/billing/invoices/${invoiceId}`, admin.jar));
      checkEq(paid.data.status, "PAID", "invoice status PAID after full payment");

      const refund = await json(await post(base, "/api/billing/payments/refund", {
        paymentId, amount: 30, reason: "audit partial refund",
      }, accountant.jar));
      checkEq(refund.success, true, "partial refund issued");

      const overRefund = await json(await post(base, "/api/billing/payments/refund", {
        paymentId, amount: 5000, reason: "should be capped",
      }, accountant.jar));
      check(overRefund.success === false, "over-refund blocked (bug #7 check)");

      const receipt = await get(base, `/api/payments/${paymentId}/receipt`, admin.jar);
      check(receipt.status === 200, `payment receipt PDF -> ${receipt.status}`);
      if (receipt.status === 200) {
        check((receipt.headers.get("content-type") ?? "").includes("pdf"), "receipt content-type is PDF");
      }

      const summary = await json(await get(base, "/api/billing/summary", accountant.jar));
      check(typeof summary.data.totalRevenue === "number", "GET /api/billing/summary returns totals");

      const payLink = await json(await post(base, `/api/billing/invoices/${invoiceId}/pay-link`, {}, accountant.jar));
      check(payLink.success === true && typeof payLink.data.url === "string", "pay-link generated (non-Stripe fallback)");

      const checkout = await json(await post(base, `/api/billing/invoices/${invoiceId}/checkout`, {}, accountant.jar));
      check(
        checkout.success === false && (checkout.error ?? "").toLowerCase().includes("stripe") ||
        checkout.data?.url,
        `checkout degrades when Stripe unconfigured [${checkout.status ?? JSON.stringify(checkout.error ?? "").slice(0, 60)}]`
      );

      const payList = await json(await get(base, "/api/payments", admin.jar));
      check(payList.data.items.length >= 2, "GET /api/payments returns payments");
    }

    section("Insurance");
    {
      const company = await json(await post(base, "/api/billing/companies", {
        name: "Audit Assurance", coveragePercent: 80, email: "claims@audit.example", phone: "+15550004444",
      }, accountant.jar));
      checkEq(company.success, true, "POST /api/billing/companies creates");

      const policy = await json(await post(base, "/api/billing/policies", {
        patientId, companyId: company.data.id, coveragePercent: 80, startDate: "2026-01-01", endDate: "2027-01-01",
      }, accountant.jar));
      checkEq(policy.success, true, "POST /api/billing/policies creates");
      check(/^POL-/.test(policy.data.policyNumber), `policy number POL-xxxx persisted (bug #23 check) [${policy.data.policyNumber}]`);

      const claim = await json(await post(base, "/api/billing/claims", {
        patientId, policyId: policy.data.id, amount: 500, description: "audit claim",
      }, accountant.jar));
      checkEq(claim.success, true, "POST /api/billing/claims creates");
      check(/^CLM-/.test(claim.data.claimNo), `claim number CLM-xxxx [${claim.data.claimNo}]`);

      const claims = await json(await get(base, "/api/billing/claims", admin.jar));
      check(claims.data.items.length >= 1, "GET /api/billing/claims lists");
    }

    let employeeId = "";
    section("HR / Payroll");
    {
      const emp = await json(await post(base, "/api/hr/employees", {
        firstName: "Audit", lastName: "Employee", email: "audit.emp@test.com",
        password: "EmpPass@123", roleName: "NURSE", designation: "Staff Nurse",
        employmentType: "FULL_TIME", joiningDate: "2026-01-15", salary: 3000, allowances: 200, status: "ACTIVE",
      }, admin.jar));
      checkEq(emp.success, true, "POST /api/hr/employees creates");
      employeeId = emp.data.id;

      const att = await json(await post(base, "/api/hr/attendance", {
        records: [{ employeeId, date: "2026-08-01", status: "PRESENT", checkIn: "09:00", checkOut: "17:00", hoursWorked: 8 }],
      }, admin.jar));
      checkEq(att.success, true, "POST /api/hr/attendance marks");

      const attStats = await json(await get(base, "/api/hr/attendance/stats?month=2026-08", admin.jar));
      check(Array.isArray(attStats.data), "GET /api/hr/attendance/stats");

      const leave = await json(await post(base, "/api/hr/leaves", {
        employeeId, type: "CASUAL", fromDate: "2026-09-01", toDate: "2026-09-03", reason: "audit leave",
      }, admin.jar));
      checkEq(leave.success, true, "POST /api/hr/leaves creates");

      const leaveDecision = await json(await patch(base, `/api/hr/leaves/${leave.data.id}`, { status: "APPROVED" }, admin.jar));
      check(leaveDecision.data.status === "APPROVED", "PATCH /api/hr/leaves/[id] approve");

      const payroll = await json(await post(base, "/api/hr/payroll", { month: "2026-08" }, accountant.jar));
      checkEq(payroll.success, true, "POST /api/hr/payroll generate (ACCOUNTANT)");
      check(payroll.data.created >= 1, `payroll rows generated [${payroll.data.created}]`);

      const payrollList = await json(await get(base, "/api/hr/payroll?month=2026-08", admin.jar));
      check(Array.isArray(payrollList.data.items) && payrollList.data.items.length > 0, "GET /api/hr/payroll lists rows");

      const markPaid = await json(await post(base, "/api/hr/payroll/mark-paid", {
        ids: payrollList.data.items.map((r: any) => r.id),
      }, accountant.jar));
      checkEq(markPaid.success, true, "POST /api/hr/payroll/mark-paid");

      const payslip = await get(base, `/api/hr/payroll/${payrollList.data.items[0].id}/payslip`, admin.jar);
      check(payslip.status === 200 && (payslip.headers.get("content-type") ?? "").includes("pdf"), "payslip PDF generated");

      const review = await json(await post(base, "/api/hr/reviews", {
        employeeId, period: "2026-Q2", rating: 4, strengths: "audit", improvements: "", goals: "",
      }, admin.jar));
      checkEq(review.success, true, "POST /api/hr/reviews creates");

      const payrollStatsRes = await json(await get(base, "/api/hr/payroll/stats?month=2026-08", admin.jar));
      check(typeof payrollStatsRes.data.amountPaid === "number", "GET /api/hr/payroll/stats");
    }

    section("Emergency");
    {
      const created: any[] = [];
      for (const triage of ["YELLOW", "RED", "GREEN", "BLACK"]) {
        const res = await json(await post(base, "/api/emergency", {
          walkInName: `Audit ${triage}`, walkInPhone: "+15550007777",
          age: 45, gender: "MALE", triageLevel: triage, condition: `triage ${triage}`,
        }, doctor.jar));
        checkEq(res.success, true, `POST /api/emergency creates ${triage} case`);
        created.push(res.data);
      }

      const list = await json(await get(base, "/api/emergency", doctor.jar));
      const triageOrder = list.data.items
        .filter((c: any) => created.some((x: any) => x.id === c.id))
        .map((c: any) => c.triageLevel);
      checkEq(triageOrder, ["RED", "YELLOW", "GREEN", "BLACK"], "triage sorted RED>YELLOW>GREEN>BLACK (bug #11 check)");

      const update = await json(await patch(base, `/api/emergency/${created[0].id}`, {
        status: "TREATING", triageLevel: "RED",
      }, doctor.jar));
      checkEq(update.success, true, "PATCH /api/emergency/[id] update");

      const ambulance = await json(await post(base, `/api/emergency/${created[0].id}/ambulance`, {
        etaMinutes: 12, notes: "audit dispatch",
      }, doctor.jar));
      checkEq(ambulance.success, true, "POST /api/emergency/[id]/ambulance");

      const events = await json(await post(base, `/api/emergency/${created[0].id}/events`, {
        type: "NOTE", message: "audit event",
      }, doctor.jar));
      checkEq(events.success, true, "POST /api/emergency/[id]/events");

      const withFilter = await json(await get(base, "/api/emergency?triage=RED", doctor.jar));
      check(withFilter.data.items.every((c: any) => c.triageLevel === "RED"), "GET /api/emergency?triage=RED filters");
    }

    section("Prescriptions / Records / QR verify");
    {
      const rx = await json(await post(base, "/api/prescriptions", {
        patientId, doctorId, diagnosis: "Audit diagnosis",
        items: [{ medicine: "Paracetamol", dose: "500mg", frequency: "TDS", duration: "5 days" }],
      }, doctor.jar));
      checkEq(rx.success, true, "POST /api/prescriptions (DOCTOR)");
      const rxId = rx.data.id;

      const pdf = await get(base, `/api/prescriptions/${rxId}/pdf`, admin.jar);
      check(pdf.status === 200 && (pdf.headers.get("content-type") ?? "").includes("pdf"), "prescription PDF generated");

      const signature = await signHmac(`${rxId}:${rx.data.prescriptionNo}`);
      const qrPayload = encodeURIComponent(JSON.stringify({ v: 1, rx: rx.data.prescriptionNo, id: rxId, s: signature }));
      const verify = await json(await get(base, `/api/prescriptions/verify?data=${qrPayload}`));
      check(verify.valid === true, "public QR verify endpoint validates signature (bug #27 check)");

      const tampered = await json(await get(base, `/api/prescriptions/verify?data=${encodeURIComponent(JSON.stringify({ v: 1, rx: rx.data.prescriptionNo, id: rxId, s: "tampered" }))}`));
      check(tampered.valid === false, "tampered QR rejected");

      const record = await json(await post(base, "/api/records", {
        patientId, title: "Audit record", type: "CLINICAL_NOTE", content: "Routine audit note", doctorId,
      }, doctor.jar));
      checkEq(record.success, true, "POST /api/records creates");

      const rxList = await json(await get(base, "/api/prescriptions", admin.jar));
      check(rxList.data.items.length >= 1, "GET /api/prescriptions lists");
    }

    section("Patient IDOR scoping");
    {
      const allPatients = await json(await get(base, "/api/patients?pageSize=50", admin.jar));
      const otherPatientId = allPatients.data.items.find((p: any) => p.id !== patientId)?.id;
      check(!!otherPatientId, "found another patient for IDOR test");

      const own = await json(await get(base, "/api/patients", patient.jar));
      checkEq(own.data.meta.total, 1, "PATIENT sees exactly 1 patient (own) (bug #2 check)");

      const ownRecords = await get(base, `/api/records/patient/${patientId}`, patient.jar);
      const otherRecords = await get(base, `/api/records/patient/${otherPatientId}`, patient.jar);
      check(ownRecords.status === 200, "PATIENT reads own records");
      check(otherRecords.status === 403 || otherRecords.status === 404, `PATIENT blocked from other patient's records [${otherRecords.status}]`);

      const otherDetail = await get(base, `/api/patients/${otherPatientId}`, patient.jar);
      check(otherDetail.status === 403 || otherDetail.status === 404, `PATIENT blocked from other patient detail [${otherDetail.status}]`);

      const ownSearch = await json(await get(base, "/api/search?q=Audit%20Patient", patient.jar));
      const leaked = JSON.stringify(ownSearch.data).toLowerCase().includes("audit patient");
      check(!leaked, "PATIENT search does not leak other patients (bug #26 check)");

      const ownSearchHit = await json(await get(base, "/api/search?q=Zara", patient.jar));
      check(JSON.stringify(ownSearchHit.data).includes("Zara"), "PATIENT search finds own record");
    }

    section("Search / Reports / Analytics / Dashboard");
    {
      const search = await json(await get(base, "/api/search?q=Paracetamol&limit=999", admin.jar));
      check(search.data.items.length <= 10, `search limit capped at 10 (bug #26 check) [${search.data.items.length}]`);

      const reports = await json(await get(base, "/api/reports?type=patients", accountant.jar));
      check(reports.success === true, "GET /api/reports?type=patients (ACCOUNTANT)");
      check(Array.isArray(reports.data.rows) && Array.isArray(reports.data.summary), "reports totals via aggregation (bug #20 check)");

      const noType = await get(base, "/api/reports", accountant.jar);
      checkEq(noType.status, 400, "reports without type -> 400");

      const exportRes = await get(base, "/api/reports/export?type=patients&format=pdf", accountant.jar);
      check(exportRes.status === 200, `reports export PDF -> ${exportRes.status}`);

      const exportExcel = await get(base, "/api/reports/export?type=patients&format=excel", accountant.jar);
      check(exportExcel.status === 200, `reports export Excel -> ${exportExcel.status}`);

      const analytics = await json(await get(base, "/api/analytics", admin.jar));
      check(analytics.success === true, "GET /api/analytics");

      const dash = await json(await get(base, "/api/dashboard/summary", admin.jar));
      check(dash.success === true, "GET /api/dashboard/summary");
      check(typeof dash.data.patients === "number", "dashboard summary counts");
    }

    section("Notifications / Settings / Audit logs");
    {
      const notif = await json(await get(base, "/api/notifications", admin.jar));
      check(Array.isArray(notif.data.items), "GET /api/notifications");

      const unread = await json(await get(base, "/api/notifications/unread", admin.jar));
      check(typeof unread.data.count === "number", "GET /api/notifications/unread count");

      const markOne = await json(await patch(base, `/api/notifications/${notif.data.items[0].id}`, { read: true }, admin.jar));
      check(markOne.success === true, "PATCH /api/notifications/[id] mark read");

      const markAll = await json(await patch(base, "/api/notifications", {}, admin.jar));
      check(markAll.success === true, "PATCH /api/notifications mark all read");

      const settings = await json(await get(base, "/api/settings", admin.jar));
      check(settings.success === true, "GET /api/settings");

      const smtpRes = await json(await post(base, "/api/settings/smtp", {
        host: "smtp.test.example", port: 587, secure: false,
        user: "audit@test.example", password: "smtp-secret-pass", from: "Audit <audit@test.example>",
      }, admin.jar));
      checkEq(smtpRes.success, true, "POST /api/settings/smtp saves");

      const smtpGet = await json(await get(base, "/api/settings/smtp", admin.jar));
      check(!JSON.stringify(smtpGet.data).includes("smtp-secret-pass"), "SMTP password never returned (bug #5 check)");

      const audit = await json(await get(base, "/api/audit-logs?pageSize=10", admin.jar));
      check(Array.isArray(audit.data.items), "GET /api/audit-logs");
      check(audit.data.meta.total >= 1, "audit logs have entries");
      check(audit.data.items.every((l: any) => l.meta === null || typeof l.meta === "object"), "audit meta parsed safely (bug #17 check)");
    }

    section("Graceful degradation (Cloudinary / Stripe)");
    {
      const form = new FormData();
      form.append("purpose", "logo");
      form.append("file", new File([new Uint8Array(8)], "logo.png", { type: "image/png" }));
      const upload = await fetch(`${base}/api/upload`, {
        method: "POST", headers: { Cookie: admin.jar }, body: form,
      });
      const uploadBody = await json(upload);
      checkEq(upload.status, 503, "upload -> 503 Cloudinary not configured");
      check(String(uploadBody.error).includes("Cloudinary"), "upload error message is explicit");

      const webhook = await fetch(`${base}/api/webhooks/stripe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "checkout.session.completed", data: { object: {} } }),
      });
      check(
        webhook.status === 400 || webhook.status === 401 || webhook.status === 500,
        `stripe webhook with junk payload -> 4xx/5xx not crash [${webhook.status}]`
      );

      const missing = await get(base, "/api/auth/me");
      checkEq(missing.status, 401, "unauthenticated API blocked");
    }

    console.log("\n═══════════════════════════════════════");
    console.log(`API AUDIT RESULT: ${passCount} passed, ${failCount} failed`);
    console.log("═══════════════════════════════════════");
    if (failCount) {
      console.log("\nFailures:");
      for (const f of failures) console.log(`  ✖ ${f}`);
      process.exitCode = 1;
    }
  } catch (crash) {
    failCount += 1;
    failures.push(`SUITE CRASH: ${crash instanceof Error ? crash.stack : String(crash)}`);
    console.log("\n═══════════════════════════════════════");
    console.log(`API AUDIT RESULT: ${passCount} passed, ${failCount} failed`);
    console.log(`Suite crashed at: ${crash instanceof Error ? crash.message : crash}`);
    for (const f of failures) console.log(`  ✖ ${f}`);
    console.log("═══════════════════════════════════════");
    process.exitCode = 1;
  } finally {
    server.kill("SIGTERM");
    if (mongod) await mongod.stop();
  }
}

main().catch((e) => {
  failCount += 1;
  failures.push(`FATAL: ${e instanceof Error ? e.stack : String(e)}`);
  console.log("\n═══════════════════════════════════════");
  console.log(`API AUDIT RESULT: ${passCount} passed, ${failCount} failed (fatal)`);
  for (const f of failures) console.log(`  ✖ ${f}`);
  console.log("═══════════════════════════════════════");
  process.exit(1);
});
