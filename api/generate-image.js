// Vercel serverless function for image generation API
const https = require('https');

const VOLCENGINE_API = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': true
};

// Main Vercel function handler
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

  // Handle POST requests for image generation
  if (req.method === 'POST') {
    handleImageGeneration(req, res);
    return;
  }

  // Handle GET requests for image proxy
  if (req.method === 'GET' && req.url.startsWith('/image-proxy')) {
    handleImageProxy(req, res);
    return;
  }

  res.status(404);
  Object.keys(corsHeaders).forEach(key => {
    res.setHeader(key, corsHeaders[key]);
  });
  res.json({ error: 'Not Found' });
}

const handleImageProxy = (req, res) => {
  const urlParam = new URLSearchParams(req.url.split('?')[1]);
  const imageUrl = urlParam.get('url');

  if (!imageUrl) {
    res.status(400);
    Object.keys(corsHeaders).forEach(key => {
      res.setHeader(key, corsHeaders[key]);
    });
    res.json({ error: 'Missing url parameter' });
    return;
  }

  // Proxy the image
  const imageReq = https.request(imageUrl, (imageRes) => {
    res.status(200);
    Object.keys(corsHeaders).forEach(key => {
      res.setHeader(key, corsHeaders[key]);
    });
    res.setHeader('Content-Type', imageRes.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    imageRes.pipe(res);
  });

  imageReq.on('error', (error) => {
    console.error('Image proxy error:', error);
    res.status(500);
    Object.keys(corsHeaders).forEach(key => {
      res.setHeader(key, corsHeaders[key]);
    });
    res.json({ error: 'Failed to fetch image' });
  });

  imageReq.end();
};

const handleImageGeneration = (req, res) => {
  try {
    // Vercel automatically parses JSON body
    const requestData = req.body || {};

    // 检查客户端是否提供了API密钥
    const apiKey = requestData.apiKey;
    if (!apiKey) {
      res.status(400);
      Object.keys(corsHeaders).forEach(key => {
        res.setHeader(key, corsHeaders[key]);
      });
      res.json({ error: 'API密钥未提供，请在设置中配置API密钥' });
      return;
    }

      // Prepare request to Volcengine API
      const maxImages = requestData.maxImages || 3;
      const volcengineRequestData = {
        model: requestData.model || 'doubao-seedream-4-0-250828',
        prompt: requestData.prompt,
        response_format: 'url',
        size: requestData.size || '2K',
        stream: true,
        watermark: requestData.watermark !== false
      };

      // 处理图片参数（支持单图和多图）
      if (requestData.image) {
        volcengineRequestData.image = requestData.image;
        console.log('🎨 API代理：处理图生图请求，图片数量:', Array.isArray(requestData.image) ? requestData.image.length : 1);
        if (Array.isArray(requestData.image)) {
          console.log('🎨 API代理：图片顺序:', requestData.image.map((url, index) => ({ index, url: url.substring(0, 50) + '...' })));
        }
      }

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
      res.status(proxyRes.statusCode);
      Object.keys(corsHeaders).forEach(key => {
        res.setHeader(key, corsHeaders[key]);
      });
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'text/plain');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

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
      res.status(500);
      Object.keys(corsHeaders).forEach(key => {
        res.setHeader(key, corsHeaders[key]);
      });
      res.json({ error: 'Proxy request failed' });
    });

    proxyReq.write(postData);
    proxyReq.end();

  } catch (error) {
    console.error('Request parsing error:', error);
    res.status(400);
    Object.keys(corsHeaders).forEach(key => {
      res.setHeader(key, corsHeaders[key]);
    });
    res.json({ error: 'Invalid request body' });
  }
};

// Vercel function - no server setup needed