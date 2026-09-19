import { getAuth } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/auth-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  if (!isAuthConfigured()) {
    return Response.json({ code: "AUTH_UNAVAILABLE", message: "Sign-in is currently unavailable." }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
  try {
    const response = await getAuth().handler(request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    console.error("Authentication request failed");
    return Response.json({ code: "AUTH_UNAVAILABLE", message: "Sign-in is temporarily unavailable. Please try again." }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}

export const GET = handle;
export const POST = handle;
