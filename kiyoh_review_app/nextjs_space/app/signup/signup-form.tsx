"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Mail, Lock, User, UserPlus, Loader2, AlertCircle, CheckCircle } from "lucide-react";

export default function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Wachtwoorden komen niet overeen");
      return;
    }

    if (password.length < 6) {
      setError("Wachtwoord moet minimaal 6 karakters bevatten");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Registratie mislukt");
      }

      router.push("/login?registered=true");
    } catch (err: any) {
      setError(err.message || "Er is iets misgegaan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f5f5f5]">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 relative">
            <Image src="/kiyoh-logo.png" alt="Kiyoh" fill className="object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-[#3d3d3d]">Account aanmaken</h1>
          <p className="text-gray-500 mt-1">Start met het beheren van uw reviews</p>
        </div>

        {/* Signup Card */}
        <div className="kiyoh-card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-600">
                <AlertCircle size={20} />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Naam
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="kiyoh-input with-icon"
                  placeholder="Uw naam"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                E-mailadres
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="kiyoh-input with-icon"
                  placeholder="naam@voorbeeld.nl"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Wachtwoord
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="kiyoh-input with-icon"
                  placeholder="Minimaal 6 karakters"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Wachtwoord bevestigen
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="kiyoh-input with-icon"
                  placeholder="Herhaal wachtwoord"
                  required
                />
              </div>
              {password && confirmPassword && (
                <p className={`text-xs mt-1 flex items-center gap-1 ${password === confirmPassword ? "text-green-600" : "text-red-500"}`}>
                  {password === confirmPassword ? (
                    <>
                      <CheckCircle size={12} />
                      Wachtwoorden komen overeen
                    </>
                  ) : (
                    <>
                      <AlertCircle size={12} />
                      Wachtwoorden komen niet overeen
                    </>
                  )}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-kiyoh justify-center disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <UserPlus size={20} />
              )}
              {loading ? "Account aanmaken..." : "Account aanmaken"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-gray-500 text-sm">
              Heeft u al een account?{" "}
              <Link href="/login" className="text-[#6bbc4a] font-medium hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-gray-400 text-xs mt-6">
          Powered by Kiyoh Review Management
        </p>
      </div>
    </div>
  );
}
