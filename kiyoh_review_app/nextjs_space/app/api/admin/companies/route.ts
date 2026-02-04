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

// PATCH - Toggle AI for a company
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

    const { companyId, aiEnabled } = await req.json();

    if (!companyId || typeof aiEnabled !== "boolean") {
      return NextResponse.json({ error: "Company ID and aiEnabled are required" }, { status: 400 });
    }

    const company = await prisma.company.update({
      where: { id: companyId },
      data: { aiEnabled }
    });

    return NextResponse.json({ 
      success: true, 
      company: {
        id: company.id,
        name: company.name,
        aiEnabled: company.aiEnabled
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to update company", details: error?.message }, { status: 500 });
  }
}
