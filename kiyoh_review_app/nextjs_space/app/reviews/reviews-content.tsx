"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, User, MapPin, Calendar, MessageSquare, RefreshCw, AlertCircle, ChevronLeft, ChevronRight, Reply, Flag, Edit3, X, Send, Loader2, CheckCircle, Sparkles } from "lucide-react";
import { useTranslations } from "@/hooks/use-translations";

interface Review {
  reviewId?: string;
  reviewAuthor?: string;
  city?: string;
  rating?: number;
  dateSince?: string;
  updatedSince?: string;
  reviewLanguage?: string;
  reviewContent?: Array<{
    questionGroup?: string;
    questionType?: string;
    rating?: string | number | boolean;
    questionTranslation?: string;
  }>;
  reviewComments?: string;
}

interface GMBReview {
  reviewId: string;
  reviewer: string;
  starRating: string; // "ONE", "TWO", etc.
  comment: string;
  createTime: string;
  reviewReply?: string;
}

interface ReviewsResponse {
  reviews?: Review[];
  numberReviews?: number;
  averageRating?: number;
}

type ModalType = "reply" | "changeRequest" | "abuse" | null;
type TabType = "kiyoh" | "google";

export default function ReviewsContent() {
  const t = useTranslations("Reviews");
  const [activeTab, setActiveTab] = useState<TabType>("kiyoh");

  // Kiyoh State
  const [reviews, setReviews] = useState<Review[]>([]);
  const [totalReviews, setTotalReviews] = useState(0);

  // GMB State
  const [gmbReviews, setGmbReviews] = useState<GMBReview[]>([]);
  const [gmbLoading, setGmbLoading] = useState(false);
  const [gmbStats, setGmbStats] = useState({ average: 0, total: 0 });

  // Shared State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [orderBy, setOrderBy] = useState("CREATE_DATE");
  const [sortOrder, setSortOrder] = useState("DESC");
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const perPage = 20;

  // Moderation state
  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedReview, setSelectedReview] = useState<Review | GMBReview | null>(null);
  const [selectedReviewType, setSelectedReviewType] = useState<TabType>("kiyoh");
  const [replyText, setReplyText] = useState("");
  const [replyType, setReplyType] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [sendEmail, setSendEmail] = useState(true);
  const [abuseReason, setAbuseReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);

  // Helper to convert GMB string rating to number
  const getGmbRating = (ratingStr: string): number => {
    const map: Record<string, number> = { "ONE": 1, "TWO": 2, "THREE": 3, "FOUR": 4, "FIVE": 5 };
    return map[ratingStr] || 0;
  };

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

  const fetchReviews = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/kiyoh/reviews?limit=${perPage * page}&orderBy=${orderBy}&sortOrder=${sortOrder}`);

      if (!res.ok) throw new Error("Failed to fetch reviews");

      const data: ReviewsResponse = await res.json();
      setReviews(data?.reviews ?? []);
      setTotalReviews(data?.numberReviews ?? 0);
    } catch (err) {
      setError("Kan reviews niet laden");
    } finally {
      setLoading(false);
    }
  };

  const fetchGMBReviews = async () => {
    setGmbLoading(true);
    try {
      const res = await fetch("/api/gmb/reviews");
      if (res.ok) {
        const data = await res.json();
        const reviews = data.reviews || [];
        setGmbReviews(reviews);

        // Calculate stats
        const total = reviews.length;
        const sum = reviews.reduce((acc: number, r: GMBReview) => acc + getGmbRating(r.starRating), 0);
        setGmbStats({
          average: total > 0 ? sum / total : 0,
          total
        });
      }
    } catch (err) {
      console.error("Failed to fetch GMB reviews", err);
    } finally {
      setGmbLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "kiyoh") {
      fetchReviews();
    } else {
      fetchGMBReviews();
    }
  }, [page, orderBy, sortOrder, activeTab]);

  const startIndex = (page - 1) * perPage;
  let filteredReviews = reviews?.slice?.(startIndex, startIndex + perPage) ?? [];

  if (ratingFilter !== null) {
    filteredReviews = filteredReviews.filter(r => Math.ceil((r.rating || 0) / 2) === ratingFilter);
  }

  const totalPages = Math.ceil(totalReviews / perPage) || 1;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Unknown";
    try {
      return new Date(dateStr).toLocaleDateString("nl-NL", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  const getReviewText = (review: Review, type: string) => {
    const content = review?.reviewContent?.find?.((c) => c?.questionGroup === type);
    return content?.rating?.toString?.() ?? "";
  };

  const getRatingColor = (rating: number, max: number = 10) => {
    const percentage = rating / max;
    if (percentage >= 0.8) return "#6bbc4a";
    if (percentage >= 0.6) return "#ffcc01";
    if (percentage >= 0.4) return "#eb5b0c";
    return "#e53935";
  };

  const openModal = (type: ModalType, review: Review | GMBReview, isGmb = false) => {
    setSelectedReview(review);
    setSelectedReviewType(isGmb ? "google" : "kiyoh");
    setModalType(type);
    setReplyText("");
    setAbuseReason("");
    setError("");
    setSuccessMessage("");
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedReview(null);
    setReplyText("");
    setAbuseReason("");
    setError("");
  };

  const generateAIResponse = async () => {
    if (!selectedReview) return;

    setGeneratingAI(true);
    setError("");

    try {
      const reviewText = modalData?.text || "Geen tekst";

      const res = await fetch("/api/ai/generate-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewAuthor: modalData?.author,
          rating: modalData?.rating,
          reviewText,
          source: selectedReviewType // Added source field
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Kon AI reactie niet genereren");
      }

      if (data.suggestedResponse) {
        setReplyText(data.suggestedResponse);
      } else {
        throw new Error("Geen AI reactie ontvangen");
      }
    } catch (err: any) {
      setError(err.message || "AI generatie mislukt");
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleReply = async () => {
    if (!selectedReview?.reviewId || !replyText.trim()) {
      setError("Vul een reactie in");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/kiyoh/moderation/response", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: selectedReview.reviewId,
          response: replyText.trim(),
          responseType: replyType,
          sendEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle specific Kiyoh permission error
        if (data.details && data.details.includes("FEATURE_NOT_REVIEW_MODERATION_API")) {
          throw new Error(t('errors.kiyohPlanRestriction') || "Your Kiyoh plan does not support replying via API. Please upgrade your Kiyoh subscription.");
        }
        throw new Error(data.error || t('errors.replyFailed'));
      }

      setSuccessMessage(t('modals.successReply'));
      setTimeout(() => { closeModal(); fetchReviews(); }, 1500);
    } catch (err: any) {
      setError(err.message || "Kon reactie niet verzenden");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeRequest = async () => {
    if (!selectedReview?.reviewId) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/kiyoh/moderation/changerequest", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: selectedReview.reviewId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kon verzoek niet versturen");

      setSuccessMessage(t('modals.successChange'));
      setTimeout(() => closeModal(), 1500);
    } catch (err: any) {
      setError(err.message || "Kon verzoek niet versturen");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAbuseReport = async () => {
    if (!selectedReview?.reviewId || !abuseReason.trim()) {
      setError("Vul een reden in");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/kiyoh/moderation/abuse", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: selectedReview.reviewId,
          abuseReason: abuseReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kon melding niet versturen");

      setSuccessMessage(t('modals.successReport'));
      setTimeout(() => closeModal(), 1500);
    } catch (err: any) {
      setError(err.message || "Kon melding niet versturen");
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to get normalized display data for the modal
  const getModalReviewData = () => {
    if (!selectedReview) return null;

    if (selectedReviewType === "google") {
      const r = selectedReview as GMBReview;
      return {
        author: r.reviewer || "Google User",
        rating: getGmbRating(r.starRating),
        text: r.comment || "",
        date: r.createTime
      };
    } else {
      const r = selectedReview as Review;
      return {
        author: r.reviewAuthor || "Anoniem",
        rating: r.rating || 0,
        text: getReviewText(r, "DEFAULT_OPINION") || getReviewText(r, "DEFAULT_ONELINER"),
        date: r.dateSince
      };
    }
  };

  const modalData = getModalReviewData();

  return (
    <div className="space-y-6">
      {/* Platform Tabs */}
      <div className="flex p-1 bg-gray-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("kiyoh")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "kiyoh"
            ? "bg-white text-[#3d3d3d] shadow-sm"
            : "text-gray-500 hover:text-gray-700"
            }`}
        >
          <div className="w-4 h-4 relative">
            <img src="/kiyoh-logo.png" alt="Kiyoh" className="object-contain" />
          </div>
          Kiyoh
        </button>
        <button
          onClick={() => setActiveTab("google")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "google"
            ? "bg-white text-[#3d3d3d] shadow-sm"
            : "text-gray-500 hover:text-gray-700"
            }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Google
        </button>
      </div>

      {activeTab === "google" && gmbStats.total > 0 && (
        <div className="kiyoh-card p-4 flex items-center justify-between bg-white border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Google Score</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-[#3d3d3d]">{gmbStats.average.toFixed(1)}</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} size={16} fill={star <= Math.round(gmbStats.average) ? "#ffcc01" : "#e8e8e8"} color={star <= Math.round(gmbStats.average) ? "#ffcc01" : "#e8e8e8"} />
                  ))}
                </div>
                <span className="text-sm text-gray-400">({gmbStats.total})</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#3d3d3d]">
            {activeTab === "kiyoh" ? t('title') : "Google Reviews"}
          </h1>
          <p className="text-gray-500">
            {activeTab === "kiyoh"
              ? `${totalReviews?.toLocaleString?.("nl-NL") ?? 0} ${t('reviewsCount')}`
              : `${gmbStats.total} reviews synced`
            }
          </p>
        </div>

        <button onClick={activeTab === "kiyoh" ? fetchReviews : fetchGMBReviews} className="btn-kiyoh">
          <RefreshCw size={18} className={gmbLoading ? "animate-spin" : ""} />
          {t('refresh')}
        </button>
      </div>

      {/* Filters */}
      <div className="kiyoh-card p-4">
        <div className="space-y-4">
          {/* Star Rating Filter - Full width on mobile */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-sm font-medium text-gray-600">{t('filters')}</span>

            {/* Star Rating Filter */}
            <div className="flex flex-wrap items-center gap-2">
              {[5, 4, 3, 2, 1].map((stars) => (
                <button
                  key={stars}
                  onClick={() => setRatingFilter(ratingFilter === stars ? null : stars)}
                  className={`filter-tag ${ratingFilter === stars ? 'active' : ''}`}
                >
                  <Star size={14} fill={ratingFilter === stars ? "white" : "#ffcc01"} color={ratingFilter === stars ? "white" : "#ffcc01"} />
                  {stars}
                </button>
              ))}
            </div>
          </div>

          {/* Sort Options - Stack vertically on mobile */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <select
              value={orderBy}
              onChange={(e) => { setOrderBy(e.target.value); setPage(1); }}
              className="kiyoh-select"
            >
              <option value="CREATE_DATE">{t('sortDate')}</option>
              <option value="UPDATE_DATE">{t('sortUpdate')}</option>
              <option value="RATING">{t('sortRating')}</option>
            </select>

            <select
              value={sortOrder}
              onChange={(e) => { setSortOrder(e.target.value); setPage(1); }}
              className="kiyoh-select"
            >
              <option value="DESC">{t('sortDesc')}</option>
              <option value="ASC">{t('sortAsc')}</option>
            </select>
          </div>
        </div>
      </div>

      {error && !modalType && (
        <div className="kiyoh-card p-4 border-l-4 border-[#eb5b0c] flex items-center gap-3">
          <AlertCircle className="text-[#eb5b0c]" size={20} />
          <p className="text-gray-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCw className="animate-spin text-[#6bbc4a]" size={48} />
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {activeTab === "kiyoh" ? (
              filteredReviews?.length === 0 ? (
                <div className="kiyoh-card p-8 text-center">
                  <p className="text-gray-500">{t('noReviews')}</p>
                </div>
              ) : (
                filteredReviews?.map?.((review, index) => (
                  <motion.div
                    key={review?.reviewId ?? index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="review-card"
                  >
                    <div className="flex items-start gap-4">
                      {/* Rating Badge */}
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
                        style={{ background: getRatingColor(review?.rating || 0) }}
                      >
                        {review?.rating || 0}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
                          <span className="font-semibold text-[#3d3d3d] mr-1">{review?.reviewAuthor || "Anoniem"}</span>
                          <div className="flex gap-0.5 mt-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                size={16}
                                fill={star <= Math.round((review?.rating || 0) / 2) ? "#ffcc01" : "#e8e8e8"}
                                color={star <= Math.round((review?.rating || 0) / 2) ? "#ffcc01" : "#e8e8e8"}
                              />
                            ))}
                          </div>
                          {review?.city && (
                            <span className="flex items-center gap-1 text-sm text-gray-500">
                              <MapPin size={14} />
                              {review.city}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-sm text-gray-500">
                            <Calendar size={14} />
                            {formatDate(review?.dateSince)}
                          </span>
                        </div>

                        {/* Content */}
                        {getReviewText(review, "DEFAULT_ONELINER") && (
                          <p className="text-[#3d3d3d] font-medium mb-1">
                            &ldquo;{getReviewText(review, "DEFAULT_ONELINER")}&rdquo;
                          </p>
                        )}

                        {getReviewText(review, "DEFAULT_OPINION") && (
                          <p className="text-gray-600 text-sm">
                            {getReviewText(review, "DEFAULT_OPINION")}
                          </p>
                        )}

                        {/* Business Response */}
                        {review?.reviewComments && (
                          <div className="response-badge mt-4">
                            <div className="flex items-center gap-2 mb-1">
                              <MessageSquare className="text-[#6bbc4a]" size={14} />
                              <span className="text-[#6bbc4a] font-medium text-sm">{t('responseBadge')}</span>
                            </div>
                            <p className="text-gray-600 text-sm">{review.reviewComments}</p>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                          <button
                            onClick={() => openModal("reply", review)}
                            className="filter-tag hover:border-[#6bbc4a] hover:text-[#6bbc4a]"
                          >
                            <Reply size={14} />
                            {t('reply')}
                          </button>
                          <button
                            onClick={() => openModal("changeRequest", review)}
                            className="filter-tag hover:border-[#ffcc01] hover:text-[#eb5b0c]"
                          >
                            <Edit3 size={14} />
                            {t('changeRequest')}
                          </button>
                          <button
                            onClick={() => openModal("abuse", review)}
                            className="filter-tag hover:border-[#eb5b0c] hover:text-[#eb5b0c]"
                          >
                            <Flag size={14} />
                            {t('report')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )
            ) : (
              // GMB Reviews List
              gmbReviews.length === 0 ? (
                <div className="kiyoh-card p-8 text-center bg-gray-50 border-dashed border-2 border-gray-200">
                  <div className="mx-auto w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                  </div>
                  <p className="text-[#3d3d3d] font-medium">No Google reviews found yet.</p>
                  <p className="text-gray-500 text-sm mt-1">Connect your account in Settings.</p>
                </div>
              ) : (
                gmbReviews.map((review, index) => {
                  const rating = getGmbRating(review.starRating);
                  return (
                    <motion.div
                      key={review.reviewId}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="review-card"
                    >
                      <div className="flex items-start gap-4">
                        {/* GMB Rating badge (1-5 scale) */}
                        <div
                          className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
                          style={{ background: getRatingColor(rating, 5) }}
                        >
                          {rating}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
                            <span className="font-semibold text-[#3d3d3d] mr-1">{review.reviewer || "Google User"}</span>
                            {/* Google Logo Badge */}
                            <span className="bg-white border border-gray-200 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                              </svg>
                            </span>
                            <div className="flex gap-0.5 mt-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star key={star} size={16} fill={star <= rating ? "#ffcc01" : "#e8e8e8"} color={star <= rating ? "#ffcc01" : "#e8e8e8"} />
                              ))}
                            </div>
                            <span className="flex items-center gap-1 text-sm text-gray-500">
                              <Calendar size={14} />
                              {formatDate(review.createTime)}
                            </span>
                          </div>

                          {review.comment && (
                            <p className="text-gray-600 text-sm">
                              {review.comment}
                            </p>
                          )}

                          {/* GMB Review Reply */}
                          {review.reviewReply && (
                            <div className="response-badge mt-4">
                              <div className="flex items-center gap-2 mb-1">
                                <MessageSquare className="text-[#6bbc4a]" size={14} />
                                <span className="text-[#6bbc4a] font-medium text-sm">Response</span>
                              </div>
                              <p className="text-gray-600 text-sm">{review.reviewReply}</p>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                            <button
                              onClick={() => openModal("reply", review, true)}
                              className="filter-tag hover:border-[#6bbc4a] hover:text-[#6bbc4a]"
                            >
                              <Reply size={14} />
                              Reply
                            </button>
                          </div>

                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary !p-3 disabled:opacity-50"
              >
                <ChevronLeft size={18} />
              </button>

              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                let pageNum: number;
                if (totalPages <= 5) pageNum = i + 1;
                else if (page <= 3) pageNum = i + 1;
                else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = page - 2 + i;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-10 h-10 rounded-lg font-medium transition-all ${page === pageNum
                      ? "bg-[#6bbc4a] text-white"
                      : "btn-secondary"
                      }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary !p-3 disabled:opacity-50"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}

          <p className="text-center text-gray-400 text-sm">
            {t('pagination').replace('{start}', (startIndex + 1).toString())
              .replace('{end}', Math.min(startIndex + perPage, totalReviews).toString())
              .replace('{total}', totalReviews.toString())}
          </p>
        </>
      )}


      {/* Moderation Modals */}
      <AnimatePresence>
        {modalType && selectedReview && modalData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h3 className="text-xl font-bold text-[#3d3d3d]">
                  {modalType === "reply" && t('modals.replyTitle')}
                  {modalType === "changeRequest" && t('modals.changeTitle')}
                  {modalType === "abuse" && t('modals.reportTitle')}
                </h3>
                <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-full transition-all">
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              {/* Review Preview */}
              <div className="p-5 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                    style={{ background: getRatingColor(modalData.rating, selectedReviewType === "google" ? 5 : 10) }}
                  >
                    {modalData.rating}
                  </div>
                  <div>
                    <p className="font-medium text-[#3d3d3d]">{modalData.author}</p>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} size={12} fill={star <= (selectedReviewType === "google" ? modalData.rating : Math.round(modalData.rating / 2)) ? "#ffcc01" : "#e8e8e8"} color={star <= (selectedReviewType === "google" ? modalData.rating : Math.round(modalData.rating / 2)) ? "#ffcc01" : "#e8e8e8"} />
                      ))}
                    </div>
                  </div>
                </div>
                {modalData.text && (
                  <p className="text-gray-600 text-sm mt-2 italic">&ldquo;{modalData.text}&rdquo;</p>
                )}
              </div>

              {/* Modal Content */}
              <div className="p-5 space-y-4">
                {successMessage ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle className="text-[#6bbc4a] mb-3" size={48} />
                    <p className="text-lg font-medium text-[#3d3d3d]">{successMessage}</p>
                  </div>
                ) : (
                  <>
                    {error && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600 text-sm">
                        <AlertCircle size={16} />
                        {error}
                      </div>
                    )}

                    {modalType === "reply" && (
                      <>
                        {/* AI Generate Button or Upsell */}
                        {aiEnabled ? (
                          <button
                            onClick={generateAIResponse}
                            disabled={generatingAI}
                            className="w-full py-3 px-4 bg-gradient-to-r from-[#6bbc4a] to-[#8fd96e] text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-70 mb-4"
                          >
                            {generatingAI ? (
                              <>
                                <Loader2 className="animate-spin" size={18} />
                                {t('modals.aiGenerating')}
                              </>
                            ) : (
                              <>
                                <Sparkles size={18} />
                                {t('modals.aiGenerate')}
                              </>
                            )}
                          </button>
                        ) : (
                          // AI Upsell Message in Modal
                          <div className="mb-4 p-3 bg-gradient-to-r from-[#6bbc4a]/10 to-transparent border border-[#6bbc4a]/20 rounded-xl flex items-start gap-3">
                            <Sparkles className="text-[#6bbc4a] flex-shrink-0 mt-0.5" size={16} />
                            <div>
                              <p className="text-sm text-[#3d3d3d] font-medium">
                                {useTranslations("AI")('modalUpsell')}
                              </p>
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">{t('modals.yourReply')}</label>
                          <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder={aiEnabled ? t('modals.placeholderAI') : t('modals.placeholderPublic')}
                            rows={4}
                            className="kiyoh-input resize-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">{t('modals.type')}</label>
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => setReplyType("PUBLIC")}
                              className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all ${replyType === "PUBLIC" ? "bg-[#6bbc4a] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                            >
                              {t('modals.public')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setReplyType("PRIVATE")}
                              className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all ${replyType === "PRIVATE" ? "bg-[#6bbc4a] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                            >
                              {t('modals.private')}
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {replyType === "PUBLIC" ? t('modals.publicDesc') : t('modals.privateDesc')}
                          </p>
                        </div>

                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sendEmail}
                            onChange={(e) => setSendEmail(e.target.checked)}
                            className="w-4 h-4 text-[#6bbc4a] border-gray-300 rounded focus:ring-[#6bbc4a]"
                          />
                          <span className="text-sm text-gray-700">{t('modals.emailNotify')}</span>
                        </label>

                        <button
                          onClick={handleReply}
                          disabled={submitting || !replyText.trim()}
                          className="w-full btn-kiyoh justify-center disabled:opacity-50"
                        >
                          {submitting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                          {submitting ? t('modals.sending') : t('modals.send')}
                        </button>
                      </>
                    )}

                    {modalType === "changeRequest" && (
                      <>
                        <div className="p-4 bg-[#ffcc01]/10 rounded-xl">
                          <p className="text-gray-700 text-sm">
                            <strong>{modalData.author}</strong> {t('modals.changeText')}
                          </p>
                        </div>

                        <button
                          onClick={handleChangeRequest}
                          disabled={submitting}
                          className="w-full py-3 px-4 bg-[#ffcc01] hover:bg-[#e6b800] text-[#3d3d3d] font-semibold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                        >
                          {submitting ? <Loader2 className="animate-spin" size={18} /> : <Edit3 size={18} />}
                          {submitting ? t('modals.sending') : t('modals.changeTitle')}
                        </button>
                      </>
                    )}

                    {modalType === "abuse" && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">{t('modals.reportReason')}</label>
                          <textarea
                            value={abuseReason}
                            onChange={(e) => setAbuseReason(e.target.value)}
                            placeholder={t('modals.reportPlaceholder')}
                            rows={4}
                            className="kiyoh-input resize-none"
                          />
                        </div>

                        <div className="p-4 bg-[#eb5b0c]/10 rounded-xl">
                          <p className="text-gray-700 text-sm">
                            {t('modals.reportNote')}
                          </p>
                        </div>

                        <button
                          onClick={handleAbuseReport}
                          disabled={submitting || !abuseReason.trim()}
                          className="w-full py-3 px-4 bg-[#eb5b0c] hover:bg-[#d44f08] text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                        >
                          {submitting ? <Loader2 className="animate-spin" size={18} /> : <Flag size={18} />}
                          {submitting ? t('modals.sending') : t('modals.sendReport')}
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div >
  );
}
