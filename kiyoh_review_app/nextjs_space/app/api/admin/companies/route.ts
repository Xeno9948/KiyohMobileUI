import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET all companies (admin only)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any)?.role;
    if (userRole !== "superadmin") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        locationId: true,
        tenantId: true,
        baseUrl: true,
        isActive: true,
        aiEnabled: true,
        createdAt: true,
        _count: {
          select: { users: true, invites: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ companies });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch companies", details: error?.message }, { status: 500 });
  }
}

// PATCH - Update company details (AI, Name, API Token)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any)?.role;
    if (userRole !== "superadmin") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const { companyId, aiEnabled, name, locationId, apiToken, baseUrl } = body;

    if (!companyId) {
      return NextResponse.json({ error: "Company ID is required" }, { status: 400 });
    }

    // Build update object dynamically
    const updateData: any = {};
    if (typeof aiEnabled === "boolean") updateData.aiEnabled = aiEnabled;
    if (name) updateData.name = name;
    if (locationId) updateData.locationId = locationId;
    if (apiToken) updateData.apiToken = apiToken;
    if (baseUrl) updateData.baseUrl = baseUrl;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const company = await prisma.company.update({
      where: { id: companyId },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      company: {
        id: company.id,
        name: company.name,
        aiEnabled: company.aiEnabled,
        locationId: company.locationId
      }
    });
  } catch (error: any) {
    // Handle unique constraint violation (e.g. duplicate locationId)
    if (error.code === "P2002") {
      return NextResponse.json({
        error: "A company with this Location ID already exists"
      }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update company", details: error?.message }, { status: 500 });
  }
}
