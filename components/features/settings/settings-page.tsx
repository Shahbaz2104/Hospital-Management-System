"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Loader2, Mail, Save, Settings2 } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { useUpload } from "@/components/shared/use-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet, apiPatch } from "@/lib/api";

type SettingsOverview = {
  hospital: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    logoUrl: string;
    currency: string;
    taxRate: number;
    timezone: string;
    workingHoursStart: string;
    workingHoursEnd: string;
    appointmentDuration: number;
  };
  smtp: { host: string; port: number; secure: boolean; user: string; pass: string; hasPassword: boolean; from: string };
  notifications: {
    lowStockThreshold: number;
    expiryAlertDays: number;
    appointmentReminderMinutes: number;
    emailOnAlerts: boolean;
  };
};

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState("hospital");

  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiGet<SettingsOverview>("/settings"),
  });

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader title="Settings" description="Hospital configuration" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["settings"] });
  }

  return (
    <div>
      <PageHeader title="Settings" description="Hospital configuration" />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="hospital"><Building2 className="mr-1.5 size-3.5" /> Hospital</TabsTrigger>
          <TabsTrigger value="smtp"><Mail className="mr-1.5 size-3.5" /> Email (SMTP)</TabsTrigger>
          <TabsTrigger value="notifications"><Settings2 className="mr-1.5 size-3.5" /> Alerts</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4">
        {tab === "hospital" && <HospitalTab initial={data.hospital} onSaved={invalidate} />}
        {tab === "smtp" && <SmtpTab initial={data.smtp} onSaved={invalidate} />}
        {tab === "notifications" && <AlertsTab initial={data.notifications} onSaved={invalidate} />}
      </div>
    </div>
  );
}

function HospitalTab({ initial, onSaved }: { initial: SettingsOverview["hospital"]; onSaved: () => void }) {
  const [form, setForm] = React.useState(initial);
  const { openPicker, picker } = useUpload("logo");

  const mut = useMutation({
    mutationFn: () => apiPatch("/settings", form),
    onSuccess: () => { toast.success("Hospital settings saved"); onSaved(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const set = (key: keyof SettingsOverview["hospital"]) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: key === "taxRate" || key === "appointmentDuration" ? Number(e.target.value) : e.target.value }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Hospital information</CardTitle>
        <CardDescription>Identity, branding and operational defaults.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={form.name} onChange={set("name")} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Email</Label>
            <Input value={form.email} onChange={set("email")} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Phone</Label>
            <Input value={form.phone} onChange={set("phone")} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Address</Label>
            <Input value={form.address} onChange={set("address")} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">City</Label>
            <Input value={form.city} onChange={set("city")} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Country</Label>
            <Input value={form.country} onChange={set("country")} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Logo</Label>
            <div className="flex items-center gap-2">
              {form.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logoUrl} alt="Hospital logo preview" className="size-10 rounded-md border object-cover" />
              ) : null}
              <Input value={form.logoUrl} onChange={set("logoUrl")} placeholder="https://… or upload below" />
              <Button type="button" variant="outline" size="sm" onClick={openPicker} className="shrink-0">
                {picker}Upload
              </Button>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Currency</Label>
            <Input value={form.currency} onChange={set("currency")} placeholder="USD" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Tax rate (%)</Label>
            <Input type="number" min={0} max={100} value={form.taxRate} onChange={set("taxRate")} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Timezone</Label>
            <Input value={form.timezone} onChange={set("timezone")} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Working hours start</Label>
            <Input value={form.workingHoursStart} onChange={set("workingHoursStart")} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Working hours end</Label>
            <Input value={form.workingHoursEnd} onChange={set("workingHoursEnd")} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Appointment duration (min)</Label>
            <Input type="number" min={5} max={120} value={form.appointmentDuration} onChange={set("appointmentDuration")} />
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.name.trim()}>
            {mut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save hospital settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SmtpTab({ initial, onSaved }: { initial: SettingsOverview["smtp"]; onSaved: () => void }) {
  const [form, setForm] = React.useState({ ...initial, pass: "" });

  const mut = useMutation({
    mutationFn: () => apiPatch("/settings/smtp", form),
    onSuccess: () => { toast.success("SMTP settings saved"); onSaved(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const set = (key: keyof SettingsOverview["smtp"]) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({
      ...f,
      [key]: key === "port" ? Number(e.target.value) : key === "secure" ? e.target.checked : e.target.value,
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Email (SMTP)</CardTitle>
        <CardDescription>
          Used for notification emails, payslips and appointment reminders. Leave blank to disable.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">Host</Label>
            <Input value={form.host} onChange={set("host")} placeholder="smtp.example.com" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Port</Label>
            <Input type="number" value={form.port} onChange={set("port")} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Username</Label>
            <Input value={form.user} onChange={set("user")} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Password</Label>
            <Input
              type="password"
              value={form.pass}
              onChange={set("pass")}
              placeholder={initial.hasPassword ? "•••••••• (leave blank to keep current)" : "SMTP password"}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">From address</Label>
            <Input value={form.from} onChange={set("from")} placeholder="no-reply@hospital.com" />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" checked={form.secure} onChange={set("secure")} className="size-4 rounded border-input" />
            Use TLS/SSL (secure port 465)
          </label>
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.host.trim()}>
            {mut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save SMTP settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertsTab({ initial, onSaved }: { initial: SettingsOverview["notifications"]; onSaved: () => void }) {
  const [form, setForm] = React.useState(initial);

  const mut = useMutation({
    mutationFn: () => apiPatch("/settings/notifications", form),
    onSuccess: () => { toast.success("Alert settings saved"); onSaved(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const set = (key: keyof SettingsOverview["notifications"]) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({
      ...f,
      [key]: key === "emailOnAlerts" ? e.target.checked : Number(e.target.value),
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Automatic alerts</CardTitle>
        <CardDescription>Thresholds for the lazy alert pipeline (low stock, expiry, appointment reminders).</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">Low-stock threshold (units)</Label>
            <Input type="number" min={0} value={form.lowStockThreshold} onChange={set("lowStockThreshold")} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Expiry alert window (days)</Label>
            <Input type="number" min={1} max={365} value={form.expiryAlertDays} onChange={set("expiryAlertDays")} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Appointment reminder (min before)</Label>
            <Input type="number" min={5} max={1440} value={form.appointmentReminderMinutes} onChange={set("appointmentReminderMinutes")} />
          </div>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.emailOnAlerts} onChange={set("emailOnAlerts")} className="size-4 rounded border-input" />
          Send email in addition to in-app notifications
        </label>
        <div className="mt-5 flex justify-end">
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save alert settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
