export function parseListParams(url: URL, defaults = { pageSize: 15 }) {
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("pageSize")) || defaults.pageSize)
  );
  const search = url.searchParams.get("search")?.trim() ?? "";
  const sort = url.searchParams.get("sort")?.trim() ?? "createdAt";
  const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";
  return { page, pageSize, search, sort, order, skip: (page - 1) * pageSize };
}

export const insensitiveContains = (
  field: string,
  value: string
): Record<string, unknown> => ({
  [field]: { contains: value, mode: "insensitive" },
});