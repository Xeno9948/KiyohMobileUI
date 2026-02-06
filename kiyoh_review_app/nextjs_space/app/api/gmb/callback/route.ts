import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getGoogleOAuthCredentials } from "@/lib/google-oauth";

export const dynamic = "force-dynamic";

/**
 * OAuth callback handler
 * Exchanges authorization code for access/refresh tokens
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const error = searchParams.get("error");

        // Handle user denial
        if (error) {
            return NextResponse.redirect(
                new URL(`/settings?gmb_error=${encodeURIComponent(error)}`, req.url)
            );
        }

        if (!code || !state) {
            return NextResponse.redirect(
                new URL("/settings?gmb_error=missing_parameters", req.url)
            );
        }

        // Decode and verify state
        let stateData: { companyId: string; timestamp: number };
        try {
            stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        } catch {
            return NextResponse.redirect(
                new URL("/settings?gmb_error=invalid_state", req.url)
            );
        }

        // Check timestamp (prevent replay attacks - state valid for 10 minutes)
        if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
            return NextResponse.redirect(
                new URL("/settings?gmb_error=expired_state", req.url)
            );
        }

        const { clientId, clientSecret, redirectUri } = await getGoogleOAuthCredentials();

        if (!clientId || !clientSecret || !redirectUri) {
            return NextResponse.redirect(
                new URL("/settings?gmb_error=oauth_not_configured", req.url)
            );
        }

        // Exchange code for tokens
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: "authorization_code",
            }),
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            console.error("Token exchange failed:", errorData);
            return NextResponse.redirect(
                new URL("/settings?gmb_error=token_exchange_failed", req.url)
            );
        }

        const tokens = await tokenResponse.json();
        const { access_token, refresh_token, expires_in } = tokens;

        if (!access_token || !refresh_token) {
            return NextResponse.redirect(
                new URL("/settings?gmb_error=missing_tokens", req.url)
            );
        }

        // Calculate token expiry
        const tokenExpiry = new Date(Date.now() + expires_in * 1000);

        // Get GMB account and location info
        let gmbAccountId: string | null = null;
        let gmbLocationId: string | null = null;

        try {
            // Fetch accounts
            const accountsResponse = await fetch(
                "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
                {
                    headers: { Authorization: `Bearer ${access_token}` },
                }
            );

            if (accountsResponse.ok) {
                const accountsData = await accountsResponse.json();
                if (accountsData.accounts && accountsData.accounts.length > 0) {
                    // Use the first account
                    const account = accountsData.accounts[0];
                    gmbAccountId = account.name; // Format: accounts/{account_id}

                    // Fetch locations for this account
                    const locationsResponse = await fetch(
                        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
                        {
                            headers: { Authorization: `Bearer ${access_token}` },
                        }
                    );

                    if (locationsResponse.ok) {
                        const locationsData = await locationsResponse.json();
                        if (locationsData.locations && locationsData.locations.length > 0) {
                            // Use the first location
                            gmbLocationId = locationsData.locations[0].name; // Format: locations/{location_id}
                        }
                    }
                }
            }
        } catch (fetchError) {
            console.error("Failed to fetch GMB account/location info:", fetchError);
            // Continue anyway - we can fetch this later
        }

        // Store tokens in database (in production, encrypt these!)
        await prisma.company.update({
            where: { id: stateData.companyId },
            data: {
                gmbEnabled: true,
                gmbAccessToken: access_token, // TODO: Encrypt in production
                gmbRefreshToken: refresh_token, // TODO: Encrypt in production
                gmbTokenExpiry: tokenExpiry,
                gmbAccountId,
                gmbLocationId,
            },
        });

        // Redirect back to settings with success message
        return NextResponse.redirect(
            new URL("/settings?gmb_success=true", req.url)
        );
    } catch (error: any) {
        console.error("GMB callback error:", error);
        return NextResponse.redirect(
            new URL(`/settings?gmb_error=${encodeURIComponent(error.message || "unknown")}`, req.url || "http://localhost:3000")
        );
    }
}
