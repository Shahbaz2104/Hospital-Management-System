"use client";

import * as React from "react";
import { toast } from "sonner";

import type { UploadPurpose } from "@/lib/upload";

export function useUpload(purpose: UploadPurpose, onUploaded?: (file: { url: string; name: string }) => void) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const upload = React.useCallback(
    (file: File) => {
      const body = new FormData();
      body.append("purpose", purpose);
      body.append("file", file);
      return fetch("/api/upload", {
        method: "POST",
        body,
        credentials: "include",
      })
        .then(async (res) => {
          const json = (await res.json().catch(() => null)) as {
            success?: boolean;
            error?: string;
            data?: { url: string; name: string };
          } | null;
          if (!res.ok || !json?.success || !json.data) {
            throw new Error(json?.error ?? "Upload failed");
          }
          return json.data;
        })
        .then((data) => {
          onUploaded?.(data);
          return data;
        })
        .catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : "Upload failed");
          throw e;
        });
    },
    [purpose, onUploaded]
  );

  const openPicker = React.useCallback(() => inputRef.current?.click(), []);

  const picker = (
    <input
      ref={inputRef}
      type="file"
      accept={purpose === "logo" ? "image/png,image/jpeg,image/webp,image/svg+xml" : "image/png,image/jpeg,image/webp,application/pdf"}
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) void upload(file);
        e.target.value = "";
      }}
    />
  );

  return { upload, openPicker, picker };
}
