import { describe, it, expect } from "vitest";
import { nextSeq } from "@/lib/sequences";

/**
 * BUGS.md #29 / ROADMAP Phase 1: sequence counters must not mis-order past
 * 9999. A lexicographic max would see "INV-9999" > "INV-10000" and reissue
 * INV-10000 forever.
 */
describe("nextSeq", () => {
  const rows = (...values: string[]) =>
    values.map((v) => ({ no: v }));

  it("starts at 0001 for an empty collection", async () => {
    const result = await nextSeq(async () => [], "no", "PT");
    expect(result).toBe("PT-0001");
  });

  it("increments from the highest existing value", async () => {
    const result = await nextSeq(async () => rows("PT-0001", "PT-0007", "PT-0003"), "no", "PT");
    expect(result).toBe("PT-0008");
  });

  it("compares numerically, not lexicographically, past 9999", async () => {
    // Sorted lexicographically this is already ascending, which is exactly the
    // trap: a naive `findFirst(orderBy: { no: "desc" })` returns PT-10000 and
    // would hand out PT-10001 while PT-9999 rows still exist.
    const result = await nextSeq(
      async () => rows("PT-9998", "PT-9999", "PT-10000", "PT-10001"),
      "no",
      "PT"
    );
    expect(result).toBe("PT-10002");
  });

  it("is insensitive to row ordering", async () => {
    const ascending = await nextSeq(async () => rows("A-0001", "A-0002", "A-0003"), "no", "A");
    const descending = await nextSeq(async () => rows("A-0003", "A-0002", "A-0001"), "no", "A");
    expect(ascending).toBe("A-0004");
    expect(descending).toBe(ascending);
  });

  it("pads to 4 digits by default and honours a custom width", async () => {
    expect(await nextSeq(async () => [], "no", "INV")).toBe("INV-0001");
    expect(await nextSeq(async () => [], "no", "PT", 6)).toBe("PT-000001");
  });

  it("strips non-digits from mixed prefixes", async () => {
    const result = await nextSeq(async () => rows("ER-0001", "ER-0002"), "no", "ER");
    expect(result).toBe("ER-0003");
  });

  it("ignores non-string and unparseable values instead of producing NaN", async () => {
    const dirty = [
      { no: "PT-0005" },
      { no: null },
      { no: undefined },
      { no: 42 },
      { no: "not-a-number" },
      { no: "PT-0004" },
    ] as unknown as Array<Record<string, unknown>>;
    const result = await nextSeq(async () => dirty, "no", "PT");
    expect(result).toBe("PT-0006");
  });

  it("returns the padded successor for a single existing row", async () => {
    expect(await nextSeq(async () => rows("INV-0042"), "no", "INV")).toBe("INV-0043");
  });
});