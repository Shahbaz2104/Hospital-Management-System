import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { nextSeq } from "@/lib/sequences";
import type { MedicineInput } from "@/validators/pharmacy";

type Actor = { userId: string; hospitalId?: string | null };

const EXPIRY_WINDOW_DAYS = 60;

export function stockStatus(medicine: { stock: number; reorderLevel: number }) {
  return medicine.stock <= medicine.reorderLevel ? "LOW" : "OK";
}

export function expiryStatus(medicine: { expiryDate: Date | null | undefined }) {
  if (!medicine.expiryDate) return null;
  const days = Math.ceil(
    (medicine.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (days < 0) return "EXPIRED";
  if (days <= EXPIRY_WINDOW_DAYS) return "EXPIRING";
  return "OK";
}

async function nextNumber(kind: "po" | "tx" | "sale"): Promise<string> {
  if (kind === "po") return nextSeq(() => db.purchaseOrder.findMany({ select: { poNo: true } }), "poNo", "PO");
  if (kind === "tx") return nextSeq(() => db.stockTransaction.findMany({ select: { txNo: true } }), "txNo", "ST");
  return nextSeq(() => db.medicineSale.findMany({ select: { saleNo: true } }), "saleNo", "SALE");
}

// ---------------------------------------------------------------------------
// Medicines
// ---------------------------------------------------------------------------

export async function listMedicines(filters: { category?: string; search?: string } = {}) {
  const where: Record<string, unknown> = {};
  if (filters.category && filters.category !== "ALL") where.category = filters.category;
  if (filters.search) where.name = { contains: filters.search, mode: "insensitive" };

  const medicines = await db.medicine.findMany({
    where,
    orderBy: { name: "asc" },
  });

  return medicines.map((m) => ({
    ...m,
    stockStatus: stockStatus(m),
    expiryStatus: expiryStatus(m),
  }));
}

export async function createMedicine(actor: Actor, input: MedicineInput) {
  const medicine = await db.medicine.create({
    data: {
      ...input,
      hospitalId: actor.hospitalId ?? null,
    },
  });
  return medicine;
}

export async function updateMedicine(actor: Actor, id: string, input: Partial<MedicineInput>) {
  const existing = await db.medicine.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Medicine not found");
  return db.medicine.update({ where: { id }, data: input });
}

export async function deleteMedicine(_actor: Actor, id: string) {
  const existing = await db.medicine.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Medicine not found");
  await db.medicine.delete({ where: { id } });
  return { deleted: true };
}

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

export async function listSuppliers(activeOnly = false) {
  return db.supplier.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: { name: "asc" },
  });
}

export async function createSupplier(actor: Actor, input: { name: string; contactPerson?: string; phone?: string; email?: string; address?: string; taxId?: string; notes?: string }) {
  const supplier = await db.supplier.create({
    data: { ...input, hospitalId: actor.hospitalId ?? null },
  });
  return supplier;
}

// ---------------------------------------------------------------------------
// Purchase orders (stock in)
// ---------------------------------------------------------------------------

