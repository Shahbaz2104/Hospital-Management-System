"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Trash2, Stethoscope, CalendarClock, CircleCheckBig } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { DataTable } from "@/components/data/data-table";

type DepartmentOption = { id: string; name: string; code: string };
type DoctorRow = {
  id: string;
  specialization: string | null;
  consultationFee: number;
  experienceYears: number;
  available: boolean;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    title: string | null;
    status: string;
  };
  department: { id: string; name: string } | null;
};

const doctorFormSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  firstName: z.string().trim().min(2, "First name is required"),
  lastName: z.string().trim().min(2, "Last name is required"),
  phone: z.string().trim().optional(),
  title: z.string().trim().optional(),
  departmentId: z.string().optional(),
  specialization: z.string().trim().optional(),
  qualification: z.string().trim().optional(),
  licenseNumber: z.string().trim().optional(),
  experienceYears: z.coerce.number().min(0).max(60).default(0),
  consultationFee: z.coerce.number().min(0).default(0),
  available: z.boolean().default(true),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export function DoctorsPage() {
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["doctors", search],
    queryFn: () =>
      apiGet<{ items: DoctorRow[]; meta: { total: number } }>("/doctors", {
        page: 1,
        pageSize: 100,
        search,
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

  const form = useForm<z.input<typeof doctorFormSchema>>({
    resolver: zodResolver(doctorFormSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      phone: "",
      title: "",
      departmentId: "",
      specialization: "",
      qualification: "",
      licenseNumber: "",
      experienceYears: 0,
      consultationFee: 0,
      available: true,
      password: "",
    },
  });

  async function onCreate(values: z.input<typeof doctorFormSchema>) {
    try {
      await apiPost("/doctors", values);
      toast.success("Doctor created");
      setOpen(false);
      form.reset();
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create");
    }
  }

  async function onDelete(id: string, name: string) {
    if (!confirm(`Delete doctor "${name}"? The linked user account is removed too.`))
      return;
    try {
      await apiDelete(`/doctors/${id}`);
      toast.success("Doctor deleted");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  }

  const columns: ColumnDef<DoctorRow>[] = [
    {
      id: "name",
      header: "Doctor",
      cell: ({ row }) => {
        const d = row.original;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {d.user.firstName[0]}
                {d.user.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div className="leading-tight">
              <p className="font-medium">
                {d.user.title && <span className="text-muted-foreground">{d.user.title} </span>}
                {d.user.firstName} {d.user.lastName}
              </p>
              <p className="text-xs text-muted-foreground">{d.user.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "specialization",
      header: "Specialization",
      cell: ({ row }) =>
        row.original.specialization ? (
          <span className="text-sm">{row.original.specialization}</span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      header: "Department",
      cell: ({ row }) =>
        row.original.department ? (
          <Badge variant="secondary">{row.original.department.name}</Badge>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      header: "Fee",
      cell: ({ row }) => (
        <span className="text-sm">${row.original.consultationFee}</span>
      ),
    },
    {
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={row.original.available ? "default" : "secondary"}
          className={row.original.available ? "bg-emerald-600" : undefined}
        >
          {row.original.available ? "Available" : "On leave"}
        </Badge>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          aria-label="Delete doctor"
          onClick={() =>
            onDelete(row.original.id, `${row.original.user.firstName} ${row.original.user.lastName}`)
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
        title="Doctors"
        description="Clinical staff, specializations and availability"
      >
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> New doctor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create doctor</DialogTitle>
              <DialogDescription>
                Creates a DOCTOR user account with a clinical profile.
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
                          <Input {...field} placeholder="Sarah" />
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
                          <Input {...field} placeholder="Khan" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} placeholder="doctor@hospital.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                </div>
                <div className="grid grid-cols-2 gap-3">
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
                  <FormField
                    control={form.control}
                    name="specialization"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Specialization</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Cardiology" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="experienceYears"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Years of experience</FormLabel>
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
                    name="consultationFee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Consultation fee ($)</FormLabel>
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
                    name="licenseNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>License number</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Optional" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Temporary password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} placeholder="Min 8 characters" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="available"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <FormLabel>Available for appointments</FormLabel>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
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
                    Create doctor
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Doctors"
          icon={Stethoscope}
          value={data?.meta.total ?? 0}
          loading={isLoading}
        />
        <StatCard
          label="Available now"
          icon={CircleCheckBig}
          value={
            data?.items.filter((d) => d.available).length ?? 0
          }
          hint="Open for appointments"
          loading={isLoading}
        />
        <StatCard
          label="Specializations"
          icon={CalendarClock}
          value={
            new Set(
              data?.items
                .map((d) => d.specialization)
                .filter(Boolean)
            ).size ?? 0
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
        searchPlaceholder="Search doctors…"
        loading={isLoading}
      />
    </div>
  );
}