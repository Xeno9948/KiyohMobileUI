"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Send, Mail, User, Clock, CheckCircle, AlertCircle, Loader2, RefreshCw, Link2, Copy, Check, QrCode, Download } from "lucide-react";
import { useTranslations } from "@/hooks/use-translations";
import QRCode from "react-qr-code";

interface Invite {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  status: string;
  createdAt: string;
}

export default function InviteContent() {
  const t = useTranslations("Invite");
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

  // QR Code ref
  const qrRef = useRef<HTMLDivElement>(null);

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

  const downloadQR = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;

    // Convert SVG to PNG
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width + 40; // Add padding
      canvas.height = img.height + 40;
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 20, 20);

        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = "kiyoh-review-qr.png";
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
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
        throw new Error(data.error || t('error') || "Failed");
      }

      setSuccess(t('success'));
      setEmail("");
      setFirstName("");
      setLastName("");
      setDelay(0);
      fetchInvites();
    } catch (err: any) {
      setError(err.message || t('error') || "Error");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("nl-NL", { // Keep locale format but maybe respect user lang eventually
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#3d3d3d]">{t('title')}</h1>
        <p className="text-gray-500">{t('subtitle')}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content (2 cols) */}
        <div className="lg:col-span-2 space-y-6">

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
                  <p className="text-sm font-medium text-[#3d3d3d]">{t('directLink')}</p>
                  <p className="text-xs text-gray-500 break-all">{reviewUrl}</p>
                </div>
                <button
                  onClick={copyToClipboard}
                  className="btn-secondary !p-2 flex-shrink-0"
                  title={t('copy')}
                >
                  {copied ? <Check size={18} className="text-[#6bbc4a]" /> : <Copy size={18} />}
                </button>
              </div>
              {copied && (
                <p className="text-xs text-[#6bbc4a] mt-2 text-center">{t('copied')}</p>
              )}
            </motion.div>
          )}

          {/* Invite Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="kiyoh-card p-6"
          >
            <h2 className="text-lg font-semibold text-[#3d3d3d] mb-4">{t('newInvite')}</h2>

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
                  {t('email')} *
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="kiyoh-input with-icon"
                    placeholder={t('emailPlaceholder')}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('firstName')}
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="kiyoh-input with-icon"
                      placeholder={t('firstNamePlaceholder')}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('lastName')}
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="kiyoh-input"
                    placeholder={t('lastNamePlaceholder')}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('delay')}
                </label>
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                  <select
                    value={delay}
                    onChange={(e) => setDelay(Number(e.target.value))}
                    className="kiyoh-input with-icon appearance-none cursor-pointer"
                  >
                    <option value={0}>{t('delayOptions.0')}</option>
                    <option value={1}>{t('delayOptions.1')}</option>
                    <option value={2}>{t('delayOptions.2')}</option>
                    <option value={3}>{t('delayOptions.3')}</option>
                    <option value={7}>{t('delayOptions.7')}</option>
                    <option value={14}>{t('delayOptions.14')}</option>
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
                {loading ? t('sending') : t('send')}
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
              <h2 className="text-lg font-semibold text-[#3d3d3d]">{t('recentInvites')}</h2>
              <button
                onClick={fetchInvites}
                className="btn-secondary !p-2"
                title={t('refresh')}
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
                <p className="text-gray-500">{t('noInvites')}</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {recentInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="p-4 bg-gray-50 rounded-xl flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[#3d3d3d] truncate">{invite.email}</p>
                      {(invite.firstName || invite.lastName) && (
                        <p className="text-sm text-gray-500 truncate">
                          {invite.firstName} {invite.lastName}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${invite.status === "sent"
                          ? "bg-green-100 text-green-600"
                          : invite.status === "pending"
                            ? "bg-yellow-100 text-yellow-600"
                            : "bg-gray-100 text-gray-600"
                          }`}
                      >
                        {invite.status === "sent" ? t('status.sent') : invite.status === "pending" ? t('status.pending') : invite.status}
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

        {/* Sidebar (QR Code) */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="kiyoh-card p-6 flex flex-col items-center text-center"
            >
              <div className="w-12 h-12 rounded-full bg-[#3d3d3d]/5 flex items-center justify-center mb-4">
                <QrCode size={24} className="text-[#3d3d3d]" />
              </div>
              <h3 className="text-lg font-bold text-[#3d3d3d] mb-2">{t('qrCode')}</h3>
              <p className="text-sm text-gray-500 mb-6">
                {t('qrText')}
              </p>

              {reviewUrl ? (
                <div ref={qrRef} className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
                  <QRCode
                    value={reviewUrl}
                    size={180}
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                    viewBox={`0 0 256 256`}
                  />
                </div>
              ) : (
                <div className="w-48 h-48 bg-gray-100 rounded-xl animate-pulse mb-6"></div>
              )}

              <button
                onClick={downloadQR}
                className="btn-kiyoh w-full justify-center"
              >
                <Download size={18} />
                {t('downloadQr')}
              </button>
            </motion.div>
          </div>
        </div>

      </div>
    </div>
  );
}
