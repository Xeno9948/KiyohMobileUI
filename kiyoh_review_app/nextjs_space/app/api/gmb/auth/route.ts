import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Initiates OAuth flow for Google My Business
 * Redirects user to Google consent screen
 */
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

        const clientId = process.env.GOOGLE_CLIENT_ID;
        const redirectUri = process.env.GOOGLE_REDIRECT_URI;

        if (!clientId || !redirectUri) {
            return NextResponse.json({
                error: "Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI environment variables."
            }, { status: 500 });
        }

        // Generate state parameter for CSRF protection (include company ID)
        const state = Buffer.from(JSON.stringify({
            companyId: user.company.id,
            timestamp: Date.now()
        })).toString('base64');

        // Build OAuth URL
        const scope = "https://www.googleapis.com/auth/business.manage";
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${encodeURIComponent(clientId)}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&response_type=code` +
            `&scope=${encodeURIComponent(scope)}` +
            `&access_type=offline` +
            `&prompt=consent` +
            `&state=${encodeURIComponent(state)}`;

        // Redirect to Google OAuth
        return NextResponse.redirect(authUrl);
    } catch (error: any) {
        console.error("GMB Auth error:", error);
        return NextResponse.json({
            error: "Failed to initiate OAuth flow",
            details: error?.message
        }, { status: 500 });
    }
}
