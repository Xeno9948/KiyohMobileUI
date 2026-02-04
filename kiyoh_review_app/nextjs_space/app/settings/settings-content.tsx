"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings, Key, Globe, Hash, CheckCircle, AlertCircle, Loader2, ExternalLink, Save } from "lucide-react";
import Image from "next/image";

interface Company {
  id: string;
  name: string;
  locationId: string;
  apiToken: string;
  tenantId: string;
  baseUrl: string;
}

export default function SettingsContent() {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    locationId: "",
    apiToken: "",
    tenantId: "98",
    baseUrl: "https://www.kiyoh.com",
  });

  useEffect(() => {
    fetchCompany();
  }, []);

  const fetchCompany = async () => {
    try {
      const res = await fetch("/api/company");
      if (res.ok) {
        const data = await res.json();
        if (data.company) {
          setCompany(data.company);
          setFormData({
            name: data.company.name || "",
            locationId: data.company.locationId || "",
            apiToken: "",
            tenantId: data.company.tenantId || "98",
            baseUrl: data.company.baseUrl || "https://www.kiyoh.com",
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch company:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Kon instellingen niet opslaan");
      }

      setSuccess("Instellingen succesvol opgeslagen!");
      setCompany(data.company);
      setFormData((prev) => ({ ...prev, apiToken: "" }));
    } catch (err: any) {
      setError(err.message || "Er is iets misgegaan");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-[#6bbc4a]" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#3d3d3d]">Instellingen</h1>
        <p className="text-gray-500">Beheer uw Kiyoh API-verbinding</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Settings Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 kiyoh-card p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 relative">
              <Image src="/kiyoh-logo.png" alt="Kiyoh" fill className="object-contain" />
            </div>
            <div>
              <h2 className="font-semibold text-[#3d3d3d]">Kiyoh API Configuratie</h2>
              <p className="text-sm text-gray-500">Verbind uw Kiyoh account</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {success && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-green-600">
                <CheckCircle size={20} />
                <span className="text-sm">{success}</span>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-600">
                <AlertCircle size={20} />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bedrijfsnaam
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="kiyoh-input"
                placeholder="Uw bedrijfsnaam"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location ID *
              </label>
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                <input
                  type="text"
                  value={formData.locationId}
                  onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                  className="kiyoh-input with-icon"
                  placeholder="bijv. 1080586"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Te vinden in uw Kiyoh dashboard onder instellingen
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Token *
              </label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                <input
                  type="password"
                  value={formData.apiToken}
                  onChange={(e) => setFormData({ ...formData, apiToken: e.target.value })}
                  className="kiyoh-input with-icon"
                  placeholder={company ? "••••••••••••••••" : "Uw API token"}
                  required={!company}
                />
              </div>
              {company && (
                <p className="text-xs text-gray-500 mt-1">
                  Laat leeg om de huidige token te behouden
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Platform
                </label>
                <div className="relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                  <select
                    value={formData.baseUrl}
                    onChange={(e) => {
                      const isKiyoh = e.target.value === "https://www.kiyoh.com";
                      setFormData({
                        ...formData,
                        baseUrl: e.target.value,
                        tenantId: isKiyoh ? "98" : "99",
                      });
                    }}
                    className="kiyoh-input with-icon appearance-none cursor-pointer"
                  >
                    <option value="https://www.kiyoh.com">Kiyoh</option>
                    <option value="https://www.klantenvertellen.nl">Klantenvertellen</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tenant ID
                </label>
                <input
                  type="text"
                  value={formData.tenantId}
                  onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                  className="kiyoh-input"
                  placeholder="98 of 99"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full btn-kiyoh justify-center disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <Save size={20} />
              )}
              {saving ? "Opslaan..." : "Instellingen opslaan"}
            </button>
          </form>
        </motion.div>

        {/* Help Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          <div className="kiyoh-card p-6">
            <h3 className="font-semibold text-[#3d3d3d] mb-4">Waar vind ik mijn API gegevens?</h3>
            <ol className="space-y-3 text-sm text-gray-600">
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#6bbc4a] text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
                <span>Log in op uw Kiyoh dashboard</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#6bbc4a] text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
                <span>Ga naar &quot;Uitnodigen&quot; → &quot;Extra opties&quot;</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#6bbc4a] text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
                <span>Kopieer uw Location ID en API Token</span>
              </li>
            </ol>
            <a
              href="https://www.kiyoh.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 btn-secondary w-full flex items-center justify-center gap-2"
            >
              <ExternalLink size={16} />
              Open Kiyoh Dashboard
            </a>
          </div>

          {company && (
            <div className="kiyoh-card p-6">
              <h3 className="font-semibold text-[#3d3d3d] mb-4">Huidige configuratie</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className="text-[#6bbc4a] font-medium flex items-center gap-1">
                    <CheckCircle size={14} />
                    Verbonden
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Location ID</span>
                  <span className="font-mono text-[#3d3d3d]">{company.locationId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Platform</span>
                  <span className="text-[#3d3d3d]">
                    {company.baseUrl.includes("kiyoh") ? "Kiyoh" : "Klantenvertellen"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
