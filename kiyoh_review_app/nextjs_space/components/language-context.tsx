"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Messages = Record<string, any>;
type Locale = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'af' | 'zu' | 'xh';

interface LanguageContextType {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: (key: string) => string;
    loading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const dictionaries: Record<Locale, () => Promise<{ default: Messages }>> = {
    en: () => import('../messages/en.json'),
    nl: () => import('../messages/nl.json'),
    de: () => import('../messages/de.json'),
    fr: () => import('../messages/fr.json'),
    es: () => import('../messages/es.json'),
    af: () => import('../messages/af.json'),
    zu: () => import('../messages/zu.json'),
    xh: () => import('../messages/xh.json'),
};

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>('en');
    const [messages, setMessages] = useState<Messages>({});
    const [loading, setLoading] = useState(true);

    // Load saved locale on mount
    useEffect(() => {
        const saved = localStorage.getItem('kiyoh_locale') as Locale;
        if (saved && dictionaries[saved]) {
            setLocaleState(saved);
        }
    }, []);

    // Load messages when locale changes
    useEffect(() => {
        setLoading(true);
        dictionaries[locale]()
            .then((mod) => {
                setMessages(mod.default);
                setLoading(false);
            })
            .catch((err) => {
                console.error(`Failed to load locale ${locale}`, err);
                setLoading(false);
            });
    }, [locale]);

    const setLocale = (newLocale: Locale) => {
        setLocaleState(newLocale);
        localStorage.setItem('kiyoh_locale', newLocale);
    };

    const t = (key: string): string => {
        const keys = key.split('.');
        let value: any = messages;

        for (const k of keys) {
            if (value === undefined || value === null) break;
            value = value[k];
        }

        if (value === undefined || typeof value !== 'string') {
            return key; // Fallback to key if not found
        }
        return value;
    };

    return (
        <LanguageContext.Provider value={{ locale, setLocale, t, loading }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
