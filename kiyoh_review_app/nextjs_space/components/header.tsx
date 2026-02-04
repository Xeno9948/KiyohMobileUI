"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { LayoutDashboard, Star, Send, Settings, LogOut, Menu, X, Shield } from "lucide-react";
import NotificationCenter from "./notification-center";
import { ThemeToggle } from "./theme-toggle";
import { LanguageSwitcher } from "./language-switcher";

export default function Header() {
  const pathname = usePathname();
  const { data: session } = useSession() || {};
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => pathname === path;

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/reviews", label: "Reviews", icon: Star },
    { href: "/invite", label: "Uitnodigingen", icon: Send },
    { href: "/settings", label: "Instellingen", icon: Settings },
  ];

  const isSuperAdmin = (session?.user as any)?.role === "superadmin";

  if (!session) return null;

  return (
    <header className="header-nav sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 relative">
              <Image
                src="/kiyoh-logo.png"
                alt="Kiyoh"
                fill
                className="object-contain"
              />
            </div>
            <span className="font-semibold text-base text-[#3d3d3d] hidden sm:block">Kiyoh Manager</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive(item.href)
                    ? "bg-[#6bbc4a]/10 text-[#6bbc4a]"
                    : "text-gray-600 hover:bg-gray-100 hover:text-[#3d3d3d]"
                    }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}

            {isSuperAdmin && (
              <Link
                href="/admin"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive("/admin")
                  ? "bg-[#eb5b0c]/10 text-[#eb5b0c]"
                  : "text-gray-600 hover:bg-gray-100 hover:text-[#3d3d3d]"
                  }`}
              >
                <Shield size={18} />
                Admin
              </Link>
            )}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            {/* Notification Center */}
            <NotificationCenter />

            <ThemeToggle />
            <LanguageSwitcher />

            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-[#3d3d3d]">{session.user?.name || session.user?.email}</p>
              <p className="text-xs text-gray-500">{(session.user as any)?.companyName || "No company"}</p>
            </div>

            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="btn-secondary !p-2 hidden sm:flex"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100 animate-fade-in">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isActive(item.href)
                      ? "bg-[#6bbc4a]/10 text-[#6bbc4a]"
                      : "text-gray-600 hover:bg-gray-100"
                      }`}
                  >
                    <Icon size={20} />
                    {item.label}
                  </Link>
                );
              })}

              {isSuperAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isActive("/admin")
                    ? "bg-[#eb5b0c]/10 text-[#eb5b0c]"
                    : "text-gray-600 hover:bg-gray-100"
                    }`}
                >
                  <Shield size={20} />
                  Admin
                </Link>
              )}

              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 w-full"
              >
                <LogOut size={20} />
                Uitloggen
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
