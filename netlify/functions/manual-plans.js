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

  const store = getStore("im-manual-plans");

  try {
    // GET - Retrieve all manual plans
    if (event.httpMethod === 'GET') {
      const { blobs } = await store.list();
      const plans = {};
      
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
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, plans })
      };
    }

    // POST - Save manual plans for a provider
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { providerKey, plans } = body;
      
      if (!providerKey || !plans) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Missing providerKey or plans' })
        };
      }

      // Add timestamp for tracking
      const dataToStore = plans.map((plan) => ({
        ...plan,
        _updatedAt: new Date().toISOString()
      }));

      await store.setJSON(providerKey, dataToStore);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, providerKey })
      };
    }

    // DELETE - Remove manual plans for a provider
    if (event.httpMethod === 'DELETE') {
      const body = JSON.parse(event.body || '{}');
      const { providerKey } = body;
      
      if (!providerKey) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Missing providerKey' })
        };
      }

      await store.delete(providerKey);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, deleted: providerKey })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  } catch (error) {
    console.error('Manual Plans API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: String(error) })
    };
  }
};