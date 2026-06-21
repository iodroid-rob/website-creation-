/**
 * Cloudflare Pages Function: Fetch Leads List (Session-Secured)
 * Path: /functions/api/leads.js
 */
export async function onRequestGet(context) {
  try {
    // 1. Verify Secure Session Cookie
    const cookieHeader = context.request.headers.get("Cookie") || "";
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((c) => {
        const parts = c.trim().split("=");
        return [parts[0], parts.slice(1).join("=")];
      }),
    );
    const sessionCookie = cookies["session"];

    // Compute expected cryptographic token for verification
    const secret =
      context.env.SESSION_SECRET || "NEXUS_AGENCY_SECRET_KEY_2026_PRIYAM";
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const expectedRaw = `${secret}-${today}-06112006`; // Matched with expected username

    const encoder = new TextEncoder();
    const data = encoder.encode(expectedRaw);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const expectedToken = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // If cookie is missing or does not match the server-side generated token, block access
    if (!sessionCookie || sessionCookie !== expectedToken) {
      return new Response(
        JSON.stringify({
          error: "UNAUTHORIZED: VALID SESSION REQUIRED. ACCESS DENIED.",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // 2. Safety check: Ensure the Cloudflare D1 database binding exists
    if (!context.env.DB) {
      return new Response(
        JSON.stringify({
          error:
            "D1 database binding 'DB' is missing. Please bind your database in Cloudflare.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // 3. Query leads from Cloudflare D1 SQL database sorted by newest
    const { results } = await context.env.DB.prepare(
      "SELECT * FROM leads ORDER BY timestamp DESC",
    ).all();

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}

// Handle CORS Preflight OPTIONS requests
export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
