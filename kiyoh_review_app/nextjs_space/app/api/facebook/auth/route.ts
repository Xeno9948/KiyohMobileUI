import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import crypto from 'crypto';

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const redirectPath = searchParams.get('returnTo') || '/settings';

    const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
    const FACEBOOK_REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/facebook/callback`;

    if (!FACEBOOK_APP_ID) {
        return NextResponse.json({ error: "Configuration Missing: FACEBOOK_APP_ID" }, { status: 500 });
    }

    // Generate state for CSRF protection
    // State format: "randomKey:returnPath" to remember where to go back
    const stateKey = crypto.randomBytes(16).toString('hex');
    const state = Buffer.from(JSON.stringify({ key: stateKey, path: redirectPath })).toString('base64');

    // Scopes required for Reviews Integration
    // pages_show_list: To see pages user manages
    // pages_read_user_content: To read reviews
    // pages_read_engagement: To see ratings/stats
    // public_profile: Basic info
    const scopes = [
        'public_profile',
        'pages_show_list',
        'pages_read_engagement',
        'pages_read_user_content'
    ].join(',');

    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${FACEBOOK_APP_ID}&redirect_uri=${FACEBOOK_REDIRECT_URI}&state=${state}&scope=${scopes}&response_type=code`;

    return NextResponse.redirect(authUrl);
}
