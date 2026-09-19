// The browser uses the website's origin; only the server connects to the API.
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const headers = { "Cache-Control": "no-store" };
  if (!code.trim() || code.length > 80) return Response.json({ error: "Invalid course code." }, { status: 400, headers });
  const apiURL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
  try {
    const response = await fetch(`${apiURL}/courses/${encodeURIComponent(code)}/offerings`, {
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(10000)]),
    });
    if (!response.ok) return Response.json({ error: "Course comparison is temporarily unavailable." }, { status: 502, headers });
    const result = await response.json();
    if (!Array.isArray(result.data)) throw new Error("Invalid course response");
    return Response.json({ data: result.data }, { headers });
  } catch {
    return Response.json({ error: "Course comparison is temporarily unavailable. Please try again." }, { status: 503, headers });
  }
}
