"use client";

import { SessionProvider } from "next-auth/react";
import { useState, useEffect, ReactNode } from "react";
import { LanguageProvider } from "./language-context";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <LanguageProvider>
        {children}
      </LanguageProvider>
    </SessionProvider>
  );
}