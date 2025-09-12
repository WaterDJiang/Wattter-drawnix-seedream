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



  res.status(404);
  Object.keys(corsHeaders).forEach(key => {
    res.setHeader(key, corsHeaders[key]);
  });
  res.json({ error: 'Not Found' });
}



const handleImageGeneration = (req, res) => {
  let responseHandled = false; // 添加响应状态跟踪
  
  const sendResponse = (statusCode, data) => {
    if (responseHandled) {
      console.warn('⚠️ 尝试重复发送响应，已忽略');
      return;
    }
    responseHandled = true;
    
    if (!res.headersSent) {
      res.status(statusCode);
      Object.keys(corsHeaders).forEach(key => {
        res.setHeader(key, corsHeaders[key]);
      });
      if (typeof data === 'object') {
        res.json(data);
      } else {
        res.end(data);
      }
    }
  };
  
  try {
    // Vercel automatically parses JSON body
    const requestData = req.body || {};

    // 检查客户端是否提供了API密钥
    const apiKey = requestData.apiKey;
    if (!apiKey) {
      sendResponse(400, { error: 'API密钥未提供，请在设置中配置API密钥' });
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
    console.log('🚀 发送请求到豆包API:', VOLCENGINE_API);
    console.log('🚀 请求数据:', JSON.stringify(volcengineRequestData, null, 2));

    const proxyReq = https.request(VOLCENGINE_API, options, (proxyRes) => {
      console.log('🚀 豆包API响应状态:', proxyRes.statusCode);
      console.log('🚀 豆包API响应头:', proxyRes.headers);

      // Set CORS headers and forward response headers
      res.status(proxyRes.statusCode);
      Object.keys(corsHeaders).forEach(key => {
        res.setHeader(key, corsHeaders[key]);
      });
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'text/plain');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // 如果状态码不是200，收集错误信息
      if (proxyRes.statusCode !== 200) {
        let errorData = '';
        proxyRes.on('data', chunk => {
          errorData += chunk.toString();
        });
        proxyRes.on('end', () => {
          console.error('🚨 豆包API错误响应:', errorData);
          res.write(errorData);
          res.end();
        });
        return;
      }

      // Stream the response back to client
      proxyRes.on('data', chunk => {
        res.write(chunk);
      });

      proxyRes.on('end', () => {
        console.log('🚀 豆包API响应完成');
        res.end();
      });
    });

    proxyReq.on('error', (error) => {
      console.error('🚨 代理请求错误:', error);
      console.error('🚨 错误详情:', error.message, error.code, error.stack);
      sendResponse(500, {
        error: 'Proxy request failed',
        details: error.message,
        code: error.code
      });
    });

    // 设置超时处理
    proxyReq.setTimeout(25000, () => {
      console.error('🚨 请求超时');
      proxyReq.destroy();
      sendResponse(500, { error: 'Request timeout' });
    });

    proxyReq.write(postData);
    proxyReq.end();

  } catch (error) {
    console.error('🚨 处理请求时发生错误:', error);
    sendResponse(500, { error: 'Internal server error', details: error.message });
  }
};

// Vercel function - no server setup needed