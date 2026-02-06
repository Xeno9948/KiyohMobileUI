import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true }
    });

    if (!user?.company) {
      return NextResponse.json({
        error: "No company configured",
        needsSetup: true,
        message: "Please configure your Kiyoh API credentials in Settings"
      }, { status: 400 });
    }

    const company = user.company;

    // Fetch from the reviews endpoint which includes star distribution data
    // The /location/statistics endpoint doesn't return fiveStars, fourStars, etc.
    const url = `${company.baseUrl}/v1/publication/review/external?locationId=${company.locationId}&tenantId=${company.tenantId}&limit=1`;

    const response = await fetch(url, {
      headers: {
        "X-Publication-Api-Token": company.apiToken,
        "Accept": "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: "Failed to fetch statistics", details: errorText }, { status: response.status });
    }

    const data = await response.json();

    // Calculate GMB Stats before constructing response
    const gmbStats = company.gmbEnabled ? await (async () => {
      // 1. Try internal database first
      const ratings = await prisma.gMBReview.groupBy({
        by: ['starRating'],
        where: { companyId: company.id },
        _count: true
      });

      let totalScore = 0;
      let totalCount = 0;
      const ratingMap: Record<string, number> = { "ONE": 1, "TWO": 2, "THREE": 3, "FOUR": 4, "FIVE": 5 };

      ratings.forEach((r: any) => {
        if (r.starRating && ratingMap[r.starRating]) {
          const score = ratingMap[r.starRating];
          const count = r._count;
          totalScore += score * count;
          totalCount += count;
        }
      });

      if (totalCount > 0) return { rating: totalScore / totalCount, count: totalCount };

      // 2. Fallback to Google Places API if DB is empty
      if (process.env.GOOGLE_PLACES_API_KEY && company.name) {
        try {
          // Step 1: Search for the Place ID using Text Search (New)
          const searchUrl = 'https://places.googleapis.com/v1/places:searchText';
          const searchResponse = await fetch(searchUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY as string,
              'X-Goog-FieldMask': 'places.name,places.id,places.formattedAddress'
            },
            body: JSON.stringify({
              textQuery: company.name
            })
          });

          const searchData = await searchResponse.json();

          if (searchData.places && searchData.places.length > 0) {
            const placeId = searchData.places[0].name;

            // Step 2: Get Place Details (Rating & Count)
            const detailsUrl = `https://places.googleapis.com/v1/${placeId}`;
            const detailsResponse = await fetch(detailsUrl, {
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY as string,
                'X-Goog-FieldMask': 'rating,userRatingCount'
              }
            });

            const details = await detailsResponse.json();

            if (details.rating) {
              return { rating: details.rating, count: details.userRatingCount || 0 };
            }
          }
          return { rating: 0, count: 0 };
        } catch (e) {
          console.error("Places API Fallback Error:", e);
          return { rating: 0, count: 0 };
        }
      }
      return { rating: 0, count: 0 };
    })() : { rating: 0, count: 0 };

    // Calculate Facebook Stats
    const fbStats = company.fbEnabled ? await (async () => {
      const agg = await prisma.facebookReview.aggregate({
        where: { companyId: company.id, rating: { not: null } },
        _avg: { rating: true },
        _count: { rating: true }
      });
      return {
        rating: agg._avg.rating || 0,
        count: agg._count.rating || 0
      };
    })() : { rating: 0, count: 0 };

    // The response includes location stats with star distribution
    return NextResponse.json({
      locationId: data.locationId,
      locationName: data.locationName,
      averageRating: data.averageRating,
      numberReviews: data.numberReviews,
      recommendation: data.recommendation || Math.round((data.averageRating / 10) * 100),

      // GMB Integration
      gmbEnabled: company.gmbEnabled,
      gmbAverageRating: gmbStats.rating,
      gmbTotalReviews: gmbStats.count,

      // Facebook Integration
      fbEnabled: company.fbEnabled,
      fbAverageRating: fbStats.rating,
      fbTotalReviews: fbStats.count,

      last12MonthAverageRating: data.last12MonthAverageRating,
      last12MonthNumberReviews: data.last12MonthNumberReviews,
      fiveStars: data.fiveStars || 0,
      fourStars: data.fourStars || 0,
      threeStars: data.threeStars || 0,
      twoStars: data.twoStars || 0,
      oneStars: data.oneStars || 0,
      viewReviewUrl: data.viewReviewUrl,
      createReviewUrl: data.createReviewUrl,
      aiEnabled: company.aiEnabled,
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch statistics", details: error?.message }, { status: 500 });
  }
}
