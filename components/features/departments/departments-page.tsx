"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Trash2, Building2, Stethoscope, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
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
import { Textarea } from "@/components/ui/textarea";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { DataTable } from "@/components/data/data-table";

type Department = {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  headDoctor?: { id: string; user: { firstName: string; lastName: string } } | null;
  _count?: { doctors: number; nurses: number; rooms: number };
};

const departmentFormSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  code: z
    .string()
    .trim()
    .min(2, "Code is required")
    .max(10)
    .regex(/^[A-Z0-9_-]+$/, "Only letters, numbers, - and _"),
  description: z.string().trim().max(500).optional(),
});

export function DepartmentsPage() {
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["departments", search],
    queryFn: () =>
      apiGet<{ items: Department[]; meta: { total: number } }>("/departments", {
        page: 1,
        pageSize: 100,
        search,
      }),
  });

  const form = useForm<z.infer<typeof departmentFormSchema>>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: { name: "", code: "", description: "" },
  });

  async function onCreate(values: z.infer<typeof departmentFormSchema>) {
    try {
      await apiPost("/departments", values);
      toast.success("Department created");
      setOpen(false);
      form.reset();
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create");
    }
  }

  async function onDelete(id: string, name: string) {
    if (
      !confirm(
        `Delete department "${name}"? Staff will be unlinked but not deleted.`
      )
    )
      return;
    try {
      await apiDelete(`/departments/${id}`);
      toast.success("Department deleted");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  }

  const columns: ColumnDef<Department>[] = [
    {
      accessorKey: "name",
      header: "Department",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          {row.original.description && (
            <p className="max-w-[360px] truncate text-xs text-muted-foreground">
              {row.original.description}
            </p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => (
        <Badge variant="secondary" className="font-mono">
          {row.original.code}
        </Badge>
      ),
    },
    {
      header: "Head",
      cell: ({ row }) => (
        <HoverCard>
          <HoverCardTrigger asChild>
            <button className="text-sm text-primary hover:underline">
              {row.original.headDoctor
                ? `${row.original.headDoctor.user.firstName} ${row.original.headDoctor.user.lastName}`
                : "—"}
            </button>
          </HoverCardTrigger>
          {row.original.headDoctor && (
            <HoverCardContent className="w-64">
              <p className="text-sm font-medium">
                Department head — {row.original.name}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {row.original.headDoctor.user.firstName}{" "}
                {row.original.headDoctor.user.lastName}
              </p>
            </HoverCardContent>
          )}
        </HoverCard>
      ),
    },
    {
      header: "Staff",
      cell: ({ row }) => (
        <HoverCard>
          <HoverCardTrigger asChild>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span>{row.original._count?.doctors ?? 0} doctors</span>
              <span>{row.original._count?.nurses ?? 0} nurses</span>
            </div>
          </HoverCardTrigger>
          <HoverCardContent className="w-60">
            <p className="text-sm font-medium">Staff in {row.original.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {row.original._count?.doctors ?? 0} doctors ·{" "}
              {row.original._count?.nurses ?? 0} nurses ·{" "}
              {row.original._count?.rooms ?? 0} rooms
            </p>
          </HoverCardContent>
        </HoverCard>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(row.original.id, row.original.name)}
        >
          <Trash2 className="size-4" />
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Departments"
        description="Organize clinical and administrative units"
      >
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> New department
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create department</DialogTitle>
              <DialogDescription>
                Departments group doctors, nurses and rooms.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onCreate)} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Cardiology" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Code</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="CARD" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Optional" />
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
                    Create
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Departments"
          icon={Building2}
          value={data?.items.length ?? 0}
          loading={isLoading}
        />
        <StatCard
          label="Doctors"
          icon={Stethoscope}
          value={
            data?.items.reduce(
              (s, d) => s + (d._count?.doctors ?? 0),
              0
            ) ?? 0
          }
          loading={isLoading}
        />
        <StatCard
          label="Nurses"
          icon={Users}
          value={
            data?.items.reduce(
              (s, d) => s + (d._count?.nurses ?? 0),
              0
            ) ?? 0
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
        searchPlaceholder="Search departments…"
        loading={isLoading}
      />
    </div>
  );
}