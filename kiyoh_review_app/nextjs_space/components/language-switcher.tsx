"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { locales } from "@/i18n";

export function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [isOpen, setIsOpen] = useState(false);

    const onSelectChange = (nextLocale: string) => {
        setIsOpen(false);
        startTransition(() => {
            document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
            router.refresh();
        });
    };

    const labels: Record<string, string> = {
        en: "English",
        nl: "Nederlands",
        de: "Deutsch",
        fr: "Français",
        es: "Español"
    };

    // Flag helper (simple emoji approach for now, can be replaced with SVGs)
    const flags: Record<string, string> = {
        en: "🇺🇸",
        nl: "🇳🇱",
        de: "🇩🇪",
        fr: "🇫🇷",
        es: "🇪🇸"
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                disabled={isPending}
            >
                <span className="text-lg">{flags[locale] || "🌐"}</span>
                <ChevronDown size={14} className={`text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {locales.map((cur) => (
                            <button
                                key={cur}
                                onClick={() => onSelectChange(cur)}
                                className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors ${cur === locale ? "text-[#6bbc4a] font-medium bg-green-50/50" : "text-gray-600"
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">{flags[cur]}</span>
                                    <span>{labels[cur]}</span>
                                </div>
                                {cur === locale && <Check size={14} />}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
