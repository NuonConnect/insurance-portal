// Netlify Function for storing plan edits (plan name, network, copay)
// Uses Netlify Blobs for storage

const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const store = getStore('plan-edits');

    if (event.httpMethod === 'GET') {
      // Get all plan edits
      const { blobs } = await store.list();
      const edits = {};
      
      for (const blob of blobs) {
        const data = await store.get(blob.key, { type: 'json' });
        if (data) {
          edits[blob.key] = data;
        }
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, edits })
      };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);
      const { planId, edits } = body;
      
      if (!planId || !edits) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'Missing planId or edits' })
        };
      }
      
      // Add timestamp
      const dataToStore = {
        ...edits,
        _updatedAt: new Date().toISOString()
      };
      
      await store.setJSON(planId, dataToStore);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, planId })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Plan edits API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};