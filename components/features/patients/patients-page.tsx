"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Trash2, Users, HeartPulse, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { DataTable } from "@/components/data/data-table";
import { BLOOD_GROUPS, GENDERS } from "@/validators/clinical";

type PatientRow = {
  id: string;
  patientNo: string;
  firstName: string;
  lastName: string;
  dob: string | null;
  gender: string | null;
  bloodGroup: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  allergies: string | null;
  insuranceProvider: string | null;
  _count?: { appointments: number };
};

const patientFormSchema = z.object({
  firstName: z.string().trim().min(2, "First name is required"),
  lastName: z.string().trim().min(2, "Last name is required"),
  phone: z.string().trim().optional(),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  dob: z.string().optional(),
  gender: z.enum(GENDERS).optional(),
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  allergies: z.string().trim().optional(),
  insuranceProvider: z.string().trim().optional(),
  insuranceNumber: z.string().trim().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  emergencyContact: z.string().trim().optional(),
});

export function PatientsPage() {
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["patients", search],
    queryFn: () =>
      apiGet<{ items: PatientRow[]; meta: { total: number } }>("/patients", {
        page: 1,
        pageSize: 100,
        search,
      }),
  });

  const form = useForm<z.input<typeof patientFormSchema>>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      dob: "",
      gender: undefined,
      bloodGroup: undefined,
      allergies: "",
      insuranceProvider: "",
      insuranceNumber: "",
      address: "",
      city: "",
      emergencyContact: "",
    },
  });

  async function onCreate(values: z.input<typeof patientFormSchema>) {
    try {
      await apiPost("/patients", {
        ...values,
        dob: values.dob ? new Date(values.dob) : undefined,
      });
      toast.success("Patient registered");
      setOpen(false);
      form.reset();
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to register");
    }
  }

  async function onDelete(id: string, name: string) {
    if (!confirm(`Delete patient "${name}"? Their appointments are removed too.`))
      return;
    try {
      await apiDelete(`/patients/${id}`);
      toast.success("Patient deleted");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  }

  const withInsurance = data?.items.filter((p) => p.insuranceProvider).length ?? 0;

  const columns: ColumnDef<PatientRow>[] = [
    {
      id: "patient",
      header: "Patient",
      cell: ({ row }) => {
        const p = row.original;
        const age = p.dob
          ? Math.floor(
              (Date.now() - new Date(p.dob).getTime()) / (365.25 * 24 * 3600 * 1000)
            )
          : null;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="size-9">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {p.firstName[0]}
                {p.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div className="leading-tight">
              <p className="font-medium">
                {p.firstName} {p.lastName}
              </p>
              <p className="text-xs font-mono text-muted-foreground">
                {p.patientNo}
                {age !== null && <span> · {age} yrs</span>}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      header: "Contact",
      cell: ({ row }) => (
        <div className="leading-tight">
          <p className="text-sm">{row.original.phone ?? "—"}</p>
          {row.original.email && (
            <p className="text-xs text-muted-foreground">{row.original.email}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "gender",
      header: "Gender",
      cell: ({ row }) =>
        row.original.gender ? (
          <span className="text-sm capitalize">{row.original.gender.toLowerCase()}</span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "bloodGroup",
      header: "Blood",
      cell: ({ row }) =>
        row.original.bloodGroup ? (
          <Badge variant="outline" className="font-mono">
            {row.original.bloodGroup}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      header: "Allergies",
      cell: ({ row }) =>
        row.original.allergies ? (
          <Badge variant="destructive" className="max-w-[160px] truncate">
            {row.original.allergies}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">None</span>
        ),
    },
    {
      header: "Visits",
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {row.original._count?.appointments ?? 0}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          onClick={() =>
            onDelete(row.original.id, `${row.original.firstName} ${row.original.lastName}`)
          }
        >
          <Trash2 className="size-4" />
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Patients"
        description="Registration, medical history and insurance"
      >
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> Register patient
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Register patient</DialogTitle>
              <DialogDescription>
                A patient ID is generated automatically.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onCreate)} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Zara" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ali" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="dob"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of birth</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
                        <FormControl>
                          <Select value={field.value ?? ""} onValueChange={field.onChange}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                            <SelectContent>
                              {GENDERS.map((g) => (
                                <SelectItem key={g} value={g}>
                                  {g.charAt(0) + g.slice(1).toLowerCase()}
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
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="+1 555 000 1234" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} placeholder="patient@mail.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="bloodGroup"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Blood group</FormLabel>
                        <FormControl>
                          <Select value={field.value ?? ""} onValueChange={field.onChange}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select blood group" />
                            </SelectTrigger>
                            <SelectContent>
                              {BLOOD_GROUPS.map((b) => (
                                <SelectItem key={b} value={b}>
                                  {b}
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
                    name="emergencyContact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Emergency contact</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="+1 555 000 9999" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="allergies"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Allergies</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. Penicillin, peanuts (comma separated)" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="insuranceProvider"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Insurance provider</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Optional" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="insuranceNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Insurance number</FormLabel>
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
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Optional" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Optional" />
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
                    Register
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Patients"
          icon={Users}
          value={data?.meta.total ?? 0}
          loading={isLoading}
        />
        <StatCard
          label="With insurance"
          icon={ShieldCheck}
          value={withInsurance}
          hint="Covered patients"
          loading={isLoading}
        />
        <StatCard
          label="Total visits"
          icon={HeartPulse}
          value={
            data?.items.reduce((s, p) => s + (p._count?.appointments ?? 0), 0) ?? 0
          }
          loading={isLoading}
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        total={data?.meta.total ?? 0}
        page={1}
        pageSize={100}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, ID, phone…"
        loading={isLoading}
      />
    </div>
  );
}