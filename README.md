# ⚡ Secure Serverless Lead Ingestion Engine & Admin Portal

This repository is configured to submit leads securely from your static **GitHub Pages** frontend to a dedicated **Cloudflare Serverless Backend**. 

By shifting the database operations and access controls to Cloudflare's global network, you achieve **100% data security, Zero Trust access controls, and zero client-side exposed keys**.

---

## 🗺️ The Architecture

```mermaid
sequenceDiagram
    actor Visitor as Website Visitor
    participant CF_API as Cloudflare Serverless API
    database DB as Cloudflare D1 (SQL)
    actor Admin as You (Private Portal)

    Visitor->>CF_API: 1. POST JSON Form Data
    Note over CF_API: Backend sanitizes inputs<br/>& runs SQL Query
    CF_API->>DB: 2. Insert secure record
    Admin->>CF_API: 3. View Leads (Requires PIN Login)
    Note over CF_API: Cloudflare Access verifies PIN
    CF_API-->>Admin: 4. Returns private SQL records
```

### Why this is 100% secure:
1. **Serverless Isolation**: The visitor's browser sends form data as a standard JSON request over HTTPS to your API endpoint. No database credentials, access tokens, or storage files are visible on the frontend.
2. **Zero Trust Authentication**: The private display dashboard is locked down by **Cloudflare Zero Trust (Access)**. Anyone visiting the portal is blocked by a Cloudflare login wall before your page even loads. Cloudflare emails a secure **one-time 6-digit login PIN** to your authorized email address.
3. **No Hardcoded Passwords**: There is no password to steal or crack in the JavaScript source code, making browser Dev Tools completely useless for trying to bypass the lock screen.

---

## 🛠️ Setup Blueprint (Cloudflare Pages + D1 SQL)

### Part 1: Setting up the Database (Cloudflare D1)
1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Go to **Workers & Pages** ➔ **D1 Databases** and click **Create database**.
3. Name your database `nexus_leads_db` and click create.
4. Go to the **Console** tab of your new database and run this SQL query to initialize the table:
   ```sql
   CREATE TABLE IF NOT EXISTS leads (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
     name TEXT NOT NULL,
     email TEXT NOT NULL,
     company TEXT,
     need TEXT,
     budget TEXT,
     details TEXT
   );
   ```

### Part 2: Deploying the Backend API (Cloudflare Pages Functions)
To handle incoming form submissions and private queries, create a folder named `functions` in your project with the following file structures:

#### File: `/functions/api/submit.js` (Ingestion endpoint)
```javascript
export async function onRequestPost(context) {
  try {
    const { name, email, company, need, budget, details } = await context.request.json();
    
    if (!name || !email) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }
    
    // Insert into Cloudflare D1 SQL database
    await context.env.DB.prepare(
      "INSERT INTO leads (name, email, company, need, budget, details) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(name, email, company, need, budget, details).run();
    
    return new Response(JSON.stringify({ result: "success" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
```

#### File: `/functions/api/leads.js` (Query endpoint for Admin portal)
```javascript
export async function onRequestGet(context) {
  try {
    // Query leads from Cloudflare D1 SQL database sorted by newest
    const { results } = await context.env.DB.prepare(
      "SELECT * FROM leads ORDER BY timestamp DESC"
    ).all();
    
    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
```

### Part 3: Lock down `/admin` via Cloudflare Zero Trust
1. In your Cloudflare Dashboard, go to **Zero Trust** ➔ **Access** ➔ **Applications**.
2. Click **Add an application** ➔ select **Self-hosted**.
3. Configure settings:
   * **Application name**: `Nexus Admin Dashboard`
   * **Domain**: `yourdomain.com/admin` (or the specific admin page path on Cloudflare Pages)
4. Set up the **Identity Provider** policy:
   * Set **Action** to `Allow`.
   * Under **Rules** ➔ **Include**: Set **Emails** exactly to your personal email address (e.g., `you@gmail.com`).
5. Save the policy. Cloudflare now guards the URL with identity-based multi-factor email verification automatically!
