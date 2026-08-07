import * as React from "react";

import { LenisProvider } from "@/components/providers/lenis-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <LenisProvider>
        <QueryProvider>{children}</QueryProvider>
      </LenisProvider>
    </ThemeProvider>
  );
}