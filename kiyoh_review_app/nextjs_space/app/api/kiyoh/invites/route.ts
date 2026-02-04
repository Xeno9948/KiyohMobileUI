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

    const userId = (session.user as any)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true }
    });

    // Return invites for the user's company
    const invites = await prisma.reviewInvite.findMany({
      where: user?.companyId ? { companyId: user.companyId } : { userId },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    return NextResponse.json({ invites });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch invites", details: error?.message }, { status: 500 });
  }
}
