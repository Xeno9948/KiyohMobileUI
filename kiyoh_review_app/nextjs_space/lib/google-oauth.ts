import { prisma } from "./db";

/**
 * Helper function to get Google OAuth credentials from database
 * Falls back to environment variables if not set in DB
 */
export async function getGoogleOAuthCredentials() {
    try {
        const settings = await prisma.systemSettings.findUnique({
            where: { id: "global" },
        });

        return {
            clientId: settings?.googleClientId || process.env.GOOGLE_CLIENT_ID,
            clientSecret: settings?.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET,
            redirectUri: settings?.googleRedirectUri || process.env.GOOGLE_REDIRECT_URI,
        };
    } catch (error) {
        // Fallback to env vars if DB query fails
        return {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            redirectUri: process.env.GOOGLE_REDIRECT_URI,
        };
    }
}
