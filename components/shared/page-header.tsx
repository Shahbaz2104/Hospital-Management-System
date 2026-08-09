import * as React from "react";

import { navConfig } from "@/constants/nav";

/** "Clinical" → page title → section stamp, e.g. Billing → FINANCE */
const SECTION_BY_TITLE = new Map<string, string>(
  navConfig.flatMap((section) =>
    (section.items ?? []).map((item) => [item.title, section.title ?? ""])
  )
);

export function PageHeader({
  title,
  description,
  children,
  eyebrow,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  eyebrow?: string;
}) {
  const stamp =
    eyebrow ?? (typeof title === "string" ? SECTION_BY_TITLE.get(title) : undefined);

  return (
    <div className="border-b pb-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          {stamp && <p className="eyebrow">{stamp}</p>}
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-[1.7rem] sm:leading-9">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {children && (
          <div className="flex flex-wrap items-center gap-2">{children}</div>
        )}
      </div>
    </div>
  );
}
