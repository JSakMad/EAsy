import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./auth";
import { isAuthConfigured } from "./auth-config";

export async function getSession() {
  if (!isAuthConfigured()) return null;
  return getAuth().api.getSession({ headers: await headers() });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}
