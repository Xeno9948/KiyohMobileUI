
import { useRouter } from "next/navigation";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, X, RefreshCw, Star, MessageSquare, Clock, Sparkles, Send, AlertCircle, CheckCircle } from "lucide-react";
import { useTranslations } from "@/hooks/use-translations";

interface Notification {
  id: string;
  reviewId: string;
  reviewAuthor: string;
  reviewRating: number;
  reviewText: string;
  reviewDate: string;
  suggestedResponse: string;
  status: "pending" | "approved" | "dismissed";
  isRead: boolean;
  createdAt: string;
}

export default function NotificationCenter() {
  const router = useRouter();
  const t = useTranslations("Notifications");
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [editedResponse, setEditedResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionResult, setActionResult] = useState<{ type: "success" | "error", message: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [aiEnabled, setAiEnabled] = useState(true);

  // Fetch AI status
  useEffect(() => {
    const checkAiStatus = async () => {
      try {
        const res = await fetch("/api/company");
        const data = await res.json();
        if (data.company?.aiEnabled !== undefined) {
          setAiEnabled(data.company.aiEnabled);
        }
      } catch (err) {
        console.error("Failed to fetch AI status:", err);
      }
    };
    checkAiStatus();
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      if (!data.needsSetup) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
        setPendingCount(data.pendingCount || 0);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const syncReviews = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/notifications", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        await fetchNotifications();
      }
    } catch (error) {
      console.error("Failed to sync reviews:", error);
    } finally {
      setSyncing(false);
    }
  };

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all read:", error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    setSelectedNotification(notification);
    setEditedResponse(notification.suggestedResponse || "");
    setActionResult(null);

    // Mark as read
    if (!notification.isRead) {
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: notification.id, isRead: true }),
      });
      setNotifications(notifications.map(n =>
        n.id === notification.id ? { ...n, isRead: true } : n
      ));
      setUnreadCount(Math.max(0, unreadCount - 1));
    }
  };

  const approveResponse = async () => {
    if (!selectedNotification || !editedResponse.trim()) return;

    setSubmitting(true);
    setActionResult(null);

    try {
      // Submit the response to Kiyoh
      const res = await fetch("/api/kiyoh/moderation/response", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: selectedNotification.reviewId,
          response: editedResponse,
          responseType: "public",
          sendEmail: true,
        }),
      });

      if (res.ok) {
        // Update notification status
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: selectedNotification.id, status: "approved" }),
        });

        setNotifications(notifications.map(n =>
          n.id === selectedNotification.id ? { ...n, status: "approved" as const } : n
        ));
        setPendingCount(Math.max(0, pendingCount - 1));
        setActionResult({ type: "success", message: "Reactie succesvol geplaatst!" });

        setTimeout(() => {
          setSelectedNotification(null);
        }, 1500);
      } else {
        const error = await res.json();
        setActionResult({ type: "error", message: error.error || "Kon reactie niet plaatsen" });
      }
    } catch (error) {
      setActionResult({ type: "error", message: "Er ging iets mis" });
    } finally {
      setSubmitting(false);
    }
  };

  const dismissNotification = async () => {
    if (!selectedNotification) return;

    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: selectedNotification.id, status: "dismissed" }),
      });

      setNotifications(notifications.map(n =>
        n.id === selectedNotification.id ? { ...n, status: "dismissed" as const } : n
      ));
      setPendingCount(Math.max(0, pendingCount - 1));
      setSelectedNotification(null);
    } catch (error) {
      console.error("Failed to dismiss:", error);
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 8) return "bg-[#6bbc4a]";
    if (rating >= 6) return "bg-[#ffcc01]";
    if (rating >= 4) return "bg-[#eb5b0c]";
    return "bg-[#e53935]";
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return "Zojuist";
    if (diffHours < 24) return `${diffHours}u geleden`;
    if (diffHours < 48) return "Gisteren";
    return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
  };

  const pendingNotifications = notifications.filter(n => n.status === "pending");
  const otherNotifications = notifications.filter(n => n.status !== "pending");

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <Bell size={22} className="text-gray-600" />
        {(unreadCount > 0 || pendingCount > 0) && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#eb5b0c] text-white text-xs font-bold rounded-full flex items-center justify-center">
            {pendingCount || unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed left-2 right-2 top-20 sm:absolute sm:top-full sm:right-0 sm:left-auto sm:w-96 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-[60] origin-top-right"
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="text-[#eb5b0c]" size={18} />
                <h3 className="font-semibold text-[#3d3d3d]">{t('title')}</h3>
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 bg-[#eb5b0c] text-white text-xs rounded-full">
                    {pendingCount} {t('toReview')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={syncReviews}
                  disabled={syncing}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  title={t('sync')}
                >
                  <RefreshCw size={16} className={`text-gray-500 ${syncing ? "animate-spin" : ""}`} />
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-[#6bbc4a] hover:underline"
                  >
                    {t('markAllRead')}
                  </button>
                )}
                <button
                  onClick={async () => {
                    try {
                      await fetch("/api/notifications", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ archiveAll: true }),
                      });
                      // Keep only pending notifications locally
                      setNotifications(notifications.filter(n => n.status === "pending"));
                    } catch (err) {
                      console.error("Failed to clear notifications", err);
                    }
                  }}
                  className="text-xs text-gray-400 hover:text-red-500 hover:underline ml-2"
                  title="Verwijder afgehandelde meldingen"
                >
                  {t('clearList')}
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <RefreshCw className="animate-spin mx-auto text-gray-400" size={24} />
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="mx-auto mb-2 text-gray-300" size={32} />
                  <p>{t('noNotifications')}</p>
                  <button
                    onClick={syncReviews}
                    className="mt-2 text-sm text-[#6bbc4a] hover:underline"
                  >
                    {t('sync')}
                  </button>
                </div>
              ) : (
                <>
                  {/* Pending Reviews Section */}
                  {pendingNotifications.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-orange-50 text-xs font-medium text-[#eb5b0c] flex items-center gap-1">
                        <Clock size={12} />
                        {t('pending')} ({pendingNotifications.length})
                      </div>
                      {pendingNotifications.map((notification) => (
                        <button
                          key={notification.id}
                          onClick={() => {
                            // Mark as read and navigate
                            if (!notification.isRead) {
                              fetch("/api/notifications", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ notificationId: notification.id, isRead: true }),
                              });
                            }
                            router.push('/reviews');
                          }}
                          className={`w-full p-4 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 ${!notification.isRead ? "bg-blue-50/30" : ""}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-full ${getRatingColor(notification.reviewRating)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                              {notification.reviewRating}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-sm text-[#3d3d3d] truncate">
                                  {notification.reviewAuthor || t('anonymous')}
                                </p>
                                <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                                  {new Date(notification.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                {notification.reviewText || t('noText')}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Processed Reviews Section */}
                  {otherNotifications.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500">
                        {t('processed')}
                      </div>
                      {otherNotifications.slice(0, 10).map((notification) => (
                        <button
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className="w-full p-4 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 opacity-70"
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-full ${getRatingColor(notification.reviewRating)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                              {notification.reviewRating}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-sm text-[#3d3d3d] truncate">
                                  {notification.reviewAuthor || t('anonymous')}
                                </p>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${notification.status === "approved" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                  {notification.status === "approved" ? t('answered') : t('skipped')}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1 truncate">
                                {notification.reviewText || t('noText')}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Review Response Modal */}
      <AnimatePresence>
        {selectedNotification && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
            onClick={() => setSelectedNotification(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] sm:max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full ${getRatingColor(selectedNotification.reviewRating)} flex items-center justify-center text-white font-bold text-lg`}>
                      {selectedNotification.reviewRating}
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#3d3d3d]">
                        {selectedNotification.reviewAuthor || t('anonymous')}
                      </h3>
                      <p className="text-xs text-gray-400">
                        {formatDate(selectedNotification.reviewDate)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedNotification(null)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X size={20} className="text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Review Content */}
              <div className="p-6">
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare size={14} className="text-gray-400" />
                    <span className="text-xs text-gray-500 font-medium">Review</span>
                  </div>
                  <p className="text-sm text-[#3d3d3d]">
                    {selectedNotification.reviewText || t('noText')}
                  </p>
                </div>

                {/* AI Suggested Response or Upsell */}
                <div>
                  {aiEnabled ? (
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={16} className="text-[#6bbc4a]" />
                      <span className="text-sm font-medium text-[#3d3d3d]">{t('aiResponse')}</span>
                    </div>
                  ) : (
                    <div className="mb-3 p-3 bg-gradient-to-r from-[#6bbc4a]/10 to-transparent border border-[#6bbc4a]/20 rounded-xl flex items-start gap-3">
                      <Sparkles className="text-[#6bbc4a] flex-shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="text-sm text-[#3d3d3d] font-medium">
                          Contact your account specialist to enable AI-generated responses.
                        </p>
                      </div>
                    </div>
                  )}

                  <textarea
                    value={editedResponse}
                    onChange={(e) => setEditedResponse(e.target.value)}
                    rows={4}
                    className="w-full p-4 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#6bbc4a] focus:border-transparent"
                    placeholder="Schrijf je reactie..."
                    disabled={selectedNotification.status !== "pending"}
                  />
                </div>

                {/* Action Result */}
                {actionResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${actionResult.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
                  >
                    {actionResult.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    <span className="text-sm">{actionResult.message}</span>
                  </motion.div>
                )}
              </div>

              {/* Modal Footer */}
              {selectedNotification.status === "pending" && (
                <div className="p-6 border-t border-gray-100 flex items-center justify-between">
                  <button
                    onClick={dismissNotification}
                    className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                  >
                    {t('skip')}
                  </button>
                  <button
                    onClick={approveResponse}
                    disabled={submitting || !editedResponse.trim()}
                    className="px-6 py-2 bg-[#6bbc4a] text-white rounded-lg hover:bg-[#5aa63d] transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50"
                  >
                    {submitting ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                    {t('sendResponse')}
                  </button>
                </div>
              )}

              {selectedNotification.status !== "pending" && (
                <div className="p-6 border-t border-gray-100">
                  <div className={`text-center text-sm ${selectedNotification.status === "approved" ? "text-green-600" : "text-gray-500"}`}>
                    {selectedNotification.status === "approved" ? (
                      <span className="flex items-center justify-center gap-2">
                        <CheckCircle size={16} />
                        {t('successResponse')}
                      </span>
                    ) : (
                      <span>{t('skipped')}</span>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
