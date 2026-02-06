import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { getGoogleOAuthCredentials } from "@/lib/google-oauth";

export const dynamic = "force-dynamic";

/**
 * Helper function to refresh access token if expired
 */
async function refreshAccessToken(company: any) {
    if (!company.gmbRefreshToken) {
        throw new Error("No refresh token available");
    }

    const { clientId, clientSecret } = await getGoogleOAuthCredentials();

    if (!clientId || !clientSecret) {
        throw new Error("OAuth not configured");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: company.gmbRefreshToken,
            grant_type: "refresh_token",
        }),
    });

    if (!tokenResponse.ok) {
        throw new Error("Failed to refresh token");
    }

    const tokens = await tokenResponse.json();
    const { access_token, expires_in } = tokens;
    const tokenExpiry = new Date(Date.now() + expires_in * 1000);

    // Update company with new token
    await prisma.company.update({
        where: { id: company.id },
        data: {
            gmbAccessToken: access_token,
            gmbTokenExpiry: tokenExpiry,
        },
    });

    return access_token;
}

/**
 * Get valid access token (refresh if needed)
 */
async function getValidAccessToken(company: any): Promise<string> {
    // Check if token is expired or about to expire (within 5 minutes)
    const now = new Date();
    const expiryBuffer = new Date(now.getTime() + 5 * 60 * 1000);

    if (!company.gmbTokenExpiry || company.gmbTokenExpiry < expiryBuffer) {
        // Token expired or about to expire, refresh it
        return await refreshAccessToken(company);
    }

    return company.gmbAccessToken;
}

/**
 * Fetches GMB reviews and syncs to database
 */
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = (session.user as any)?.id;
        if (!userId) {
            return NextResponse.json({ error: "User not found" }, { status: 401 });
        }

        // Get user's company with GMB settings
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { company: true }
        });

        if (!user?.company) {
            return NextResponse.json({
                error: "No company configured"
            }, { status: 400 });
        }

        const company = user.company;

        // Check if GMB is enabled
        if (!company.gmbEnabled) {
            return NextResponse.json({
                error: "GMB not enabled",
                needsSetup: true
            }, { status: 400 });
        }

        // Check if we have account and location IDs
        if (!company.gmbAccountId || !company.gmbLocationId) {
            return NextResponse.json({
                error: "GMB account or location not configured"
            }, { status: 400 });
        }

        // Get valid access token
        const accessToken = await getValidAccessToken(company);

        // Fetch reviews from GMB API
        // Ensure account/location IDs are properly formatted
        const accountId = company.gmbAccountId.startsWith('accounts/') ? company.gmbAccountId : `accounts/${company.gmbAccountId}`;
        const locationId = company.gmbLocationId.startsWith('locations/') ? company.gmbLocationId : `locations/${company.gmbLocationId}`;

        const reviewsUrl = `https://mybusiness.googleapis.com/v4/${accountId}/${locationId}/reviews`;

        console.log(`[GMB] Fetching reviews from: ${reviewsUrl}`);
        console.log(`[GMB] Account ID stored: ${company.gmbAccountId}`);
        console.log(`[GMB] Location ID stored: ${company.gmbLocationId}`);

        const reviewsResponse = await fetch(reviewsUrl, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json"
            },
            cache: "no-store"
        });

        if (!reviewsResponse.ok) {
            const errorText = await reviewsResponse.text();
            console.error("[GMB] API error:", errorText);

            // If the error is 404, it might be due to invalid account/location combination
            // or the API version/endpoint might have changed.
            // Try fetching accounts to see what's available if this fails (future optimization)

            return NextResponse.json({
                error: "Failed to fetch GMB reviews",
                details: errorText
            }, { status: reviewsResponse.status });
        }

        const data = await reviewsResponse.json();
        console.log(`[GMB] Reviews fetched: ${data.reviews ? data.reviews.length : 0}`);
        const reviews = data.reviews || [];

        // Sync reviews to database
        for (const review of reviews) {
            const reviewId = review.name?.split('/').pop() || review.reviewId;

            await prisma.gMBReview.upsert({
                where: { reviewId },
                update: {
                    reviewer: review.reviewer?.displayName,
                    starRating: review.starRating,
                    comment: review.comment,
                    updateTime: review.updateTime ? new Date(review.updateTime) : null,
                    reviewReply: review.reviewReply?.comment,
                    replyUpdateTime: review.reviewReply?.updateTime ? new Date(review.reviewReply.updateTime) : null,
                    lastSyncedAt: new Date(),
                },
                create: {
                    reviewId,
                    companyId: company.id,
                    reviewer: review.reviewer?.displayName,
                    starRating: review.starRating,
                    comment: review.comment,
                    createTime: review.createTime ? new Date(review.createTime) : null,
                    updateTime: review.updateTime ? new Date(review.updateTime) : null,
                    reviewReply: review.reviewReply?.comment,
                    replyUpdateTime: review.reviewReply?.updateTime ? new Date(review.reviewReply.updateTime) : null,
                },
            });
        }

        // Fetch from database to return
        const dbReviews = await prisma.gMBReview.findMany({
            where: { companyId: company.id },
            orderBy: { createTime: 'desc' },
        });

        return NextResponse.json({
            reviews: dbReviews,
            totalReviews: dbReviews.length,
            source: 'gmb'
        });
    } catch (error: any) {
        console.error("GMB reviews fetch error:", error);
        return NextResponse.json({
            error: "Failed to fetch reviews",
            details: error?.message
        }, { status: 500 });
    }
}
