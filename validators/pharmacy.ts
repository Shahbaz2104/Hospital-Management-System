import { z } from "zod";

export const MEDICINE_CATEGORIES = [
  "ANALGESIC",
  "ANTIBIOTIC",
  "ANTIPYRETIC",
  "ANTACID",
  "VITAMIN",
  "ANTIALLERGIC",
  "CARDIAC",
  "DIABETIC",
  "RESPIRATORY",
  "GENERAL",
] as const;

export const medicineSchema = z.object({
  name: z.string().trim().min(2, "Medicine name is required"),
  genericName: z.string().trim().optional(),
  category: z.enum(MEDICINE_CATEGORIES).default("GENERAL"),
  manufacturer: z.string().trim().optional(),
  unit: z.string().trim().min(1, "Unit is required").default("tablet"),
  packSize: z.coerce.number().int().min(1).default(1),
  price: z.coerce.number().min(0).default(0),
  cost: z.coerce.number().min(0).default(0),
  stock: z.coerce.number().int().min(0).default(0),
  reorderLevel: z.coerce.number().int().min(0).default(10),
  expiryDate: z.coerce.date().optional(),
  storage: z.string().trim().optional(),
  barcode: z.string().trim().optional(),
  description: z.string().trim().optional(),
});

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "Supplier name is required"),
  contactPerson: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  address: z.string().trim().optional(),
  taxId: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const purchaseOrderItemSchema = z.object({
  medicineId: z.string().min(1, "Medicine is required"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  unitCost: z.coerce.number().min(0).default(0),
  batchNo: z.string().trim().optional(),
  expiryDate: z.coerce.date().optional(),
});

export const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  items: z.array(purchaseOrderItemSchema).min(1, "Add at least one item"),
  notes: z.string().trim().optional(),
});

export const stockTransactionSchema = z.object({
  medicineId: z.string().min(1, "Medicine is required"),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]).default("IN"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  reason: z.string().trim().optional(),
  batchNo: z.string().trim().optional(),
  expiryDate: z.coerce.date().optional(),
});

export const saleItemSchema = z.object({
  medicineId: z.string().min(1, "Medicine is required"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  unitPrice: z.coerce.number().min(0).default(0),
});

export const saleSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  items: z.array(saleItemSchema).min(1, "Add at least one item"),
  notes: z.string().trim().optional(),
});

export const EQUIPMENT_CATEGORIES = [
  "DIAGNOSTIC",
  "SURGICAL",
  "MONITORING",
  "SUPPORT",
  "OTHER",
] as const;

export const EQUIPMENT_STATUSES = [
  "OPERATIONAL",
  "UNDER_MAINTENANCE",
  "OUT_OF_SERVICE",
  "DISPOSED",
] as const;

export const equipmentSchema = z.object({
  name: z.string().trim().min(2, "Equipment name is required"),
  category: z.enum(EQUIPMENT_CATEGORIES).default("DIAGNOSTIC"),
  manufacturer: z.string().trim().optional(),
  supplierId: z.string().optional(),
  serialNo: z.string().trim().optional(),
  purchaseDate: z.coerce.date().optional(),
  purchaseCost: z.coerce.number().min(0).default(0),
  warrantyExpiry: z.coerce.date().optional(),
  location: z.string().trim().optional(),
  status: z.enum(EQUIPMENT_STATUSES).default("OPERATIONAL"),
  nextMaintenance: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
});

export type MedicineInput = z.infer<typeof medicineSchema>;
export type PurchaseOrderInput = z.infer<typeof purchaseOrderSchema>;
export type SaleInput = z.infer<typeof saleSchema>;
export type EquipmentInput = z.infer<typeof equipmentSchema>;
