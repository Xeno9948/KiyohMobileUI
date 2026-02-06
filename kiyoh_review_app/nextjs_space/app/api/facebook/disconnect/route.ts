import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { company: true }
        });

        if (!user?.companyId) {
            return NextResponse.json({ error: "Company not found" }, { status: 404 });
        }

        // Disconnect
        await prisma.company.update({
            where: { id: user.companyId },
            data: {
                fbEnabled: false,
                fbAccessToken: null,
                fbPageAccessToken: null,
                fbPageId: null,
                fbTokenExpiry: null
            }
        });

        // Optionally fetch delete count
        const deletedCount = await prisma.facebookReview.deleteMany({
            where: { companyId: user.companyId }
        });

        return NextResponse.json({ success: true, deletedReviews: deletedCount.count });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
