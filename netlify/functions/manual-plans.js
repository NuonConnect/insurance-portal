// netlify/functions/manual-plans.js
import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const store = getStore("insurance-data");
  const KEY = "manual-plans";

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0"
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  try {
    if (req.method === "GET") {
      const plans = await store.get(KEY, { type: "json" }) || {};
      return new Response(JSON.stringify({ success: true, plans }), { status: 200, headers });
    }

    if (req.method === "POST") {
      const { plans } = await req.json();
      await store.setJSON(KEY, plans || {});
      return new Response(JSON.stringify({ success: true }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers });
  }
};

export const config = { path: "/api/manual-plans" };