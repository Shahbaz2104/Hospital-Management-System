"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Trash2, Users, Moon, Sun } from "lucide-react";
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

type DepartmentOption = { id: string; name: string; code: string };
type NurseRow = {
  id: string;
  ward: string | null;
  shift: string;
  designation: string | null;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    status: string;
  };
  department: { id: string; name: string } | null;
};

const nurseFormSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  firstName: z.string().trim().min(2, "First name is required"),
  lastName: z.string().trim().min(2, "Last name is required"),
  phone: z.string().trim().optional(),
  departmentId: z.string().optional(),
  ward: z.string().trim().optional(),
  shift: z.enum(["DAY", "NIGHT", "ROTATING"]).default("DAY"),
  licenseNo: z.string().trim().optional(),
  designation: z.string().trim().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const SHIFT_LABELS: Record<string, string> = {
  DAY: "Day",
  NIGHT: "Night",
  ROTATING: "Rotating",
};

export function NursesPage() {
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["nurses", search],
    queryFn: () =>
      apiGet<{ items: NurseRow[]; meta: { total: number } }>("/nurses", {
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

  const form = useForm<z.input<typeof nurseFormSchema>>({
    resolver: zodResolver(nurseFormSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      phone: "",
      departmentId: "",
      ward: "",
      shift: "DAY",
      licenseNo: "",
      designation: "",
      password: "",
    },
  });

  async function onCreate(values: z.input<typeof nurseFormSchema>) {
    try {
      await apiPost("/nurses", values);
      toast.success("Nurse created");
      setOpen(false);
      form.reset();
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create");
    }
  }

  async function onDelete(id: string, name: string) {
    if (!confirm(`Delete nurse "${name}"? The linked user account is removed too.`))
      return;
    try {
      await apiDelete(`/nurses/${id}`);
      toast.success("Nurse deleted");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  }

  const columns: ColumnDef<NurseRow>[] = [
    {
      id: "name",
      header: "Nurse",
      cell: ({ row }) => {
        const n = row.original;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {n.user.firstName[0]}
                {n.user.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div className="leading-tight">
              <p className="font-medium">
                {n.user.firstName} {n.user.lastName}
              </p>
              <p className="text-xs text-muted-foreground">{n.user.email}</p>
            </div>
          </div>
        );
      },
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
      accessorKey: "ward",
      header: "Ward",
      cell: ({ row }) =>
        row.original.ward ? (
          <span className="text-sm">{row.original.ward}</span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "shift",
      header: "Shift",
      cell: ({ row }) => (
        <Badge variant="outline">{SHIFT_LABELS[row.original.shift] ?? row.original.shift}</Badge>
      ),
    },
    {
      accessorKey: "designation",
      header: "Designation",
      cell: ({ row }) =>
        row.original.designation ? (
          <span className="text-sm">{row.original.designation}</span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
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
        title="Nurses"
        description="Nursing staff, wards and shift assignments"
      >
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> New nurse
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create nurse</DialogTitle>
              <DialogDescription>
                Creates a NURSE user account with ward and shift details.
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
                          <Input {...field} placeholder="Maria" />
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
                          <Input {...field} placeholder="Garcia" />
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
                          <Input type="email" {...field} placeholder="nurse@hospital.com" />
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
                    name="shift"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shift</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select shift" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(SHIFT_LABELS).map(([key, label]) => (
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
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="ward"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ward</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ward A" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="licenseNo"
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
                </div>
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
                    Create nurse
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Nurses"
          icon={Users}
          value={data?.meta.total ?? 0}
          loading={isLoading}
        />
        <StatCard
          label="Day shift"
          icon={Sun}
          value={
            data?.items.filter((n) => n.shift === "DAY").length ?? 0
          }
          loading={isLoading}
        />
        <StatCard
          label="Night shift"
          icon={Moon}
          value={
            data?.items.filter(
              (n) => n.shift === "NIGHT" || n.shift === "ROTATING"
            ).length ?? 0
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
        searchPlaceholder="Search nurses…"
        loading={isLoading}
      />
    </div>
  );
}