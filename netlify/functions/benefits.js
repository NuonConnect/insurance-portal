const { getStore } = require("@netlify/blobs");

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

exports.handler = async function (event, context) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const store = getStore("im-benefits");

  try {
    // GET - Retrieve all benefits
    if (event.httpMethod === 'GET') {
      const { blobs } = await store.list();
      const benefits = {};
      
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
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, benefits })
      };
    }

    // POST - Save benefits for a plan
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { planKey, benefits } = body;
      
      if (!planKey || !benefits) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Missing planKey or benefits' })
        };
      }

      // Add timestamp for tracking
      const dataToStore = {
        ...benefits,
        _updatedAt: new Date().toISOString()
      };

      await store.setJSON(planKey, dataToStore);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, planKey })
      };
    }

    // DELETE - Remove benefits for a plan
    if (event.httpMethod === 'DELETE') {
      const body = JSON.parse(event.body || '{}');
      const { planKey } = body;
      
      if (!planKey) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Missing planKey' })
        };
      }

      await store.delete(planKey);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, deleted: planKey })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  } catch (error) {
    console.error('Benefits API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: String(error) })
    };
  }
};