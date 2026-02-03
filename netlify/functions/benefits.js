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

  const store = getStore("im-benefits");

  try {
    // GET - Retrieve all benefits
    if (req.method === 'GET') {
      const { blobs } = await store.list();
      const benefits: { [key: string]: any } = {};
      
      for (const blob of blobs) {
        try {
          const data = await store.get(blob.key, { type: 'json' });
          if (data) {
            benefits[blob.key] = data;
          }
        } catch (e) {
          console.error(`Error reading blob ${blob.key}:`, e);
        }
      }
      
      return new Response(JSON.stringify({ success: true, benefits }), { 
        status: 200, 
        headers 
      });
    }

    // POST - Save benefits for a plan
    if (req.method === 'POST') {
      const body = await req.json();
      const { planKey, benefits } = body;
      
      if (!planKey || !benefits) {
        return new Response(JSON.stringify({ success: false, error: 'Missing planKey or benefits' }), { 
          status: 400, 
          headers 
        });
      }

      // Add timestamp for tracking
      const dataToStore = {
        ...benefits,
        _updatedAt: new Date().toISOString()
      };

      await store.setJSON(planKey, dataToStore);
      
      return new Response(JSON.stringify({ success: true, planKey }), { 
        status: 200, 
        headers 
      });
    }

    // DELETE - Remove benefits for a plan
    if (req.method === 'DELETE') {
      const body = await req.json();
      const { planKey } = body;
      
      if (!planKey) {
        return new Response(JSON.stringify({ success: false, error: 'Missing planKey' }), { 
          status: 400, 
          headers 
        });
      }

      await store.delete(planKey);
      
      return new Response(JSON.stringify({ success: true, deleted: planKey }), { 
        status: 200, 
        headers 
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), { 
      status: 405, 
      headers 
    });
  } catch (error) {
    console.error('Benefits API error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), { 
      status: 500, 
      headers 
    });
  }
};