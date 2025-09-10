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

  try {
    // Parse the URL properly
    const url = new URL(imageUrl);

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Drawnix-Proxy/1.0)'
      }
    };

    console.log('🖼️ 请求选项:', options);

    // Proxy the image
    const imageReq = https.request(options, (imageRes) => {
      console.log('🖼️ 图片响应状态:', imageRes.statusCode);
      console.log('🖼️ 图片响应头:', imageRes.headers);

      // Handle redirects
      if (imageRes.statusCode >= 300 && imageRes.statusCode < 400 && imageRes.headers.location) {
        console.log('🔄 重定向到:', imageRes.headers.location);
        // For simplicity, just return the redirect URL
        res.status(302);
        Object.keys(corsHeaders).forEach(key => {
          res.setHeader(key, corsHeaders[key]);
        });
        res.setHeader('Location', imageRes.headers.location);
        res.end();
        return;
      }

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
      res.json({ error: 'Failed to fetch image', details: error.message });
    });

    imageReq.setTimeout(30000, () => {
      console.error('🔥 图片代理超时');
      imageReq.destroy();
      if (!res.headersSent) {
        res.status(500);
        Object.keys(corsHeaders).forEach(key => {
          res.setHeader(key, corsHeaders[key]);
        });
        res.json({ error: 'Request timeout' });
      }
    });

    imageReq.end();

  } catch (error) {
    console.error('🔥 URL解析错误:', error);
    res.status(400);
    Object.keys(corsHeaders).forEach(key => {
      res.setHeader(key, corsHeaders[key]);
    });
    res.json({ error: 'Invalid URL', details: error.message });
  }
};
