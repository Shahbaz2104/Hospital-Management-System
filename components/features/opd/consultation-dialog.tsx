"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { apiPost } from "@/lib/api";

const consultationFormSchema = z.object({
  diagnosis: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  followUpDate: z.string().optional(),
  temperature: z.string().optional(),
  pulse: z.string().optional(),
  bloodPressure: z.string().optional(),
  spo2: z.string().optional(),
  respiratoryRate: z.string().optional(),
  weightKg: z.string().optional(),
  prescriptions: z
    .array(
      z.object({
        medicine: z.string().trim().min(1, "Medicine is required"),
        dose: z.string().trim().optional(),
        frequency: z.string().trim().optional(),
        duration: z.string().trim().optional(),
        instructions: z.string().trim().optional(),
      })
    )
    .optional(),
});

const VITALS_LABELS: { key: string; label: string; unit: string }[] = [
  { key: "temperature", label: "Temperature", unit: "°C" },
  { key: "pulse", label: "Pulse", unit: "bpm" },
  { key: "bloodPressure", label: "Blood pressure", unit: "mmHg" },
  { key: "spo2", label: "SpO₂", unit: "%" },
  { key: "respiratoryRate", label: "Resp. rate", unit: "/min" },
  { key: "weightKg", label: "Weight", unit: "kg" },
];

export function ConsultationDialog({
  open,
  onOpenChange,
  patient,
  appointmentId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: { id: string; patientNo: string; firstName: string; lastName: string };
  appointmentId?: string;
  onSaved: () => void;
}) {
  const form = useForm<z.input<typeof consultationFormSchema>>({
    resolver: zodResolver(consultationFormSchema),
    defaultValues: {
      diagnosis: "",
      notes: "",
      followUpDate: "",
      temperature: "",
      pulse: "",
      bloodPressure: "",
      spo2: "",
      respiratoryRate: "",
      weightKg: "",
      prescriptions: [{ medicine: "", dose: "", frequency: "", duration: "", instructions: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "prescriptions",
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        diagnosis: "",
        notes: "",
        followUpDate: "",
        temperature: "",
        pulse: "",
        bloodPressure: "",
        spo2: "",
        respiratoryRate: "",
        weightKg: "",
        prescriptions: [{ medicine: "", dose: "", frequency: "", duration: "", instructions: "" }],
      });
    }
  }, [open, form]);

  async function onSave(values: z.input<typeof consultationFormSchema>) {
    try {
      const vitals: { name: string; value: string; unit: string }[] = [];
      for (const v of VITALS_LABELS) {
        const raw = (values as Record<string, unknown>)[v.key];
        if (typeof raw === "string" && raw.trim()) {
          vitals.push({ name: v.label, value: raw.trim(), unit: v.unit });
        }
      }
      const prescriptions = (values.prescriptions ?? []).filter(
        (p) => p.medicine.trim()
      );

      await apiPost("/consultations", {
        patientId: patient.id,
        appointmentId: appointmentId || undefined,
        diagnosis: values.diagnosis || undefined,
        notes: values.notes || undefined,
        followUpDate: values.followUpDate
          ? new Date(values.followUpDate)
          : undefined,
        vitals,
        prescriptions,
      });
      toast.success("Consultation recorded");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record consultation</DialogTitle>
          <DialogDescription>
            {patient.firstName} {patient.lastName} · {patient.patientNo}
            {appointmentId ? " · OPD visit" : ""}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Vitals
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {VITALS_LABELS.map((v) => (
                  <FormField
                    key={v.key}
                    control={form.control}
                    name={v.key as never}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">{v.label}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input type="number" step="any" {...field} className="pr-10" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                              {v.unit}
                            </span>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="diagnosis"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Diagnosis</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Acute bronchitis" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="followUpDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Follow-up</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Clinical notes (optional)" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Prescriptions
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    append({
                      medicine: "",
                      dose: "",
                      frequency: "",
                      duration: "",
                      instructions: "",
                    })
                  }
                >
                  <Plus className="size-3.5" /> Add medicine
                </Button>
              </div>
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-2 gap-2 rounded-md border bg-card p-2 sm:grid-cols-5">
                    <FormField
                      control={form.control}
                      name={`prescriptions.${index}.medicine`}
                      render={({ field }) => (
                        <FormItem className="sm:col-span-1">
                          <FormControl>
                            <Input {...field} placeholder="Medicine" className="h-8" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`prescriptions.${index}.dose`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} placeholder="Dose" className="h-8" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`prescriptions.${index}.frequency`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} placeholder="Frequency" className="h-8" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`prescriptions.${index}.duration`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} placeholder="Duration" className="h-8" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="flex items-center gap-1">
                      <FormField
                        control={form.control}
                        name={`prescriptions.${index}.instructions`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input {...field} placeholder="Instructions" className="h-8" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Save & complete
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
