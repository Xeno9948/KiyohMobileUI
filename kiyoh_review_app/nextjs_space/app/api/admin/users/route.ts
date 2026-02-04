import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

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

    // Get all users with their company info and review counts
    const users = await prisma.user.findMany({
      where: { role: { not: "superadmin" } },
      include: {
        company: true,
        _count: {
          select: { invites: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Get review stats for each company
    const usersWithStats = await Promise.all(
      users.map(async (user: any) => {
        let reviewCount = 0;
        
        if (user.company) {
          try {
            const statsUrl = `${user.company.baseUrl}/v1/publication/review/external/location/statistics?locationId=${user.company.locationId}`;
            const response = await fetch(statsUrl, {
              headers: {
                "X-Publication-Api-Token": user.company.apiToken,
                "Accept": "application/json"
              },
              cache: "no-store"
            });
            if (response.ok) {
              const stats = await response.json();
              reviewCount = stats.numberReviews || 0;
            }
          } catch (e) {
            // Ignore API errors
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          hasApiSetup: !!user.companyId,
          companyName: user.company?.name || null,
          locationId: user.company?.locationId || null,
          invitesSent: user._count.invites,
          reviewCount
        };
      })
    );

    return NextResponse.json({ users: usersWithStats });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch users", details: error?.message }, { status: 500 });
  }
}
