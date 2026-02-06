import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Diagnostic endpoint to check and fix GMB configuration
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get all companies
        const companies = await prisma.company.findMany({
            select: {
                id: true,
                name: true,
                gmbEnabled: true,
                gmbAccountId: true,
                gmbLocationId: true,
                gmbAccessToken: true,
                gmbTokenExpiry: true,
            }
        });

        return NextResponse.json({
            companies: companies.map(c => ({
                id: c.id,
                name: c.name,
                gmbEnabled: c.gmbEnabled,
                gmbAccountId: c.gmbAccountId,
                gmbLocationId: c.gmbLocationId,
                hasAccessToken: !!c.gmbAccessToken,
                tokenExpiry: c.gmbTokenExpiry,
            }))
        });

    } catch (error: any) {
        return NextResponse.json({
            error: error.message
        }, { status: 500 });
    }
}

/**
 * Force set GMB configuration
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { companyId, accountId, locationId } = body;

        if (!companyId) {
            return NextResponse.json({ error: "companyId required" }, { status: 400 });
        }

        const updateData: any = {
            gmbEnabled: true,
        };

        if (accountId) {
            updateData.gmbAccountId = accountId;
        }

        if (locationId) {
            updateData.gmbLocationId = locationId;
        }

        const updated = await prisma.company.update({
            where: { id: companyId },
            data: updateData,
            select: {
                id: true,
                name: true,
                gmbEnabled: true,
                gmbAccountId: true,
                gmbLocationId: true,
            }
        });

        return NextResponse.json({
            success: true,
            company: updated
        });

    } catch (error: any) {
        return NextResponse.json({
            error: error.message
        }, { status: 500 });
    }
}
