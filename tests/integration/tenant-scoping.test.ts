import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stopTestDatabase, useTestDatabase } from "@/tests/helpers/test-db";

/**
 * Tenant isolation.
 *
 * ROADMAP Phase 1 added hospitalId to the Doctor/Nurse/Room/Bed models and
 * Phase 6a scoped the previously-unscoped list functions. Before this suite,
 * `listDoctors`/`listMedicines` and friends took no actor at all, so a request
 * from hospital B could read hospital A's rows. These tests pin the fix.
 *
 * A second defect the suite guards: the seed never wrote hospitalId to
 * Doctor/Nurse/Room/Bed, so 61 documents sat unscoped in the live database and
 * the filters would have matched nothing.
 */
type Actor = { userId: string; hospitalId?: string | null };

describe("tenant isolation", () => {
  const HOSPITAL_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const HOSPITAL_B = "bbbbbbbbbbbbbbbbbbbbbbbb";

  let db: typeof import("@/lib/db").db;
  let masterData: typeof import("@/services/master-data");
  let pharmacy: typeof import("@/services/pharmacy");
  let clinical: typeof import("@/services/clinical");
  let records: typeof import("@/services/records");

  const actorA: Actor = { userId: "user-a", hospitalId: HOSPITAL_A };
  const actorB: Actor = { userId: "user-b", hospitalId: HOSPITAL_B };

  beforeAll(async () => {
    await useTestDatabase();
    db = (await import("@/lib/db")).db;
    masterData = await import("@/services/master-data");
    pharmacy = await import("@/services/pharmacy");
    clinical = await import("@/services/clinical");
    records = await import("@/services/records");
  }, 180_000);

  afterAll(async () => {
    await db.$disconnect();
    await stopTestDatabase();
  });

  /** Creates a department + doctor + nurse + room + bed owned by `hospitalId`. */
  async function seedMasterDataFor(hospitalId: string, tag: string) {
    const dept = await db.department.create({
      data: { name: `Dept ${tag}`, code: `D-${tag}`, hospitalId },
    });
    const user = await db.user.create({
      data: {
        email: `user-${tag}@test.local`,
        passwordHash: "x",
        firstName: `Doc${tag}`,
        lastName: "Test",
        hospitalId,
        roleId: "507f1f77bcf86cd799439011",
      },
    });
    const doctor = await db.doctor.create({
      data: { userId: user.id, departmentId: dept.id, specialization: tag, hospitalId },
    });
    const nurse = await db.nurse.create({
      data: { userId: user.id, departmentId: dept.id, ward: `W-${tag}`, hospitalId },
    });
    const room = await db.room.create({
      data: { number: `R-${tag}`, floor: 1, capacity: 1, hospitalId },
    });
    const bed = await db.bed.create({
      data: { number: `B-${tag}`, roomId: room.id, hospitalId },
    });
    const patient = await db.patient.create({
      data: { patientNo: `PT-${tag}`, firstName: `Pat${tag}`, lastName: "Test", hospitalId },
    });
    const medicine = await db.medicine.create({
      data: { name: `Med ${tag}`, price: 10, cost: 5, hospitalId },
    });
    const supplier = await db.supplier.create({
      data: { name: `Sup ${tag}`, hospitalId },
    });
    return { dept, doctor, nurse, room, bed, patient, medicine, supplier };
  }

  it("listDoctors returns only the actor hospital's doctors", async () => {
    await seedMasterDataFor(HOSPITAL_A, "A");
    await seedMasterDataFor(HOSPITAL_B, "B");

    const forA = await masterData.listDoctors(actorA);
    const forB = await masterData.listDoctors(actorB);

    expect(forA.length).toBeGreaterThan(0);
    expect(forB.length).toBeGreaterThan(0);
    expect(forA.every((d) => d.hospitalId === HOSPITAL_A)).toBe(true);
    expect(forB.every((d) => d.hospitalId === HOSPITAL_B)).toBe(true);

    // The regression this guards: A must not see B's doctor.
    expect(forA.map((d) => d.specialization)).not.toContain("B");
    expect(forB.map((d) => d.specialization)).not.toContain("A");
  });

  it("listNurses, listDepartments and listRooms are hospital-scoped", async () => {
    const nursesA = await masterData.listNurses(actorA);
    const nursesB = await masterData.listNurses(actorB);
    expect(nursesA.every((n) => n.hospitalId === HOSPITAL_A)).toBe(true);
    expect(nursesB.every((n) => n.hospitalId === HOSPITAL_B)).toBe(true);

    const deptsA = await masterData.listDepartments(actorA);
    expect(deptsA.every((d) => d.hospitalId === HOSPITAL_A)).toBe(true);
    expect(deptsA.map((d) => d.code)).not.toContain("D-B");

    const roomsA = await masterData.listRooms(actorA);
    expect(roomsA.every((r) => r.hospitalId === HOSPITAL_A)).toBe(true);
    expect(roomsA.map((r) => r.number)).not.toContain("R-B");
  });

  it("listMedicines, listSuppliers and listSales are hospital-scoped", async () => {
    const medsA = await pharmacy.listMedicines(actorA);
    expect(medsA.every((m) => m.hospitalId === HOSPITAL_A)).toBe(true);
    expect(medsA.map((m) => m.name)).not.toContain("Med B");

    const supsA = await pharmacy.listSuppliers(actorA);
    expect(supsA.every((s) => s.hospitalId === HOSPITAL_A)).toBe(true);
    expect(supsA.map((s) => s.name)).not.toContain("Sup B");

    const salesA = await pharmacy.listSales(actorA);
    expect(salesA.every((s) => s.hospitalId === HOSPITAL_A)).toBe(true);
  });

  it("listPatients and listRecords stay hospital-scoped", async () => {
    const forA = await clinical.listPatients(actorA);
    expect(forA.every((p) => p.hospitalId === HOSPITAL_A)).toBe(true);
    expect(forA.map((p) => p.patientNo)).not.toContain("PT-B");

    const recs = await records.listRecords({ actor: actorA });
    expect(recs.every((r) => r.hospitalId === HOSPITAL_A)).toBe(true);
  });

  it("an actor with no hospitalId sees every tenant (super-admin behaviour)", async () => {
    const globalActor: Actor = { userId: "root" };
    const all = await masterData.listDoctors(globalActor);
    const scoped = await masterData.listDoctors(actorA);
    expect(all.length).toBeGreaterThan(scoped.length);
    const hospitalIds = new Set(all.map((d) => d.hospitalId));
    expect(hospitalIds.size).toBeGreaterThan(1);
  });

  it("search is applied within the tenant, not across it", async () => {
    // Both hospitals have a doctor named the same way; the filter must not
    // widen results across the boundary.
    const shared = await masterData.listDoctors(actorA, "Test");
    expect(shared.every((d) => d.hospitalId === HOSPITAL_A)).toBe(true);
  });

  it("create* writes the actor's hospitalId", async () => {
    const created = await masterData.createDepartment(actorB, {
      name: "Scoped Dept",
      code: "SCOPED-1",
      description: "written under B",
    });
    expect(created.hospitalId).toBe(HOSPITAL_B);
    // ...and it is invisible from hospital A.
    const seenByA = await masterData.listDepartments(actorA);
    expect(seenByA.map((d) => d.code)).not.toContain("SCOPED-1");
  });
});