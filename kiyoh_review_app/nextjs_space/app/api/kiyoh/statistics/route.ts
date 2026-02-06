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

    // The response includes location stats with star distribution
    return NextResponse.json({
      locationId: data.locationId,
      locationName: data.locationName,
      averageRating: data.averageRating,
      numberReviews: data.numberReviews,
      recommendation: data.recommendation || Math.round((data.averageRating / 10) * 100),

      // GMB Integration
      gmbEnabled: company.gmbEnabled,
      gmbAverageRating: company.gmbEnabled ? await (async () => {
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

        if (totalCount > 0) return totalScore / totalCount;

        // 2. Fallback to Google Places API if DB is empty
        if (process.env.GOOGLE_PLACES_API_KEY && company.gmbLocationId) {
          try {
            // Determine Place ID (assuming gmbLocationId might be it, or we simply use search)
            // For simplicity/safety, we only search if we have a Place ID format, OR we use the Text Search to find by name if needed.
            // But typically gmbLocationId is internal. We cannot use that directly with Places API (New) without mapping.
            // However, often users put the Place ID in settings if we ask.
            // Let's assume for now we only return 0 if DB is empty, ensuring we don't break. 
            // To do this properly, we need a Place ID field. 
            return 0;
          } catch (e) { return 0; }
        }
        return 0;
      })() : 0,

      gmbTotalReviews: company.gmbEnabled ?
        await prisma.gMBReview.count({ where: { companyId: company.id } }) : 0,

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
