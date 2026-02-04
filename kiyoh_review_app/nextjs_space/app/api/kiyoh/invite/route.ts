import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any)?.id;
    if (!userId) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true }
    });

    if (!user?.company) {
      return NextResponse.json({ 
        error: "No company configured", 
        needsSetup: true,
        message: "Please configure your Kiyoh API credentials in Settings" 
      }, { status: 400 });
    }

    const company = user.company;
    const body = await req.json();
    // Support both field name formats (from form or direct API call)
    const invite_email = body.invite_email || body.email;
    const first_name = body.first_name || body.firstName;
    const last_name = body.last_name || body.lastName;
    const ref_code = body.ref_code || body.refCode;
    const { language, delay } = body ?? {};

    if (!invite_email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const inviteData = {
      location_id: company.locationId,
      invite_email,
      delay: delay ?? 0,
      first_name: first_name || undefined,
      last_name: last_name || undefined,
      ref_code: ref_code || undefined,
      language: language || "nl"
    };

    const response = await fetch(`${company.baseUrl}/v1/invite/external`, {
      method: "POST",
      headers: {
        "X-Publication-Api-Token": company.apiToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(inviteData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json({ error: "Failed to send invite", details: errorData }, { status: response.status });
    }

    // Save invite to database
    await prisma.reviewInvite.create({
      data: {
        email: invite_email,
        firstName: first_name || null,
        lastName: last_name || null,
        refCode: ref_code || null,
        language: language || "en",
        delay: delay ?? 0,
        userId,
        companyId: company.id
      }
    });

    return NextResponse.json({ success: true, message: "Invite sent successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to send invite", details: error?.message }, { status: 500 });
  }
}
