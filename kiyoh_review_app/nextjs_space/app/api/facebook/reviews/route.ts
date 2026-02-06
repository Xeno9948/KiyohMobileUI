import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Helper to sync FB reviews to local DB
    const syncReviews = async (companyId: string, pageId: string, accessToken: string) => {
        try {
            // Graph API v19.0 Ratings Endpoint
            // Fields: rating, review_text, reviewer, created_time, recommendation_type, has_rating, has_review
            const fields = "rating,review_text,reviewer,created_time,recommendation_type,has_rating,has_review,open_graph_story";
            const url = `https://graph.facebook.com/v19.0/${pageId}/ratings?fields=${fields}&access_token=${accessToken}&limit=100`;

            const res = await fetch(url);
            const data = await res.json();

            if (data.error) {
                throw new Error(data.error.message);
            }

            const reviews = data.data || [];

            for (const review of reviews) {
                // Only sync if it's a real review (skip empty ratings if desired, but FB often separates them)
                // FB "Recommendations" might not have a star "rating" field always (it might be just recommendation_type='positive')
                // We'll map 'positive' to 5 and 'negative' to 1 if rating is missing, or just skip.
                // Usually, new system has recommendation_type.

                let starRating = review.rating ?? 0;
                if (!starRating && review.recommendation_type === 'positive') starRating = 5;
                if (!starRating && review.recommendation_type === 'negative') starRating = 1;

                if (!starRating) continue; // Skip if we can't determine a rating

                const reviewId = review.open_graph_story?.id || review.created_time + "_" + review.reviewer?.id; // Fallback ID

                await prisma.facebookReview.upsert({
                    where: { reviewId: reviewId },
                    update: {
                        reviewerName: review.reviewer?.name,
                        reviewerId: review.reviewer?.id,
                        rating: starRating,
                        reviewText: review.review_text,
                        recommendationType: review.recommendation_type,
                        createdTime: new Date(review.created_time),
                        lastSyncedAt: new Date()
                    },
                    create: {
                        reviewId: reviewId,
                        companyId: companyId,
                        reviewerName: review.reviewer?.name,
                        reviewerId: review.reviewer?.id,
                        rating: starRating,
                        reviewText: review.review_text,
                        recommendationType: review.recommendation_type,
                        createdTime: new Date(review.created_time),
                    }
                });
            }

            return reviews.length;
        } catch (e) {
            console.error("FB Sync Error:", e);
            return 0;
        }
    };

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { company: true }
        });

        if (!user?.companyId || !user.company?.fbEnabled) {
            return NextResponse.json({ error: "Facebook integration not enabled" }, { status: 400 });
        }

        const company = user.company;

        if (!company.fbPageAccessToken || !company.fbPageId) {
            return NextResponse.json({ error: "Facebook configuration incomplete" }, { status: 400 });
        }

        // Trigger Sync (background or await)
        // We await it here for simplicity to return fresh data
        await syncReviews(company.id, company.fbPageId, company.fbPageAccessToken);

        // Fetch from DB
        const reviews = await prisma.facebookReview.findMany({
            where: { companyId: company.id },
            orderBy: { createdTime: 'desc' }
        });

        return NextResponse.json({
            reviews,
            total: reviews.length,
            average: reviews.length > 0 ? (reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviews.length) : 0
        });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
