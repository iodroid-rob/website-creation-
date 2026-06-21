/**
 * Cloudflare Pages Function: Secure Administrator Login Auth Handler
 * Path: /functions/api/login.js
 */
export async function onRequestPost(context) {
  try {
    const { username, password } = await context.request.json();

    // Get client IP address provided by Cloudflare's global edge network
    const ip = context.request.headers.get("CF-Connecting-IP") || "127.0.0.1";

    // Safety check: Ensure the Cloudflare D1 database binding exists
    if (!context.env.DB) {
      return new Response(JSON.stringify({ error: "D1 database binding 'DB' is missing. Please bind your database in Cloudflare." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 1. Check if the IP is currently locked out (3 failed attempts in the last 24 hours)
    const lockoutCheck = await context.env.DB.prepare(
      "SELECT COUNT(*) as count FROM login_attempts WHERE ip = ? AND timestamp > datetime('now', '-1 day')"
    ).bind(ip).first();

    const attempts = lockoutCheck ? lockoutCheck.count : 0;

    if (attempts >= 3) {
      return new Response(JSON.stringify({
        error: "ACCESS DENIED: YOUR IP IS LOCKED OUT FOR 24 HOURS DUE TO 3 FAILED LOGIN ATTEMPTS."
      }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. Validate Credentials (Runs completely on the secure serverless backend)
    const EXPECTED_USER = "06112006";
    const EXPECTED_PASS = "priyam06@";

    if (username !== EXPECTED_USER || password !== EXPECTED_PASS) {
      // Log the failed login attempt in the database
      await context.env.DB.prepare(
        "INSERT INTO login_attempts (ip) VALUES (?)"
      ).bind(ip).run();

      const remaining = 3 - (attempts + 1);
      const errorMsg = remaining > 0
        ? `INVALID CREDENTIALS. ${remaining} ATTEMPTS REMAINING BEFORE LOCKOUT.`
        : "INVALID CREDENTIALS. YOUR IP HAS BEEN LOCKED OUT FOR 24 HOURS.";

      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. Success: Reset failed attempts for this IP
    await context.env.DB.prepare(
      "DELETE FROM login_attempts WHERE ip = ?"
    ).bind(ip).run();

    // 4. Generate Secure Session Token using standard Web Crypto API
    // We sign the token using a server-side secret + today's date so it automatically expires daily
    const secret = context.env.SESSION_SECRET || "NEXUS_AGENCY_SECRET_KEY_2026_PRIYAM";
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const rawToken = `${secret}-${today}-${username}`;

    const encoder = new TextEncoder();
    const data = encoder.encode(rawToken);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const token = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    // 5. Set session token as a highly secure HttpOnly, Secure, SameSite=Strict Cookie
    // HttpOnly makes it completely invisible to browser JavaScript and Dev Tools!
    const cookieHeader = `session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`;

    return new Response(JSON.stringify({ result: "success" }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": cookieHeader
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
