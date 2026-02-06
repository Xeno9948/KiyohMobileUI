import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Disconnect GMB integration
 */
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = (session.user as any)?.id;
        if (!userId) {
            return NextResponse.json({ error: "User not found" }, { status: 401 });
        }

        // Get user's company
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { company: true }
        });

        if (!user?.company) {
            return NextResponse.json({
                error: "No company configured"
            }, { status: 400 });
        }

        // Clear GMB tokens and settings
        await prisma.company.update({
            where: { id: user.company.id },
            data: {
                gmbEnabled: false,
                gmbAccountId: null,
                gmbLocationId: null,
                gmbAccessToken: null,
                gmbRefreshToken: null,
                gmbTokenExpiry: null,
            },
        });

        // Optionally delete GMB review data
        // Uncomment if you want to delete reviews when disconnecting
        // await prisma.gMBReview.deleteMany({
        //   where: { companyId: user.company.id },
        // });

        return NextResponse.json({
            success: true,
            message: "GMB integration disconnected successfully"
        });
    } catch (error: any) {
        console.error("GMB disconnect error:", error);
        return NextResponse.json({
            error: "Failed to disconnect GMB",
            details: error?.message
        }, { status: 500 });
    }
}
