import { describe, it, expect } from "vitest";
import {
  ALL_PERMISSIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  hasPermission,
  type PermissionKey,
  type RoleKey,
} from "@/constants/permissions";
import { can } from "@/lib/auth/can";

/**
 * These guards are the only thing between a logged-in user and an API route.
 * The matrix is asserted as data so a future permission grant cannot silently
 * widen a role.
 */
describe("hasPermission", () => {
  it("grants everything to the wildcard", () => {
    expect(hasPermission(["*"], "patients:delete")).toBe(true);
  });

  it("grants an exactly matching key", () => {
    expect(hasPermission(["patients:read"], "patients:read")).toBe(true);
  });

  it("denies a key that was not granted", () => {
    expect(hasPermission(["patients:read"], "patients:delete")).toBe(false);
  });

  it("denies everything for an empty grant list", () => {
    expect(hasPermission([], "patients:read")).toBe(false);
  });

  it("does not match on module prefix (read must not imply manage)", () => {
    expect(hasPermission(["laboratory:read"], "laboratory:manage")).toBe(false);
  });
});

describe("can (client-safe duplicate)", () => {
  const user = (permissions: PermissionKey[]) => ({ permissions });

  it("matches hasPermission semantics", () => {
    expect(can(user(["*"]), "billing:read")).toBe(true);
    expect(can(user(["billing:read"]), "billing:read")).toBe(true);
    expect(can(user(["billing:read"]), "billing:manage")).toBe(false);
  });
});

describe("ROLE_PERMISSIONS matrix integrity", () => {
  const roles = Object.keys(ROLE_PERMISSIONS) as RoleKey[];

  it("defines exactly the nine documented roles", () => {
    expect(roles).toHaveLength(9);
    expect(roles).toEqual(
      expect.arrayContaining([
        "SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST",
        "PHARMACIST", "LAB_TECHNICIAN", "ACCOUNTANT", "PATIENT",
      ])
    );
  });

  it("labels every role", () => {
    for (const role of roles) {
      expect(ROLE_LABELS[role], `missing label for ${role}`).toBeTruthy();
    }
  });

  it("grants every role only permissions that exist in the catalogue", () => {
    // SUPER_ADMIN holds the wildcard, which is not a catalogue entry.
    const known = new Set<string>([...ALL_PERMISSIONS, "*"]);
    for (const role of roles) {
      for (const key of ROLE_PERMISSIONS[role]) {
        expect(known.has(key), `${role} has unknown permission ${key}`).toBe(true);
      }
    }
  });

  it("has no duplicate entries within a role", () => {
    for (const role of roles) {
      const seen = new Set<PermissionKey>();
      for (const key of ROLE_PERMISSIONS[role]) {
        expect(seen.has(key), `${role} repeats ${key}`).toBe(false);
        seen.add(key);
      }
    }
  });

  it("gives SUPER_ADMIN only the wildcard", () => {
    expect(ROLE_PERMISSIONS.SUPER_ADMIN).toEqual(["*"]);
  });

  it("gives HOSPITAL_ADMIN the full catalogue and nothing else", () => {
    expect(new Set(ROLE_PERMISSIONS.HOSPITAL_ADMIN)).toEqual(new Set(ALL_PERMISSIONS));
  });

  it("keeps PATIENT off destructive and administrative permissions", () => {
    const patient = new Set(ROLE_PERMISSIONS.PATIENT);
    for (const forbidden of [
      "patients:delete", "users:read", "users:manage", "settings:manage",
      "audit:read", "roles:read", "payroll:read", "hr:read",
      "billing:manage", "admissions:manage",
    ] as PermissionKey[]) {
      expect(patient.has(forbidden), `PATIENT must not hold ${forbidden}`).toBe(false);
    }
  });

  it("keeps a receptionist out of clinical administration", () => {
    const rec = new Set(ROLE_PERMISSIONS.RECEPTIONIST);
    expect(rec.has("laboratory:manage")).toBe(false);
    expect(rec.has("radiology:manage")).toBe(false);
    expect(rec.has("admissions:manage")).toBe(false);
  });

  it("scopes a pharmacist to pharmacy and inventory, not patient deletion", () => {
    const pharm = new Set(ROLE_PERMISSIONS.PHARMACIST);
    expect(pharm.has("pharmacy:read")).toBe(true);
    expect(pharm.has("inventory:read")).toBe(true);
    expect(pharm.has("patients:delete")).toBe(false);
    expect(pharm.has("billing:manage")).toBe(false);
  });

  it("gives every non-admin role the dashboard so they land somewhere", () => {
    for (const role of roles) {
      expect(
        hasPermission(ROLE_PERMISSIONS[role], "dashboard:read"),
        `${role} cannot read the dashboard`
      ).toBe(true);
    }
  });
});

describe("ALL_PERMISSIONS catalogue", () => {
  it("contains no duplicates", () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
  });

  it("uses the module:action shape with no malformed keys", () => {
    for (const key of ALL_PERMISSIONS) {
      expect(key, `malformed key ${key}`).toMatch(/^[a-z_]+:[a-z]+$/);
    }
  });

  it("does not include the wildcard", () => {
    expect(ALL_PERMISSIONS).not.toContain("*");
  });
});