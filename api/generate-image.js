// Simple Node.js proxy server for image generation API
const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3001;
const VOLCENGINE_API = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
// API密钥从客户端请求中获取，不再硬编码

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': true
};

const handleRequest = (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  // Handle POST requests to /generate-image
  if (req.method === 'POST' && req.url === '/generate-image') {
    handleImageGeneration(req, res);
    return;
  }

  // Handle GET requests for image proxy
  if (req.method === 'GET' && req.url.startsWith('/image-proxy')) {
    handleImageProxy(req, res);
    return;
  }

  res.writeHead(404, corsHeaders);
  res.end('Not Found');
}

const handleImageProxy = (req, res) => {
  const urlParam = new URLSearchParams(req.url.split('?')[1]);
  const imageUrl = urlParam.get('url');
  
  if (!imageUrl) {
    res.writeHead(400, corsHeaders);
    res.end('Missing url parameter');
    return;
  }

  // Proxy the image
  const imageReq = https.request(imageUrl, (imageRes) => {
    res.writeHead(200, {
      ...corsHeaders,
      'Content-Type': imageRes.headers['content-type'] || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400'
    });
    imageRes.pipe(res);
  });

  imageReq.on('error', (error) => {
    console.error('Image proxy error:', error);
    res.writeHead(500, corsHeaders);
    res.end('Failed to fetch image');
  });

  imageReq.end();
};

const handleImageGeneration = (req, res) => {

  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      const requestData = JSON.parse(body);
      
      // 检查客户端是否提供了API密钥
      const apiKey = requestData.apiKey;
      if (!apiKey) {
        res.writeHead(400, corsHeaders);
        res.end(JSON.stringify({ error: 'API密钥未提供，请在设置中配置API密钥' }));
        return;
      }

      // Prepare request to Volcengine API
      const maxImages = requestData.maxImages || 3;
      const volcengineRequestData = {
        model: requestData.model || 'doubao-seedream-4-0-250828',
        prompt: requestData.prompt,
        ...(requestData.image && { image: requestData.image }),
        response_format: 'url',
        size: requestData.size || '2K',
        stream: true,
        watermark: requestData.watermark !== false
      };

      // 根据生成图片数量决定是否启用序列生成
      if (maxImages > 1) {
        volcengineRequestData.sequential_image_generation = 'auto';
        volcengineRequestData.sequential_image_generation_options = {
          max_images: maxImages
        };
      } else {
        volcengineRequestData.sequential_image_generation = 'disabled';
      }

      const postData = JSON.stringify(volcengineRequestData);

      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
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
};

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`🚀 Image generation proxy server running on http://localhost:${PORT}`);
  console.log(`📡 Proxying requests to: ${VOLCENGINE_API}`);
});