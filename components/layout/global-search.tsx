"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BedDouble,
  Building2,
  CalendarClock,
  FileText,
  Loader2,
  Pill,
  Search,
  Stethoscope,
  UserRound,
} from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { apiGet } from "@/lib/api";

type SearchHit = { id: string; label: string; sub: string; href: string };

function iconForHref(href: string) {
  if (href.startsWith("/patients")) return <UserRound className="size-3.5" />;
  if (href.startsWith("/doctors")) return <Stethoscope className="size-3.5" />;
  if (href.startsWith("/appointments")) return <CalendarClock className="size-3.5" />;
  if (href.startsWith("/pharmacy")) return <Pill className="size-3.5" />;
  if (href.startsWith("/departments")) return <Building2 className="size-3.5" />;
  if (href.startsWith("/staff")) return <BedDouble className="size-3.5" />;
  return <FileText className="size-3.5" />;
}

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "/") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const active = query.trim().length >= 2;

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", query.trim()],
    queryFn: () => apiGet<{ items: SearchHit[]; total: number }>("/search", { q: query.trim(), limit: 10 }),
    enabled: active,
  });

  const results = data?.items ?? [];
  const firstHref = results[0]?.href;

  function onSelect(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative hidden w-full max-w-md sm:block">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search patients, tokens, invoices, medicines…"
            className="pl-9 pr-10 text-[13px]"
            aria-label="Global search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim().length >= 2) setOpen(true);
            }}
            onFocus={() => {
              if (query.trim().length >= 2) setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && firstHref) {
                e.preventDefault();
                onSelect(firstHref);
              }
              if (e.key === "Escape") setOpen(false);
            }}
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-sm border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            /
          </kbd>
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {!active ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            Type at least 2 characters to search.
          </p>
        ) : isFetching && !data ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            No results for “{query.trim()}”.
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto p-1.5" data-lenis-prevent>
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onSelect(r.href)}
                className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  {iconForHref(r.href)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.sub}</span>
                </span>
              </button>
            ))}
            <p className="border-t px-2.5 pt-2 pb-1 text-center text-[11px] text-muted-foreground">
              Press Enter for first result · Esc to close
            </p>
          </div>
        )}
        {isFetching && data && (
          <div className="flex items-center justify-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Searching…
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
