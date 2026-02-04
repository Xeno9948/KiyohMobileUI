import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import AdminContent from "./admin-content";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/login");
  }

  const role = (session.user as any)?.role;
  if (role !== "superadmin") {
    redirect("/dashboard");
  }

  return <AdminContent />;
}
