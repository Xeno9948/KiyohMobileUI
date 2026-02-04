import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any)?.role;
    if (userRole !== "superadmin") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, newPassword } = body ?? {};

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.role === "superadmin") {
      return NextResponse.json({ error: "Cannot reset superadmin password" }, { status: 403 });
    }

    // If newPassword provided, set it directly
    if (newPassword) {
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id: userId },
        data: { 
          password: hashedPassword,
          resetToken: null,
          resetTokenExp: null
        }
      });

      return NextResponse.json({ 
        success: true, 
        message: `Password has been reset for ${user.email}`,
        tempPassword: newPassword
      });
    }

    // Generate a temporary password
    const tempPassword = crypto.randomBytes(8).toString("hex");
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { 
        password: hashedPassword,
        resetToken: null,
        resetTokenExp: null
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: `Password has been reset for ${user.email}`,
      tempPassword,
      userEmail: user.email
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to reset password", details: error?.message }, { status: 500 });
  }
}