export async function listPurchaseOrders(filters: { status?: string } = {}) {
  const where: Record<string, unknown> = {};
  if (filters.status && filters.status !== "ALL") where.status = filters.status;

  return db.purchaseOrder.findMany({
    where,
    include: {
      supplier: { select: { id: true, name: true, contactPerson: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createPurchaseOrder(
  actor: Actor,
  input: { supplierId: string; items: { medicineId: string; quantity: number; unitCost: number; batchNo?: string; expiryDate?: Date }[]; notes?: string }
) {
  const supplier = await db.supplier.findUnique({ where: { id: input.supplierId } });
  if (!supplier) throw new ApiError(404, "Supplier not found");

  const medicines = await db.medicine.findMany({
    where: { id: { in: input.items.map((i) => i.medicineId) } },
  });
  if (medicines.length !== input.items.length) {
    throw new ApiError(400, "One or more medicines were not found");
  }

  const total = input.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
  const poNo = await nextNumber("po");
  const order = await db.purchaseOrder.create({
    data: {
      poNo,
      supplierId: input.supplierId,
      items: JSON.stringify(input.items),
      total,
      notes: input.notes ?? null,
      createdById: actor.userId,
      hospitalId: actor.hospitalId ?? null,
    },
  });

  return order;
}

export async function receivePurchaseOrder(actor: Actor, id: string) {
  const order = await db.purchaseOrder.findUnique({ where: { id } });
  if (!order) throw new ApiError(404, "Purchase order not found");
  if (order.status !== "ORDERED") throw new ApiError(409, "Only ordered purchase orders can be received");

  const items = JSON.parse(order.items) as {
    medicineId: string;
    quantity: number;
    unitCost: number;
    batchNo?: string;
    expiryDate?: string;
  }[];

  await db.$transaction(async (tx) => {
    for (const item of items) {
      const medicine = await tx.medicine.findUnique({ where: { id: item.medicineId } });
      if (!medicine) throw new ApiError(404, "Medicine not found");

      const balanceAfter = medicine.stock + item.quantity;
      await tx.medicine.update({
        where: { id: item.medicineId },
        data: {
          stock: balanceAfter,
          ...(item.expiryDate ? { expiryDate: new Date(item.expiryDate) } : {}),
        },
      });

      const txNo = await nextNumber("tx");
      await tx.stockTransaction.create({
        data: {
          txNo,
          medicineId: item.medicineId,
          type: "IN",
          reason: "PURCHASE",
          quantity: item.quantity,
          balanceAfter,
          batchNo: item.batchNo ?? null,
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
          ref: order.poNo,
          createdById: actor.userId,
          hospitalId: actor.hospitalId ?? null,
        },
      });
    }
  });

  const updated = await db.purchaseOrder.update({
    where: { id },
    data: { status: "RECEIVED", receivedAt: new Date() },
  });

  return updated;
}

export async function cancelPurchaseOrder(actor: Actor, id: string) {
  const order = await db.purchaseOrder.findUnique({ where: { id } });
  if (!order) throw new ApiError(404, "Purchase order not found");
  if (order.status !== "ORDERED") throw new ApiError(409, "Only ordered purchase orders can be cancelled");
  const updated = await db.purchaseOrder.update({ where: { id }, data: { status: "CANCELLED" } });
  return updated;
}

// ---------------------------------------------------------------------------
// Stock ledger (manual in/out/adjustment)
// ---------------------------------------------------------------------------

export async function listStockTransactions(filters: { medicineId?: string } = {}) {
  const where: Record<string, unknown> = {};
  if (filters.medicineId) where.medicineId = filters.medicineId;

  return db.stockTransaction.findMany({
    where,
    include: {
      medicine: { select: { id: true, name: true, unit: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function createStockTransaction(
  actor: Actor,
  input: { medicineId: string; type: string; quantity: number; reason?: string; batchNo?: string; expiryDate?: Date }
) {
  const medicine = await db.medicine.findUnique({ where: { id: input.medicineId } });
  if (!medicine) throw new ApiError(404, "Medicine not found");

  const signed = input.type === "OUT" ? -input.quantity : input.quantity;
  const balanceAfter = medicine.stock + signed;
  if (balanceAfter < 0) {
    throw new ApiError(400, `Insufficient stock — only ${medicine.stock} ${medicine.unit}(s) available`);
  }

  const txNo = await nextNumber("tx");
  const tx = await db.stockTransaction.create({
    data: {
      txNo,
      medicineId: input.medicineId,
      type: input.type,
      reason: input.reason ?? "STOCKTAKE",
      quantity: signed,
      balanceAfter,
      batchNo: input.batchNo ?? null,
      expiryDate: input.expiryDate ?? null,
      createdById: actor.userId,
      hospitalId: actor.hospitalId ?? null,
    },
  });
  await db.medicine.update({
    where: { id: input.medicineId },
    data: {
      stock: balanceAfter,
      ...(input.expiryDate ? { expiryDate: input.expiryDate } : {}),
    },
  });

  return tx;
}

// ---------------------------------------------------------------------------
// Medicine sales (dispensing)
// ---------------------------------------------------------------------------

export async function listSales(filters: { patientId?: string } = {}) {
  const where: Record<string, unknown> = {};
  if (filters.patientId) where.patientId = filters.patientId;

  return db.medicineSale.findMany({
    where,
    include: {
      patient: {
        select: { id: true, patientNo: true, firstName: true, lastName: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function createSale(
  actor: Actor,
  input: { patientId: string; items: { medicineId: string; quantity: number; unitPrice: number }[]; notes?: string }
) {
  const patient = await db.patient.findUnique({ where: { id: input.patientId } });
  if (!patient) throw new ApiError(404, "Patient not found");

  const total = input.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const saleNo = await nextNumber("sale");

  const sale = await db.$transaction(async (tx) => {
    // Read stock inside the transaction: medicine stock is read-modify-written
    // here, so a snapshot from outside would cause lost updates on the count.
    const medicines = await tx.medicine.findMany({
      where: { id: { in: input.items.map((i) => i.medicineId) } },
    });
    if (medicines.length !== input.items.length) {
      throw new ApiError(400, "One or more medicines were not found");
    }

    const stock = new Map(medicines.map((m) => [m.id, m]));
    for (const item of input.items) {
      const med = stock.get(item.medicineId)!;
      if (med.stock < item.quantity) {
        throw new ApiError(400, `Insufficient stock for ${med.name} — only ${med.stock} available`);
      }
    }

    const created = await tx.medicineSale.create({
      data: {
        saleNo,
        patientId: input.patientId,
        items: JSON.stringify(input.items),
        total,
        notes: input.notes ?? null,
        dispensedById: actor.userId,
        hospitalId: actor.hospitalId ?? null,
      },
    });

    for (const item of input.items) {
      const med = stock.get(item.medicineId)!;
      const balanceAfter = med.stock - item.quantity;
      await tx.medicine.update({
        where: { id: item.medicineId },
        data: { stock: balanceAfter },
      });
      const txNo = await nextNumber("tx");
      await tx.stockTransaction.create({
        data: {
          txNo,
          medicineId: item.medicineId,
          type: "OUT",
          reason: "SALE",
          quantity: -item.quantity,
          balanceAfter,
          ref: saleNo,
          createdById: actor.userId,
          hospitalId: actor.hospitalId ?? null,
        },
      });
    }
    return created;
  });

  return sale;
}
