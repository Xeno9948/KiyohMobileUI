import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Try to fetch reviews with the location ID to discover the account ID
 * GMB API will tell us the correct account ID in the response
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.log("[GMB Fix] Starting location setup...");

        const company = await prisma.company.findFirst({
            where: {
                gmbAccessToken: { not: null }
            }
        });

        if (!company || !company.gmbAccessToken) {
            return NextResponse.json({
                error: "No GMB access token found"
            }, { status: 400 });
        }

        const locationId = "11535144745965350294";

        console.log("[GMB Fix] Testing different account ID formats...");

        // Try common account ID patterns
        const accountPatterns = [
            `accounts/${locationId.substring(0, 10)}`, // First 10 digits
            `accounts/${locationId}`, // Full location as account
            `accounts/me`, // Special "me" identifier
        ];

        let foundAccountId = null;
        let foundLocationId = null;

        for (const accountId of accountPatterns) {
            const testLocationId = `${accountId}/locations/${locationId}`;

            console.log(`[GMB Fix] Trying: ${testLocationId}`);

            try {
                // Try to fetch reviews - if it works, we found the right format
                const reviewsUrl = `https://mybusiness.googleapis.com/v4/${testLocationId}/reviews`;
                const response = await fetch(reviewsUrl, {
                    headers: {
                        Authorization: `Bearer ${company.gmbAccessToken}`,
                    },
                });

                console.log(`[GMB Fix] Response status: ${response.status}`);

                if (response.ok) {
                    const data = await response.json();
                    console.log(`[GMB Fix] ✅ SUCCESS with ${accountId}!`);
                    console.log(`[GMB Fix] Found ${data.reviews?.length || 0} reviews`);

                    foundAccountId = accountId;
                    foundLocationId = testLocationId;
                    break;
                } else if (response.status !== 404 && response.status !== 403 && response.status !== 429) {
                    const errorText = await response.text();
                    console.log(`[GMB Fix] Error: ${errorText}`);
                }
            } catch (err) {
                console.log(`[GMB Fix] Exception: ${err}`);
            }
        }

        if (!foundAccountId) {
            return NextResponse.json({
                error: "Could not determine account ID automatically",
                suggestion: "Please enable billing in Google Cloud Console to use the automatic setup",
                locationNumber: locationId,
                tried: accountPatterns
            }, { status: 400 });
        }

        // Update database
        console.log("[GMB Fix] Updating database...");
        await prisma.company.update({
            where: { id: company.id },
            data: {
                gmbAccountId: foundAccountId,
                gmbLocationId: foundLocationId,
                gmbEnabled: true,
            },
        });

        console.log("[GMB Fix] ✅ Database updated!");

        return NextResponse.json({
            success: true,
            message: "GMB IDs configured successfully!",
            accountId: foundAccountId,
            locationId: foundLocationId,
            note: "You can now fetch GMB reviews!"
        });

    } catch (error: any) {
        console.error("[GMB Fix] Error:", error);
        return NextResponse.json({
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
