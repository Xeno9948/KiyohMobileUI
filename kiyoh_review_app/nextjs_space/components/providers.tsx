"use client";

import { SessionProvider } from "next-auth/react";
import { useState, useEffect, ReactNode } from "react";
import { LanguageProvider } from "./language-context";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <LanguageProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}