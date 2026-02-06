import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
        return NextResponse.redirect(new URL(`/settings?error=facebook_auth_failed&details=${error}`, request.url));
    }

    if (!code) {
        return NextResponse.redirect(new URL("/settings?error=facebook_no_code", request.url));
    }

    // Decode State
    let returnPath = '/settings';
    try {
        const stateObj = JSON.parse(Buffer.from(state || "", 'base64').toString());
        if (stateObj.path) returnPath = stateObj.path;
    } catch (e) {
        console.error("Failed to parse state", e);
    }

    const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
    const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
    const FACEBOOK_REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/facebook/callback`;

    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
        return NextResponse.redirect(new URL(`/settings?error=facebook_config_missing`, request.url));
    }

    try {
        // 1. Exchange Code for Short-Lived User Token
        const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${FACEBOOK_APP_ID}&redirect_uri=${FACEBOOK_REDIRECT_URI}&client_secret=${FACEBOOK_APP_SECRET}&code=${code}`;

        const tokenRes = await fetch(tokenUrl);
        const tokenData = await tokenRes.json();

        if (tokenData.error) {
            throw new Error(tokenData.error.message);
        }

        const shortLivedToken = tokenData.access_token;

        // 2. Exchange Short-Lived Token for Long-Lived User Token (~60 days)
        const longLivedUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${FACEBOOK_APP_ID}&client_secret=${FACEBOOK_APP_SECRET}&fb_exchange_token=${shortLivedToken}`;

        const longLivedRes = await fetch(longLivedUrl);
        const longLivedData = await longLivedRes.json();

        if (longLivedData.error) {
            throw new Error(longLivedData.error.message);
        }

        const longLivedToken = longLivedData.access_token;
        const expiresIn = longLivedData.expires_in; // seconds
        const expiryDate = new Date(Date.now() + expiresIn * 1000);

        // 3. Fetch User's Pages to get Page Access Token
        const pagesUrl = `https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedToken}`;
        const pagesRes = await fetch(pagesUrl);
        const pagesData = await pagesRes.json();

        if (pagesData.error) {
            throw new Error(pagesData.error.message);
        }

        const pages = pagesData.data;

        if (!pages || pages.length === 0) {
            return NextResponse.redirect(new URL(`/settings?error=facebook_no_pages_found`, request.url));
        }

        // Auto-select the first page for now
        // TODO: Add UI to select page if multiple
        const selectedPage = pages[0];
        const pageId = selectedPage.id;
        const pageAccessToken = selectedPage.access_token; // This token typically doesn't expire if generated from long-lived user token

        // 4. Save to Database
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { company: true }
        });

        if (user?.companyId) {
            await prisma.company.update({
                where: { id: user.companyId },
                data: {
                    fbEnabled: true,
                    fbAccessToken: longLivedToken, // User token
                    fbPageAccessToken: pageAccessToken, // Page token
                    fbPageId: pageId,
                    fbTokenExpiry: expiryDate
                }
            });
        }

        return NextResponse.redirect(new URL(`${returnPath}?success=facebook_connected`, request.url));

    } catch (error: any) {
        console.error("Facebook Auth Error:", error);
        return NextResponse.redirect(new URL(`/settings?error=facebook_auth_exception&details=${encodeURIComponent(error.message)}`, request.url));
    }
}
