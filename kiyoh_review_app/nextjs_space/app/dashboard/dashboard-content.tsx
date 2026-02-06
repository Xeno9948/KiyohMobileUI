"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Star, TrendingUp, Users, MessageSquare, RefreshCw, Settings, ArrowRight, CheckCircle, ThumbsUp, Eye, Sparkles, Check } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

// Header imports
// Header imports
import { useLanguage } from "@/components/language-context";
import { useTranslations } from "@/hooks/use-translations";

interface Statistics {
  averageRating?: number;
  numberReviews?: number;
  recommendation?: number;
  last12MonthAverageRating?: number;
  last12MonthNumberReviews?: number;
  viewReviewUrl?: string;
  locationName?: string;
  fiveStars?: number;
  fourStars?: number;
  threeStars?: number;
  twoStars?: number;
  oneStars?: number;
  aiEnabled?: boolean;
  gmbEnabled?: boolean;
  gmbAverageRating?: number;
  gmbTotalReviews?: number;
  fbEnabled?: boolean;
  fbAverageRating?: number;
  fbTotalReviews?: number;
}

// ... existing code ...


interface Review {
  reviewContent?: Array<{ questionGroup?: string; rating?: number }>;
  rating?: number;
  reviewAuthor?: string;
}

export default function DashboardContent() {
  const t = useTranslations("Dashboard");
  const { locale } = useLanguage();
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [strongPoints, setStrongPoints] = useState<string[]>([]);
  const [loadingStrongPoints, setLoadingStrongPoints] = useState(false);
  const [recentReview, setRecentReview] = useState<Review | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);




  // ... fetchStrongPoints ...
  const fetchStrongPoints = async () => {
    try {
      // First try to get cached strong points
      const cachedRes = await fetch(`/api/ai/analyze-reviews?language=${locale}`);
      const cachedData = await cachedRes.json();

      if (cachedData.strongPoints && cachedData.strongPoints.length > 0) {
        setStrongPoints(cachedData.strongPoints);
      } else {
        // Generate new strong points
        setLoadingStrongPoints(true);
        const res = await fetch("/api/ai/analyze-reviews", {
          method: "POST",
          body: JSON.stringify({ language: locale })
        });
        const data = await res.json();
        if (data.strongPoints) {
          setStrongPoints(data.strongPoints);
        }
      }
    } catch (error) {
      console.error("Failed to fetch strong points:", error);
    } finally {
      setLoadingStrongPoints(false);
    }
  };

  const refreshStrongPoints = async () => {
    setLoadingStrongPoints(true);
    try {
      const res = await fetch("/api/ai/analyze-reviews", {
        method: "POST",
        body: JSON.stringify({ language: locale })
      });
      const data = await res.json();
      if (data.strongPoints) {
        setStrongPoints(data.strongPoints);
      }
    } catch (error) {
      console.error("Failed to refresh strong points:", error);
    } finally {
      setLoadingStrongPoints(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/kiyoh/statistics");
        if (res.ok) {
          const data = await res.json();
          setStats(data);

          // Check for recent review
          if (data.viewReviewUrl) {
            try {
              const reviewsRes = await fetch("/api/kiyoh/reviews?limit=1");
              if (reviewsRes.ok) {
                const reviewsData = await reviewsRes.json();
                if (reviewsData.reviews && reviewsData.reviews.length > 0) {
                  setRecentReview(reviewsData.reviews[0]);
                }
              }
            } catch (err) {
              console.error("Failed to fetch recent review", err);
            }
          }
        } else {
          // Handle 404 or other errors
          if (res.status === 404) setNeedsSetup(true);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    fetchStrongPoints();
  }, [locale]);

  // ...

  {/* AI Upsell (Only if AI disabled) */ }
  {
    (!loading && stats && stats.aiEnabled === false) && (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="p-5 rounded-xl bg-gradient-to-br from-[#6bbc4a]/10 to-transparent border border-[#6bbc4a]/20"
      >
        <div className="flex gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm h-fit">
            <Sparkles className="text-[#6bbc4a]" size={20} />
          </div>
          <div>
            <h4 className="font-semibold text-[#3d3d3d]">{useTranslations("AI")('upsellTitle')}</h4>
            <p className="text-sm text-gray-600 mt-1 mb-2">
              {useTranslations("AI")('upsellText')}
            </p>
            <p className="text-xs text-[#6bbc4a] font-medium">
              {useTranslations("AI")('contactAdvisor')}
            </p>
          </div>
        </div>
      </motion.div>
    )
  }
  const formatNumber = (num?: number) => {
    if (!num) return "0";
    return num.toLocaleString("nl-NL");
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 8) return "var(--kiyoh-green)";
    if (rating >= 6) return "var(--kiyoh-yellow)";
    if (rating >= 4) return "var(--kiyoh-orange)";
    return "var(--kiyoh-red)";
  };

  const getReviewText = (review: Review, type: string) => {
    const content = review?.reviewContent?.find((c) => c?.questionGroup === type);
    return content?.rating?.toString() || "";
  };

  const calculateSentiment = () => {
    if (!stats) return 0;
    const rating = stats.averageRating || 0;
    return Math.round((rating / 10) * 100);
  };

  // Setup Required Screen
  if (!loading && needsSetup) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="kiyoh-card p-10 max-w-lg text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#f5f5f5] flex items-center justify-center">
            <Settings className="text-[#eb5b0c]" size={36} />
          </div>
          <h2 className="text-2xl font-bold text-[#3d3d3d] mb-3">{t('setupTitle')}</h2>
          <p className="text-gray-500 mb-6">
            {t('setupText')}
          </p>
          <Link
            href="/settings"
            className="btn-kiyoh inline-flex"
          >
            <Settings size={18} />
            {t('configureBtn')}
            <ArrowRight size={18} />
          </Link>
        </motion.div>
      </div>
    );
  }

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <RefreshCw className="animate-spin text-[#6bbc4a]" size={48} />
      </div>
    );
  }

  const ReviewOverviewCard = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="overview-card"
    >
      <h3 className="overview-title">{t('overview')}</h3>

      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-600">{t('positiveSentiment')}</span>
          <span className="font-semibold text-[#6bbc4a]">{calculateSentiment()}%</span>
        </div>
        <div className="sentiment-bar"></div>
      </div>

      <p className="text-gray-600 text-sm mb-4">
        {stats?.locationName || "Your business"} {t('summary')} {(stats?.averageRating || 0).toFixed(1)} {t('outOf')} {stats?.recommendation || 0}% {t('recommendationText')}
      </p>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="text-[#6bbc4a]" size={16} />
            <span className="font-medium text-[#6bbc4a]">{t('strongPoints')}</span>
          </div>
          <button
            onClick={refreshStrongPoints}
            disabled={loadingStrongPoints}
            className="text-xs text-gray-400 hover:text-[#6bbc4a] transition-colors"
            title="Opnieuw analyseren"
          >
            <RefreshCw size={12} className={loadingStrongPoints ? "animate-spin" : ""} />
          </button>
        </div>
        {loadingStrongPoints ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <RefreshCw size={14} className="animate-spin" />
            <span>{t('analyzing')}</span>
          </div>
        ) : strongPoints.length > 0 ? (
          strongPoints.map((point, index) => (
            <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
              <Check size={16} className="text-[#6bbc4a]" />
              <span>{point}</span>
            </div>
          ))
        ) : (
          <div className="text-sm text-gray-400">
            {t('clickToAnalyze')}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-4 flex items-center gap-1">
        <Sparkles size={12} />
        {t('aiAnalysis').replace('{count}', formatNumber(stats?.numberReviews))}
      </p>
    </motion.div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#3d3d3d]">
            {t('title')} {stats?.locationName || "Your Business"}
          </h1>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw size={16} />
          {t('refresh')}
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Rating Overview Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="kiyoh-card p-8"
          >
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Circular Rating with Score Badge */}
              <div className="flex flex-col items-center">
                <div className="relative w-40 h-40">
                  <Image
                    src="/score-badge.png"
                    alt="Score Badge"
                    fill
                    className="object-contain"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl font-bold text-[#3d3d3d]">
                      {(stats?.averageRating || 0).toFixed(1).replace(".", ",")}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 mt-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={24}
                      fill={star <= Math.round((stats?.averageRating || 0) / 2) ? "#ffcc01" : "#e8e8e8"}
                      color={star <= Math.round((stats?.averageRating || 0) / 2) ? "#ffcc01" : "#e8e8e8"}
                    />
                  ))}
                </div>
                <p className="text-gray-500 text-sm mt-2 text-center">
                  {formatNumber(stats?.last12MonthNumberReviews)} {t('reviewsLast12Months')}
                </p>
              </div>

              {/* Stats Grid */}
              <div className="flex-1 grid grid-cols-2 gap-4 w-full">
                <div className="stat-box">
                  <p className="stat-label">{t('totalScore')}</p>
                  <p className="stat-value">{(stats?.averageRating || 0).toFixed(1)}</p>
                </div>
                <div className="stat-box">
                  <p className="stat-label">{t('totalReviews')}</p>
                  <p className="stat-value">{formatNumber(stats?.numberReviews)}</p>
                </div>
                <div className="stat-box">
                  <p className="stat-label">{t('recommends')}</p>
                  <p className="stat-value">{stats?.recommendation || 0}%</p>
                </div>
                <div className="stat-box">
                  <p className="stat-label">{t('average12Months')}</p>
                  <p className="stat-value">{(stats?.last12MonthAverageRating || 0).toFixed(1)}</p>
                </div>
              </div>
            </div>

            {/* Google Rating Badge (Conditionally Rendered) */}
            {stats?.gmbEnabled && (stats.gmbTotalReviews || 0) > 0 && (
              <div className="flex flex-col items-start mt-4 pt-4 border-t border-gray-100 w-full pl-2">
                <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm">
                  <div className="w-8 h-8 relative flex items-center justify-center">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            )}

                      {/* Google Rating Badge (Conditionally Rendered) */}
                      {stats?.gmbEnabled && (stats.gmbTotalReviews || 0) > 0 && (
                        <div className="flex flex-col items-start mt-4 pt-4 border-t border-gray-100 w-full">
                          <div className="w-full flex items-center justify-between bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 relative flex items-center justify-center bg-white rounded-full border border-gray-100 shadow-sm">
                                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-gray-800 text-lg">
                                    {(stats.gmbAverageRating || 0).toFixed(1)}
                                  </span>
                                  <div className="flex gap-0.5">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <Star
                                        key={star}
                                        size={14}
                                        fill={star <= Math.round(stats.gmbAverageRating || 0) ? "#ffcc01" : "#e8e8e8"}
                                        color={star <= Math.round(stats.gmbAverageRating || 0) ? "#ffcc01" : "#e8e8e8"}
                                      />
                                    ))}
                                  </div>
                                </div>
                                <p className="text-xs text-gray-500">
                                  {stats.gmbTotalReviews || 0} Google reviews
                                </p>
                              </div>
                            </div>
                            <Link href="/reviews?tab=google" className="text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
                              Manage
                            </Link>
                          </div>
                        </div>
                      )}

                      {/* Facebook Rating Badge (Conditionally Rendered) */}
                      {stats?.fbEnabled && (stats.fbTotalReviews || 0) > 0 && (
                        <div className="flex flex-col items-start mt-4 pt-4 border-t border-gray-100 w-full">
                          <div className="w-full flex items-center justify-between bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 relative flex items-center justify-center bg-[#1877F2]/10 rounded-full">
                                <Facebook size={20} className="text-[#1877F2]" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-gray-800 text-lg">
                                    {(stats.fbAverageRating || 0).toFixed(1)}
                                  </span>
                                  <div className="flex gap-0.5">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <Star
                                        key={star}
                                        size={14}
                                        fill={star <= Math.round(stats.fbAverageRating || 0) ? "#ffcc01" : "#e8e8e8"}
                                        color={star <= Math.round(stats.fbAverageRating || 0) ? "#ffcc01" : "#e8e8e8"}
                                      />
                                    ))}
                                  </div>
                                </div>
                                <p className="text-xs text-gray-500">
                                  {stats.fbTotalReviews || 0} Facebook reviews
                                </p>
                              </div>
                            </div>
                            <Link href="/reviews?tab=facebook" className="text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
                              Manage
                            </Link>
                          </div>
                        </div>
                      )}

                      {/* Action Button - Moved to Right */}
                      <div className="flex justify-end mt-6">
                        <Link href="/invite" className="btn-kiyoh">
                          <MessageSquare size={18} />
                          {t('sendInvite')}
                        </Link>
                      </div>
                    </motion.div>

                    {/* Recent Review */}
                    {/* AI Summary (Mobile Only) */}
                    <div className="block lg:hidden">
                      <ReviewOverviewCard />
                    </div>

                    {recentReview && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="kiyoh-card p-6"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-[#3d3d3d]">{t('latestReview')}</h3>
                          <Link href="/reviews" className="text-[#6bbc4a] text-sm font-medium hover:underline flex items-center gap-1">
                            {t('viewAll')}
                            <ArrowRight size={14} />
                          </Link>
                        </div>

                        <div className="flex items-start gap-4">
                          <div
                            className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
                            style={{ background: getRatingColor(recentReview.rating || 0) }}
                          >
                            {recentReview.rating}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-[#3d3d3d]">{recentReview.reviewAuthor || "Anonymous"}</span>
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    size={14}
                                    fill={star <= Math.round((recentReview.rating || 0) / 2) ? "#ffcc01" : "#e8e8e8"}
                                    color={star <= Math.round((recentReview.rating || 0) / 2) ? "#ffcc01" : "#e8e8e8"}
                                  />
                                ))}
                              </div>
                            </div>
                            {getReviewText(recentReview, "DEFAULT_ONELINER") && (
                              <p className="text-[#3d3d3d] font-medium">
                                &ldquo;{getReviewText(recentReview, "DEFAULT_ONELINER")}&rdquo;
                              </p>
                            )}
                            {getReviewText(recentReview, "DEFAULT_OPINION") && (
                              <p className="text-gray-500 text-sm mt-1 line-clamp-2">
                                {getReviewText(recentReview, "DEFAULT_OPINION")}
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Sidebar */}
                  <div className="space-y-6">
                    {/* Review Overview (Desktop Only) */}
                    <div className="hidden lg:block">
                      <ReviewOverviewCard />
                    </div>

                    {/* Verified Badge */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="kiyoh-card p-5"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 relative">
                          <Image
                            src="/kiyoh-logo.png"
                            alt="Kiyoh"
                            fill
                            className="object-contain"
                          />
                        </div>
                        <div>
                          <p className="font-semibold text-[#3d3d3d]">{t('verified')}</p>
                          <p className="text-sm text-gray-500">Powered by Kiyoh</p>
                        </div>
                      </div>
                    </motion.div>

                    {/* Rating Distribution */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                      className="kiyoh-card p-5"
                    >
                      <h4 className="font-semibold text-[#3d3d3d] mb-4">{t('distribution')}</h4>
                      {[
                        { stars: 5, count: stats?.fiveStars || 0 },
                        { stars: 4, count: stats?.fourStars || 0 },
                        { stars: 3, count: stats?.threeStars || 0 },
                        { stars: 2, count: stats?.twoStars || 0 },
                        { stars: 1, count: stats?.oneStars || 0 },
                      ].map((item) => {
                        const total = (stats?.fiveStars || 0) + (stats?.fourStars || 0) + (stats?.threeStars || 0) + (stats?.twoStars || 0) + (stats?.oneStars || 0);
                        const percentage = total > 0 ? (item.count / total) * 100 : 0;
                        return (
                          <div key={item.stars} className="flex items-center gap-3 mb-2">
                            <div className="flex items-center gap-1 w-16">
                              <span className="text-sm text-gray-600">{item.stars}</span>
                              <Star size={14} fill="#ffcc01" color="#ffcc01" />
                            </div>
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${percentage}%`,
                                  background: item.stars >= 4 ? "var(--kiyoh-green)" : item.stars === 3 ? "var(--kiyoh-yellow)" : "var(--kiyoh-orange)"
                                }}
                              />
                            </div>
                            <span className="text-sm text-gray-500 w-12 text-right">{item.count}</span>
                          </div>
                        );
                      })}
                    </motion.div>

                    {/* AI Upsell (if AI not enabled/used) */}
                    {/* We assume strongPoints being empty after analysis attempt MIGHT mean AI is off, or we can check a prop if available. 
              For now, adding it as a static helper section if StrongPoints are empty OR just as a general footer for visible help.
              Better: Check if user has AI enabled. But we don't have that prop in stats directly yet. 
              Let's add it based on the user's request "when AI features are disabled". 
              I'll add a fetch for user settings in useEffect or just render it if strongPoints fails. 
              Actually, the user said "under the review oversight". 
          */}
                    {(!loading && stats && stats.aiEnabled === false) && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="p-5 rounded-xl bg-gradient-to-br from-[#6bbc4a]/10 to-transparent border border-[#6bbc4a]/20"
                      >
                        <div className="flex gap-3">
                          <div className="p-2 bg-white rounded-lg shadow-sm h-fit">
                            <Sparkles className="text-[#6bbc4a]" size={20} />
                          </div>
                          <div>
                            <h4 className="font-semibold text-[#3d3d3d]">{useTranslations("AI")('upsellTitle')}</h4>
                            <p className="text-sm text-gray-600 mt-1 mb-2">
                              {useTranslations("AI")('upsellText')}
                            </p>
                            <p className="text-xs text-[#6bbc4a] font-medium">
                              {useTranslations("AI")('contactAdvisor')}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div >
              </div >
            );
}
