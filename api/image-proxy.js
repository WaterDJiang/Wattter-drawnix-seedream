// Vercel serverless function for image proxy
const https = require('https');

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': true
};

// Main Vercel function handler for image proxy
module.exports = (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200);
    Object.keys(corsHeaders).forEach(key => {
      res.setHeader(key, corsHeaders[key]);
    });
    res.end();
    return;
  }

  // Only handle GET requests
  if (req.method !== 'GET') {
    res.status(405);
    Object.keys(corsHeaders).forEach(key => {
      res.setHeader(key, corsHeaders[key]);
    });
    res.json({ error: 'Method not allowed' });
    return;
  }

  // Get image URL from query parameters
  const imageUrl = req.query.url;
  
  if (!imageUrl) {
    res.status(400);
    Object.keys(corsHeaders).forEach(key => {
      res.setHeader(key, corsHeaders[key]);
    });
    res.json({ error: 'Missing url parameter' });
    return;
  }

  console.log('🖼️ 代理图片请求:', imageUrl);

  // Proxy the image
  const imageReq = https.request(imageUrl, (imageRes) => {
    console.log('🖼️ 图片响应状态:', imageRes.statusCode);
    console.log('🖼️ 图片响应头:', imageRes.headers);

    res.status(imageRes.statusCode);
    Object.keys(corsHeaders).forEach(key => {
      res.setHeader(key, corsHeaders[key]);
    });
    res.setHeader('Content-Type', imageRes.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    imageRes.pipe(res);
  });

  imageReq.on('error', (error) => {
    console.error('🔥 图片代理错误:', error);
    res.status(500);
    Object.keys(corsHeaders).forEach(key => {
      res.setHeader(key, corsHeaders[key]);
    });
    res.json({ error: 'Failed to fetch image' });
  });

  imageReq.end();
};
