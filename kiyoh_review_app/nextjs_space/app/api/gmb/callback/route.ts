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

        console.log("[GMB OAuth] Starting account/location fetch...");

        try {
            // Fetch accounts
            console.log("[GMB OAuth] Fetching accounts from Google API...");
            const accountsResponse = await fetch(
                "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
                {
                    headers: { Authorization: `Bearer ${access_token}` },
                }
            );

            console.log(`[GMB OAuth] Accounts API response status: ${accountsResponse.status}`);

            if (!accountsResponse.ok) {
                const errorText = await accountsResponse.text();
                console.error(`[GMB OAuth] ❌ Accounts API error: ${errorText}`);
            } else {
                const accountsData = await accountsResponse.json();
                console.log(`[GMB OAuth] Accounts data:`, JSON.stringify(accountsData, null, 2));

                if (accountsData.accounts && accountsData.accounts.length > 0) {
                    // Use the first account
                    const account = accountsData.accounts[0];
                    gmbAccountId = account.name; // Format: accounts/{account_id}
                    console.log(`[GMB OAuth] ✅ Found account: ${gmbAccountId}`);

                    // Fetch locations for this account
                    console.log(`[GMB OAuth] Fetching locations for account: ${account.name}`);
                    const locationsResponse = await fetch(
                        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
                        {
                            headers: { Authorization: `Bearer ${access_token}` },
                        }
                    );

                    console.log(`[GMB OAuth] Locations API response status: ${locationsResponse.status}`);

                    if (!locationsResponse.ok) {
                        const errorText = await locationsResponse.text();
                        console.error(`[GMB OAuth] ❌ Locations API error: ${errorText}`);
                    } else {
                        const locationsData = await locationsResponse.json();
                        console.log(`[GMB OAuth] Locations data:`, JSON.stringify(locationsData, null, 2));

                        if (locationsData.locations && locationsData.locations.length > 0) {
                            // Use the first location
                            gmbLocationId = locationsData.locations[0].name; // Format: accounts/{accountId}/locations/{locationId}
                            console.log(`[GMB OAuth] ✅ Found location: ${gmbLocationId}`);
                        } else {
                            console.warn(`[GMB OAuth] ⚠️ No locations found in response`);
                        }
                    }
                } else {
                    console.warn(`[GMB OAuth] ⚠️ No accounts found in response`);
                }
            }
        } catch (fetchError: any) {
            console.error("[GMB OAuth] ❌ Exception during account/location fetch:", fetchError);
            console.error("[GMB OAuth] Error stack:", fetchError.stack);
        }

        console.log(`[GMB OAuth] Final IDs - Account: ${gmbAccountId}, Location: ${gmbLocationId}`);
        console.log(`[GMB OAuth] Saving to database for company: ${stateData.companyId}`);

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

        console.log(`[GMB OAuth] ✅ Database updated successfully`);

        // Determine the base URL for redirection
        const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
        const protocol = req.headers.get("x-forwarded-proto") || "https";
        const baseUrl = host ? `${protocol}://${host}` : new URL(req.url).origin;

        // Redirect back to settings with success message
        return NextResponse.redirect(`${baseUrl}/settings?gmb_success=true`);
    } catch (error: any) {
        console.error("GMB callback error:", error);

        // Determine base URL even in error case
        const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
        const protocol = req.headers.get("x-forwarded-proto") || "https";
        const baseUrl = host ? `${protocol}://${host}` : "http://localhost:3000";

        return NextResponse.redirect(
            `${baseUrl}/settings?gmb_error=${encodeURIComponent(error.message || "unknown")}`
        );
    }
}
