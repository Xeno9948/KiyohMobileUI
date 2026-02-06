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
      gmbAverageRating: gmbStats.rating,
      gmbTotalReviews: gmbStats.count,

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
