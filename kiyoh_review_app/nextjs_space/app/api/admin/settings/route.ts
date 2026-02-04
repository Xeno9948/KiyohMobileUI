import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || (session.user as any).role !== "superadmin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const settings = await prisma.systemSettings.findUnique({
            where: { id: "global" },
        });

        // Return default empty structured object if no settings found
        if (!settings) {
            return NextResponse.json({
                settings: {
                    aiProvider: "openai",
                    aiApiKey: "",
                    aiModel: "gpt-4-turbo"
                }
            });
        }

        return NextResponse.json({ settings });
    } catch (error) {
        console.error("Failed to fetch settings:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || (session.user as any).role !== "superadmin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { aiProvider, aiApiKey, aiModel } = body;

        const settings = await prisma.systemSettings.upsert({
            where: { id: "global" },
            update: {
                aiProvider,
                aiApiKey,
                aiModel,
            },
            create: {
                id: "global",
                aiProvider,
                aiApiKey,
                aiModel,
            },
        });

        return NextResponse.json({ settings });
    } catch (error) {
        console.error("Failed to update settings:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
