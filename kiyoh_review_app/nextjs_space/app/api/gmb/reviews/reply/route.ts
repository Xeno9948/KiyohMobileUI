import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { getGoogleOAuthCredentials } from "@/lib/google-oauth";

export const dynamic = "force-dynamic";

/**
 * Helper function to refresh access token if expired
 */
async function refreshAccessToken(company: any) {
    if (!company.gmbRefreshToken) {
        throw new Error("No refresh token available");
    }

    const { clientId, clientSecret } = await getGoogleOAuthCredentials();

    if (!clientId || !clientSecret) {
        throw new Error("OAuth not configured");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: company.gmbRefreshToken,
            grant_type: "refresh_token",
        }),
    });

    if (!tokenResponse.ok) {
        throw new Error("Failed to refresh token");
    }

    const tokens = await tokenResponse.json();
    const { access_token, expires_in } = tokens;
    const tokenExpiry = new Date(Date.now() + expires_in * 1000);

    await prisma.company.update({
        where: { id: company.id },
        data: {
            gmbAccessToken: access_token,
            gmbTokenExpiry: tokenExpiry,
        },
    });

    return access_token;
}

/**
 * Get valid access token (refresh if needed)
 */
async function getValidAccessToken(company: any): Promise<string> {
    const now = new Date();
    const expiryBuffer = new Date(now.getTime() + 5 * 60 * 1000);

    if (!company.gmbTokenExpiry || company.gmbTokenExpiry < expiryBuffer) {
        return await refreshAccessToken(company);
    }

    return company.gmbAccessToken;
}

/**
 * Reply to a GMB review
 */
export async function PUT(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = (session.user as any)?.id;
        if (!userId) {
            return NextResponse.json({ error: "User not found" }, { status: 401 });
        }

        const body = await req.json();
        const { reviewId, comment } = body;

        if (!reviewId || !comment) {
            return NextResponse.json({
                error: "Missing reviewId or comment"
            }, { status: 400 });
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

        const company = user.company;

        if (!company.gmbEnabled || !company.gmbAccountId || !company.gmbLocationId) {
            return NextResponse.json({
                error: "GMB not configured"
            }, { status: 400 });
        }

        // Get valid access token
        const accessToken = await getValidAccessToken(company);

        // Post reply to GMB API
        const replyUrl = `https://mybusiness.googleapis.com/v4/${company.gmbAccountId}/${company.gmbLocationId}/reviews/${reviewId}/reply`;

        const replyResponse = await fetch(replyUrl, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ comment }),
        });

        if (!replyResponse.ok) {
            const errorText = await replyResponse.text();
            console.error("GMB reply error:", errorText);
            return NextResponse.json({
                error: "Failed to post reply",
                details: errorText
            }, { status: replyResponse.status });
        }

        const replyData = await replyResponse.json();

        // Update local database
        await prisma.gMBReview.update({
            where: { reviewId },
            data: {
                reviewReply: comment,
                replyUpdateTime: new Date(),
            },
        });

        return NextResponse.json({
            success: true,
            reply: replyData
        });
    } catch (error: any) {
        console.error("GMB reply error:", error);
        return NextResponse.json({
            error: "Failed to post reply",
            details: error?.message
        }, { status: 500 });
    }
}
