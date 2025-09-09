// Simple Node.js proxy server for image generation API
const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3001;
const VOLCENGINE_API = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const API_KEY = '30046952-67e8-42d3-aa44-d0da565c3bfb';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': true
};

const server = http.createServer((req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  // Only handle POST requests to /generate-image
  if (req.method !== 'POST' || req.url !== '/generate-image') {
    res.writeHead(404, corsHeaders);
    res.end('Not Found');
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      const requestData = JSON.parse(body);
      
      // Prepare request to Volcengine API
      const postData = JSON.stringify({
        model: 'doubao-seedream-4-0-250828',
        prompt: requestData.prompt,
        ...(requestData.image && { image: requestData.image }),
        sequential_image_generation: 'auto',
        sequential_image_generation_options: {
          max_images: requestData.maxImages || 3
        },
        response_format: 'url',
        size: requestData.size || '2K',
        stream: true,
        watermark: requestData.watermark !== false
      });

      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      // Forward request to Volcengine API
      const proxyReq = https.request(VOLCENGINE_API, options, (proxyRes) => {
        // Set CORS headers and forward response headers
        res.writeHead(proxyRes.statusCode, {
          ...corsHeaders,
          'Content-Type': proxyRes.headers['content-type'] || 'text/plain',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });

        // Stream the response back to client
        proxyRes.on('data', chunk => {
          res.write(chunk);
        });

        proxyRes.on('end', () => {
          res.end();
        });
      });

      proxyReq.on('error', (error) => {
        console.error('Proxy request error:', error);
        res.writeHead(500, corsHeaders);
        res.end(JSON.stringify({ error: 'Proxy request failed' }));
      });

      proxyReq.write(postData);
      proxyReq.end();

    } catch (error) {
      console.error('Request parsing error:', error);
      res.writeHead(400, corsHeaders);
      res.end(JSON.stringify({ error: 'Invalid request body' }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Image generation proxy server running on http://localhost:${PORT}`);
  console.log(`📡 Proxying requests to: ${VOLCENGINE_API}`);
});