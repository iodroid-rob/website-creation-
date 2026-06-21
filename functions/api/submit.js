/**
 * Cloudflare Pages Function: Ingest Form Submission
 * Path: /functions/api/submit.js
 */
export async function onRequestPost(context) {
  try {
    const { name, email, company, need, budget, details } = await context.request.json();

    // Basic server-side verification
    if (!name || !email) {
      return new Response(JSON.stringify({ error: "Name and Email are required fields." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Safety check: Ensure the Cloudflare D1 database binding exists
    if (!context.env.DB) {
      return new Response(JSON.stringify({ error: "D1 database binding 'DB' is missing. Please bind your database in Cloudflare." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Securely bind parameters to prevent SQL Injection
    await context.env.DB.prepare(
      "INSERT INTO leads (name, email, company, need, budget, details) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(
      name.trim(),
      email.trim(),
      (company || "").trim(),
      (need || "").trim(),
      (budget || "").trim(),
      (details || "").trim()
    ).run();

    return new Response(JSON.stringify({ result: "success" }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
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
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
