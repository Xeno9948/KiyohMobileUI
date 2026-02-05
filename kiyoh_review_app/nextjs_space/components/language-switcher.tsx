"use client";

import { useLanguage } from "./language-context";
import { Globe, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'af', name: 'Afrikaans', flag: '🇿🇦' },
    { code: 'zu', name: 'Isizulu', flag: '🇿🇦' },
    { code: 'xh', name: 'Isixhosa', flag: '🇿🇦' },
] as const;

export function LanguageSwitcher() {
    const { locale, setLocale } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const currentLanguage = languages.find(l => l.code === locale) || languages[0];

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors flex items-center gap-2"
                title="Change Language"
            >
                <div className="w-5 h-5 flex items-center justify-center text-sm">
                    {currentLanguage.flag}
                </div>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => {
                                setLocale(lang.code as any);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors ${locale === lang.code ? "text-[#6bbc4a] font-medium bg-green-50" : "text-gray-600"
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-base">{lang.flag}</span>
                                <span>{lang.name}</span>
                            </div>
                            {locale === lang.code && <Check size={14} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
