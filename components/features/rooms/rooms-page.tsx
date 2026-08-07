"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Building2, BedDouble, HeartPulse } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiGet, apiPost } from "@/lib/api";

type DepartmentOption = { id: string; name: string; code: string };
type Bed = {
  id: string;
  number: string;
  status: string;
  patientId: string | null;
};
type RoomRow = {
  id: string;
  number: string;
  name: string | null;
  type: string;
  floor: number;
  capacity: number;
  ratePerDay: number;
  status: string;
  department: { id: string; name: string } | null;
  beds: Bed[];
};

const roomFormSchema = z.object({
  number: z.string().trim().min(1, "Room number is required"),
  name: z.string().trim().optional(),
  type: z.enum(["ICU", "GENERAL", "PRIVATE", "SEMI_PRIVATE", "OT"]).default("GENERAL"),
  floor: z.coerce.number().min(0).default(1),
  capacity: z.coerce.number().min(1).max(50).default(2),
  ratePerDay: z.coerce.number().min(0).default(0),
  departmentId: z.string().optional(),
  bedCount: z.coerce.number().min(1).max(20).default(2),
});

const ROOM_TYPE_LABELS: Record<string, string> = {
  ICU: "ICU",
  GENERAL: "General",
  PRIVATE: "Private",
  SEMI_PRIVATE: "Semi-private",
  OT: "Operation Theatre",
};

const BED_STATUS_STYLES: Record<string, string> = {
  AVAILABLE: "bg-emerald-600",
  OCCUPIED: "bg-red-600",
  RESERVED: "bg-amber-600",
  CLEANING: "bg-slate-400",
};

export function RoomsPage() {
  const [open, setOpen] = React.useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["rooms"],
    queryFn: () =>
      apiGet<{ items: RoomRow[]; meta: { total: number } }>("/rooms", {
        page: 1,
        pageSize: 100,
      }),
  });

  const { data: departments } = useQuery({
    queryKey: ["departments", "options"],
    queryFn: () =>
      apiGet<{ items: DepartmentOption[] }>("/departments", {
        page: 1,
        pageSize: 100,
      }),
  });

  const form = useForm<z.input<typeof roomFormSchema>>({
    resolver: zodResolver(roomFormSchema),
    defaultValues: {
      number: "",
      name: "",
      type: "GENERAL",
      floor: 1,
      capacity: 2,
      ratePerDay: 0,
      departmentId: "",
      bedCount: 2,
    },
  });

  async function onCreate(values: z.input<typeof roomFormSchema>) {
    try {
      await apiPost("/rooms", values);
      toast.success("Room created");
      setOpen(false);
      form.reset();
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create");
    }
  }

  const totalBeds =
    data?.items.reduce((s, r) => s + r.beds.length, 0) ?? 0;
  const occupied =
    data?.items.reduce(
      (s, r) => s + r.beds.filter((b) => b.status === "OCCUPIED").length,
      0
    ) ?? 0;

  const summary = [
    {
      label: "Rooms",
      value: data?.items.length ?? 0,
      icon: Building2,
      hint: "Across all floors",
    },
    {
      label: "Total beds",
      value: totalBeds,
      icon: BedDouble,
      hint: "Inpatient capacity",
    },
    {
      label: "Occupied",
      value: occupied,
      icon: HeartPulse,
      hint:
        totalBeds > 0
          ? `${Math.round((occupied / totalBeds) * 100)}% occupancy`
          : "No beds yet",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Rooms & Beds"
        description="Inpatient rooms, ICU and operation theatre capacity"
      >
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> New room
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create room</DialogTitle>
              <DialogDescription>
                A room is created together with its beds.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onCreate)} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Room number</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="101" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Optional" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(ROOM_TYPE_LABELS).map(([key, label]) => (
                                <SelectItem key={key} value={key}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="departmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                            <SelectContent>
                              {departments?.items.map((d) => (
                                <SelectItem key={d.id} value={d.id}>
                                  {d.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="floor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Floor</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="capacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Capacity</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="ratePerDay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rate / day ($)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bedCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Beds</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    Create room
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {summary.map((s) => (
          <StatCard
            key={s.label}
            label={s.label}
            icon={s.icon}
            value={s.value}
            hint={s.hint}
            loading={isLoading}
          />
        ))}
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-card p-5">
                <Skeleton className="h-5 w-40" />
                <div className="mt-4 flex gap-3">
                  <Skeleton className="size-16 rounded-md" />
                  <Skeleton className="size-16 rounded-md" />
                  <Skeleton className="size-16 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <div className="rounded-lg border bg-card p-10 text-center">
            <BedDouble className="mx-auto size-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium">No rooms yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first room to start mapping inpatient capacity.
            </p>
          </div>
        ) : (
          data?.items.map((room) => {
            const occ = room.beds.filter((b) => b.status === "OCCUPIED").length;
            const pct = room.beds.length > 0 ? (occ / room.beds.length) * 100 : 0;
            return (
              <div key={room.id} className="rounded-lg border bg-card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">
                    {room.name ? `${room.name} · ${room.number}` : `Room ${room.number}`}
                  </h3>
                  <Badge variant="secondary">
                    {ROOM_TYPE_LABELS[room.type] ?? room.type}
                  </Badge>
                  {room.department && (
                    <Badge variant="outline">{room.department.name}</Badge>
                  )}
                  <span className="ml-auto text-sm text-muted-foreground">
                    Floor {room.floor} · ${room.ratePerDay}/day
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {occ}/{room.beds.length} occupied
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2">
                  {room.beds.map((bed) => (
                    <div
                      key={bed.id}
                      className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2"
                    >
                      <span
                        className={
                          "size-2 shrink-0 rounded-full " +
                          (BED_STATUS_STYLES[bed.status] ?? "bg-slate-400")
                        }
                      />
                      <div className="min-w-0 leading-tight">
                        <p className="truncate text-sm font-medium">
                          {bed.number.replace(/^.*-/, "Bed ")}
                        </p>
                        <p className="text-[11px] capitalize text-muted-foreground">
                          {bed.status.toLowerCase()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}