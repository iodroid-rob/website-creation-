/**
 * Cloudflare Pages Function: Fetch Leads List
 * Path: /functions/api/leads.js
 */
export async function onRequestGet(context) {
  try {
    // Safety check: Ensure the Cloudflare D1 database binding exists
    if (!context.env.DB) {
      return new Response(JSON.stringify({ error: "D1 database binding 'DB' is missing. Please bind your database in Cloudflare." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Query leads from Cloudflare D1 SQL database sorted by newest
    const { results } = await context.env.DB.prepare(
      "SELECT * FROM leads ORDER BY timestamp DESC"
    ).all();

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
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
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
