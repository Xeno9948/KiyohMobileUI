"use client";

import { useLanguage } from "@/components/language-context";

export function useTranslations(namespace?: string) {
    const { t } = useLanguage();

    return (key: string) => {
        // If exact match exists (e.g. for "logout"), use it
        if (!namespace) return t(key);

        // Otherwise try namespace.key
        return t(`${namespace}.${key}`);
    };
}
