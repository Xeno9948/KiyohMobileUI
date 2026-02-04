import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET current user's company
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any)?.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true }
    });

    if (!user?.company) {
      return NextResponse.json({ company: null });
    }

    // Don't expose full API token, just show masked version
    const maskedToken = user.company.apiToken 
      ? `${user.company.apiToken.slice(0, 8)}...${user.company.apiToken.slice(-4)}`
      : null;

    return NextResponse.json({
      company: {
        id: user.company.id,
        name: user.company.name,
        locationId: user.company.locationId,
        apiTokenMasked: maskedToken,
        tenantId: user.company.tenantId,
        baseUrl: user.company.baseUrl,
        isActive: user.company.isActive,
        aiEnabled: user.company.aiEnabled,
        createdAt: user.company.createdAt
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch company", details: error?.message }, { status: 500 });
  }
}

// POST - Create or update company
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any)?.id;
    const body = await req.json();
    const { name, locationId, apiToken, tenantId, baseUrl } = body ?? {};

    if (!name || !locationId || !apiToken) {
      return NextResponse.json({ 
        error: "Company name, Location ID, and API Token are required" 
      }, { status: 400 });
    }

    // Validate the API credentials by making a test request
    const testUrl = `${baseUrl || "https://www.kiyoh.com"}/v1/publication/review/external/location/statistics?locationId=${locationId}`;
    const testResponse = await fetch(testUrl, {
      headers: {
        "X-Publication-Api-Token": apiToken,
        "Accept": "application/json"
      }
    });

    if (!testResponse.ok) {
      return NextResponse.json({ 
        error: "Invalid API credentials. Please verify your Location ID and API Token.",
        details: await testResponse.text()
      }, { status: 400 });
    }

    // Check if user already has a company
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true }
    });

    let company;

    if (user?.companyId) {
      // Update existing company
      company = await prisma.company.update({
        where: { id: user.companyId },
        data: {
          name,
          locationId,
          apiToken,
          tenantId: tenantId || "98",
          baseUrl: baseUrl || "https://www.kiyoh.com"
        }
      });
    } else {
      // Check if company with this locationId exists
      const existingCompany = await prisma.company.findUnique({
        where: { locationId }
      });

      if (existingCompany) {
        // Join existing company
        company = existingCompany;
        await prisma.user.update({
          where: { id: userId },
          data: { companyId: existingCompany.id }
        });
      } else {
        // Create new company
        company = await prisma.company.create({
          data: {
            name,
            locationId,
            apiToken,
            tenantId: tenantId || "98",
            baseUrl: baseUrl || "https://www.kiyoh.com",
            users: {
              connect: { id: userId }
            }
          }
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      company: {
        id: company.id,
        name: company.name,
        locationId: company.locationId
      }
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ 
        error: "A company with this Location ID already exists" 
      }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to save company", details: error?.message }, { status: 500 });
  }
}
