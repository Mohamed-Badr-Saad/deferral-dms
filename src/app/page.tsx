import { redirect } from "next/navigation";
import { getBusinessProfile } from "@/src/lib/authz";

export default async function HomePage() {
  const profile = await getBusinessProfile();

  // Not logged in → go to login
  if (!profile) {
    redirect("/login");
  }

  // Logged in → go to dashboard
  redirect("/deferrals");
}