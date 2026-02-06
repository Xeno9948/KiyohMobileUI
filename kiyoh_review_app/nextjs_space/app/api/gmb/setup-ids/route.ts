import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Admin endpoint to manually fetch and save GMB account/location IDs
 * This bypasses the OAuth callback quota issues
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.log("[GMB Setup] Starting manual ID fetch...");

        // Get the company
        const company = await prisma.company.findFirst({
            where: {
                gmbAccessToken: {
                    not: null
                }
            }
        });

        if (!company || !company.gmbAccessToken) {
            return NextResponse.json({
                error: "No GMB access token found. Please connect your Google account first."
            }, { status: 400 });
        }

        console.log(`[GMB Setup] Found company: ${company.name}`);

        // Fetch accounts
        console.log("[GMB Setup] Fetching accounts from Google...");
        const accountsResponse = await fetch(
            "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
            {
                headers: {
                    Authorization: `Bearer ${company.gmbAccessToken}`,
                },
            }
        );

        if (!accountsResponse.ok) {
            const errorText = await accountsResponse.text();
            console.error("[GMB Setup] Accounts API error:", errorText);
            return NextResponse.json({
                error: "Failed to fetch accounts from Google",
                details: errorText
            }, { status: accountsResponse.status });
        }

        const accountsData = await accountsResponse.json();
        console.log("[GMB Setup] Accounts response:", JSON.stringify(accountsData, null, 2));

        if (!accountsData.accounts || accountsData.accounts.length === 0) {
            return NextResponse.json({
                error: "No GMB accounts found for this Google account",
                data: accountsData
            }, { status: 404 });
        }

        const account = accountsData.accounts[0];
        const accountId = account.name;
        console.log(`[GMB Setup] ✅ Found account: ${accountId}`);

        // Fetch locations
        console.log("[GMB Setup] Fetching locations...");
        const locationsResponse = await fetch(
            `https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations`,
            {
                headers: {
                    Authorization: `Bearer ${company.gmbAccessToken}`,
                },
            }
        );

        if (!locationsResponse.ok) {
            const errorText = await locationsResponse.text();
            console.error("[GMB Setup] Locations API error:", errorText);
            return NextResponse.json({
                error: "Failed to fetch locations from Google",
                details: errorText,
                accountId
            }, { status: locationsResponse.status });
        }

        const locationsData = await locationsResponse.json();
        console.log("[GMB Setup] Locations response:", JSON.stringify(locationsData, null, 2));

        if (!locationsData.locations || locationsData.locations.length === 0) {
            return NextResponse.json({
                error: "No locations found for this account",
                accountId,
                data: locationsData
            }, { status: 404 });
        }

        const location = locationsData.locations[0];
        const locationId = location.name;
        console.log(`[GMB Setup] ✅ Found location: ${locationId}`);

        // Update database
        console.log("[GMB Setup] Updating database...");
        await prisma.company.update({
            where: { id: company.id },
            data: {
                gmbAccountId: accountId,
                gmbLocationId: locationId,
            },
        });

        console.log("[GMB Setup] ✅ Database updated successfully!");

        return NextResponse.json({
            success: true,
            message: "GMB account and location IDs saved successfully!",
            accountId,
            locationId,
            accountInfo: {
                accountName: account.accountName,
                type: account.type,
            },
            locationInfo: {
                name: location.title,
                address: location.storefrontAddress?.addressLines?.join(", "),
            }
        });

    } catch (error: any) {
        console.error("[GMB Setup] Error:", error);
        return NextResponse.json({
            error: "Internal server error",
            message: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
