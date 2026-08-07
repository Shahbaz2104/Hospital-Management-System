"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Loader2,
  Pill,
  Search,
  Stethoscope,
  Users,
} from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { apiGet } from "@/lib/api";

type PatientHit = { id: string; patientNo: string; firstName: string; lastName: string };
type DoctorHit = { id: string; user: { firstName: string; lastName: string; title: string | null }; specialization: string | null };
type MedicineHit = { id: string; name: string; category: string; unit: string; price: number };
type InvoiceHit = {
  id: string;
  invoiceNo: string;
  total: number;
  status: string;
  patient: { patientNo: string; firstName: string; lastName: string };
};

const money = (n: number) => `$${n.toFixed(2)}`;

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const active = query.trim().length >= 2;

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", query.trim()],
    queryFn: async () => {
      const [patients, doctors, medicines, invoices] = await Promise.all([
        apiGet<{ items: PatientHit[] }>("/patients", { search: query.trim(), page: 1, pageSize: 5 }),
        apiGet<{ items: DoctorHit[] }>("/doctors", { search: query.trim(), page: 1, pageSize: 5 }),
        apiGet<{ items: MedicineHit[] }>("/medicines", { search: query.trim() }),
        apiGet<{ items: InvoiceHit[]; total: number }>("/billing/invoices", {
          search: query.trim(),
          page: 1,
          pageSize: 5,
        }),
      ]);
      return {
        patients: patients.items.slice(0, 5),
        doctors: doctors.items.slice(0, 5),
        medicines: medicines.items.slice(0, 5),
        invoices: invoices.items.slice(0, 5),
      };
    },
    enabled: active,
  });

  const results =
    active && data
      ? [
          ...data.patients.map((p) => ({ key: `p-${p.id}`, href: `/patients/${p.id}`, icon: <Users className="size-3.5" />, title: `${p.firstName} ${p.lastName}`, subtitle: `Patient · ${p.patientNo}` })),
          ...data.doctors.map((d) => ({ key: `d-${d.id}`, href: `/doctors/${d.id}`, icon: <Stethoscope className="size-3.5" />, title: `${d.user.firstName} ${d.user.lastName}`, subtitle: `Doctor · ${d.specialization ?? "General"}` })),
          ...data.medicines.map((m) => ({ key: `m-${m.id}`, href: "/pharmacy", icon: <Pill className="size-3.5" />, title: m.name, subtitle: `Medicine · ${m.category.toLowerCase()} · ${money(m.price)}/${m.unit}` })),
          ...data.invoices.map((i) => ({ key: `i-${i.id}`, href: "/billing", icon: <FileText className="size-3.5" />, title: i.invoiceNo, subtitle: `Invoice · ${i.patient.firstName} ${i.patient.lastName} · ${i.status.toLowerCase()}` })),
        ]
      : [];

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
            placeholder="Search patients, doctors, medicines, invoices..."
            className="pl-9"
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
                key={r.key}
                type="button"
                onClick={() => onSelect(r.href)}
                className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  {r.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>
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
