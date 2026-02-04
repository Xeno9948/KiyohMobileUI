"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Mail, User, Clock, CheckCircle, AlertCircle, Loader2, RefreshCw, Link2, Copy, Check } from "lucide-react";

interface Invite {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  status: string;
  createdAt: string;
}

export default function InviteContent() {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [delay, setDelay] = useState(0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [recentInvites, setRecentInvites] = useState<Invite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [reviewUrl, setReviewUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchInvites = async () => {
    try {
      const res = await fetch("/api/kiyoh/invites");
      if (res.ok) {
        const data = await res.json();
        setRecentInvites(data.invites || []);
      }
    } catch (err) {
      console.error("Failed to fetch invites:", err);
    } finally {
      setLoadingInvites(false);
    }
  };

  const fetchReviewUrl = async () => {
    try {
      const res = await fetch("/api/kiyoh/statistics");
      if (res.ok) {
        const data = await res.json();
        setReviewUrl(data.createReviewUrl || "");
      }
    } catch (err) {
      console.error("Failed to fetch review URL:", err);
    }
  };

  const copyToClipboard = async () => {
    if (reviewUrl) {
      await navigator.clipboard.writeText(reviewUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    fetchInvites();
    fetchReviewUrl();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/kiyoh/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          delay,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Kon uitnodiging niet versturen");
      }

      setSuccess("Uitnodiging succesvol verzonden!");
      setEmail("");
      setFirstName("");
      setLastName("");
      setDelay(0);
      fetchInvites();
    } catch (err: any) {
      setError(err.message || "Er is iets misgegaan");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#3d3d3d]">Review Uitnodigingen</h1>
        <p className="text-gray-500">Stuur uitnodigingen naar klanten om een review achter te laten</p>
      </div>

      {/* Direct Review URL */}
      {reviewUrl && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="kiyoh-card p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#6bbc4a]/10 flex items-center justify-center flex-shrink-0">
              <Link2 className="text-[#6bbc4a]" size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#3d3d3d]">Directe review link</p>
              <p className="text-xs text-gray-500 truncate">{reviewUrl}</p>
            </div>
            <button
              onClick={copyToClipboard}
              className="btn-secondary !p-2 flex-shrink-0"
              title="Kopieer link"
            >
              {copied ? <Check size={18} className="text-[#6bbc4a]" /> : <Copy size={18} />}
            </button>
          </div>
          {copied && (
            <p className="text-xs text-[#6bbc4a] mt-2 text-center">Link gekopieerd!</p>
          )}
        </motion.div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Invite Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="kiyoh-card p-6"
        >
          <h2 className="text-lg font-semibold text-[#3d3d3d] mb-4">Nieuwe uitnodiging</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                E-mailadres *
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="kiyoh-input with-icon"
                  placeholder="klant@voorbeeld.nl"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Voornaam
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="kiyoh-input with-icon"
                    placeholder="Jan"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Achternaam
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="kiyoh-input"
                  placeholder="Jansen"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vertraging (dagen)
              </label>
              <div className="relative">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                <select
                  value={delay}
                  onChange={(e) => setDelay(Number(e.target.value))}
                  className="kiyoh-input with-icon appearance-none cursor-pointer"
                >
                  <option value={0}>Direct versturen</option>
                  <option value={1}>1 dag</option>
                  <option value={2}>2 dagen</option>
                  <option value={3}>3 dagen</option>
                  <option value={7}>1 week</option>
                  <option value={14}>2 weken</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-kiyoh justify-center disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <Send size={20} />
              )}
              {loading ? "Verzenden..." : "Uitnodiging versturen"}
            </button>
          </form>
        </motion.div>

        {/* Recent Invites */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="kiyoh-card p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#3d3d3d]">Recente uitnodigingen</h2>
            <button
              onClick={fetchInvites}
              className="btn-secondary !p-2"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {loadingInvites ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="animate-spin text-[#6bbc4a]" size={32} />
            </div>
          ) : recentInvites.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="mx-auto text-gray-300 mb-3" size={48} />
              <p className="text-gray-500">Nog geen uitnodigingen verstuurd</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {recentInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="p-4 bg-gray-50 rounded-xl flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-[#3d3d3d]">{invite.email}</p>
                    {(invite.firstName || invite.lastName) && (
                      <p className="text-sm text-gray-500">
                        {invite.firstName} {invite.lastName}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        invite.status === "sent"
                          ? "bg-green-100 text-green-600"
                          : invite.status === "pending"
                          ? "bg-yellow-100 text-yellow-600"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {invite.status === "sent" ? "Verstuurd" : invite.status === "pending" ? "Gepland" : invite.status}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDate(invite.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
