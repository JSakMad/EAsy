"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export function AccountNav() {
  const { data: session, isPending, error } = authClient.useSession();
  if (isPending) return <span className="account-nav" role="status">Loading account…</span>;
  return <Link className="account-nav" href={!error && session ? "/account" : "/sign-in"}>
    {!error && session ? "My account" : "Sign in"}
  </Link>;
}
