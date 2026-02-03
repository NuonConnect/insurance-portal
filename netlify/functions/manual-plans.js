import { getStore } from "@netlify/blobs";
import type { Context } from "@netlify/functions";

// CORS and Cache headers - NO CACHING to ensure fresh data
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0'
};

export default async (req: Request, context: Context) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const store = getStore("im-manual-plans");

  try {
    // GET - Retrieve all manual plans
    if (req.method === 'GET') {
      const { blobs } = await store.list();
      const plans: { [key: string]: any[] } = {};
      
      for (const blob of blobs) {
        try {
          const data = await store.get(blob.key, { type: 'json' });
          if (data) {
            plans[blob.key] = Array.isArray(data) ? data : [data];
          }
        } catch (e) {
          console.error(`Error reading blob ${blob.key}:`, e);
        }
      }
      
      return new Response(JSON.stringify({ success: true, plans }), { 
        status: 200, 
        headers 
      });
    }

    // POST - Save manual plans for a provider
    if (req.method === 'POST') {
      const body = await req.json();
      const { providerKey, plans } = body;
      
      if (!providerKey || !plans) {
        return new Response(JSON.stringify({ success: false, error: 'Missing providerKey or plans' }), { 
          status: 400, 
          headers 
        });
      }

      // Add timestamp for tracking
      const dataToStore = plans.map((plan: any) => ({
        ...plan,
        _updatedAt: new Date().toISOString()
      }));

      await store.setJSON(providerKey, dataToStore);
      
      return new Response(JSON.stringify({ success: true, providerKey }), { 
        status: 200, 
        headers 
      });
    }

    // DELETE - Remove manual plans for a provider
    if (req.method === 'DELETE') {
      const body = await req.json();
      const { providerKey } = body;
      
      if (!providerKey) {
        return new Response(JSON.stringify({ success: false, error: 'Missing providerKey' }), { 
          status: 400, 
          headers 
        });
      }

      await store.delete(providerKey);
      
      return new Response(JSON.stringify({ success: true, deleted: providerKey }), { 
        status: 200, 
        headers 
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), { 
      status: 405, 
      headers 
    });
  } catch (error) {
    console.error('Manual Plans API error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), { 
      status: 500, 
      headers 
    });
  }
};