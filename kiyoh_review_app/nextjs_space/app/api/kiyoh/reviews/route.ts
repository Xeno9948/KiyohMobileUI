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

    // Get user's company with API credentials
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
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit") || "20";
    const orderBy = searchParams.get("orderBy") || "CREATE_DATE";
    const sortOrder = searchParams.get("sortOrder") || "DESC";
    const dateSince = searchParams.get("dateSince");

    let url = `${company.baseUrl}/v1/publication/review/external?locationId=${company.locationId}&tenantId=${company.tenantId}&limit=${limit}&orderBy=${orderBy}&sortOrder=${sortOrder}`;
    if (dateSince) {
      url += `&dateSince=${encodeURIComponent(dateSince)}`;
    }

    const response = await fetch(url, {
      headers: {
        "X-Publication-Api-Token": company.apiToken,
        "Accept": "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: "Failed to fetch reviews", details: errorText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch reviews", details: error?.message }, { status: 500 });
  }
}