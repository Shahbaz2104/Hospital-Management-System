/**
 * Escapes HTML special characters to prevent XSS when interpolating
 * user-controlled data into raw HTML strings (e.g. print windows).
 */
export function escapeHtml(value: unknown): string {
  if (value == null) return "";
  const str = String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escapes a value for safe use inside a URL href attribute.
 * Falls back to "#" if the value looks like a javascript: URI.
 */
export function escapeHref(value: unknown): string {
  if (value == null) return "#";
  const str = String(value).trim();
  if (/^javascript:/i.test(str) || /^data:/i.test(str)) return "#";
  return escapeHtml(str);
}
