"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Magnetic } from "@/components/motion/magnetic";
import { Button } from "@/components/ui/button";
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
import type { ForgotPasswordInput } from "@/validators/auth";
import { forgotPasswordSchema } from "@/validators/auth";

export function ForgotPasswordForm() {
  const [sent, setSent] = React.useState(false);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    try {
      await apiPost("/auth/forgot-password", values);
      setSent(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request failed");
    }
  }

  if (sent) {
    return (
      <div className="rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed text-muted-foreground">
        If an account exists for that email, a reset link has been sent. Check
        your inbox (and spam folder).
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="you@hospital.com"
                  autoComplete="email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Magnetic className="w-full">
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Send reset link
          </Button>
        </Magnetic>
      </form>
    </Form>
  );
}