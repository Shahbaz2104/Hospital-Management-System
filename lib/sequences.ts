/**
 * Numeric sequence helper for "PREFIX-0001" style identifiers.
 *
 * Computes the max numeric suffix across the whole collection instead of
 * relying on a lexicographic `findFirst({ orderBy: { field: "desc" } })`,
 * which mis-orders past 9999 ("INV-10000" sorts before "INV-9999") and
 * would hand out duplicate numbers.
 *
 * `load` is a callback returning only the sequence field for every row, e.g.
 * `() => db.purchaseOrder.findMany({ select: { poNumber: true } })`.
 */
export async function nextSeq(
  load: () => Promise<Array<Record<string, unknown>>>,
  field: string,
  prefix: string,
  pad = 4
): Promise<string> {
  const rows = await load();
  let max = 0;
  for (const row of rows) {
    const value = row[field];
    if (typeof value !== "string") continue;
    const n = parseInt(value.replace(/\D+/g, ""), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `${prefix}-${String(max + 1).padStart(pad, "0")}`;
}
