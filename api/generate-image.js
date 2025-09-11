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
  try {
    console.log('🚀 [API] 收到图片生成请求');
    console.log('🚀 [API] 请求方法:', req.method);
    console.log('🚀 [API] 请求头:', JSON.stringify(req.headers, null, 2));

    // Vercel automatically parses JSON body
    const requestData = req.body || {};
    console.log('🚀 [API] 请求体:', JSON.stringify(requestData, null, 2));

    // 检查客户端是否提供了API密钥
    const apiKey = requestData.apiKey;
    console.log('🚀 [API] API密钥检查:', apiKey ? '已提供' : '未提供');

    if (!apiKey) {
      console.error('🚨 [API] API密钥未提供');
      res.status(400);
      Object.keys(corsHeaders).forEach(key => {
        res.setHeader(key, corsHeaders[key]);
      });
      res.json({ error: 'API密钥未提供，请在设置中配置API密钥' });
      return;
    }

      // Prepare request to Volcengine API
      const maxImages = requestData.maxImages || 20; // 默认最大20张，让AI自由决定生成数量

      // 豆包API的size参数处理
      let apiSize = requestData.size || '2K';

      // 如果是"2K"或"auto"，直接使用
      if (requestData.size === '2K' || requestData.size === 'auto') {
        apiSize = '2K';
      } else if (typeof requestData.size === 'string' && requestData.size.includes('x')) {
        // 尝试支持常见的像素格式，如果不支持再回退到2K
        const [width, height] = requestData.size.split('x').map(Number);
        if (width && height) {
          // 支持一些常见的尺寸组合
          const commonSizes = [
            '1024x1024', '1536x1024', '1024x1536',  // 1K系列
            '2048x2048', '1536x2048', '2048x1536',  // 2K系列
            '1792x1024', '1024x1792',               // 16:9比例
            '1344x768', '768x1344'                  // 其他比例
          ];

          if (commonSizes.includes(requestData.size)) {
            apiSize = requestData.size;
          } else {
            // 如果不在支持列表中，映射到最接近的标准尺寸
            if (width <= 1024 && height <= 1024) {
              apiSize = '1024x1024';
            } else if (width <= 1536 && height <= 2048) {
              // 保持原始尺寸，让API尝试处理
              apiSize = requestData.size;
            } else {
              apiSize = '2K';
            }
          }
        } else {
          apiSize = '2K';
        }
      }

      console.log('🎨 [API] 原始size:', requestData.size, '处理后size:', apiSize);

      const volcengineRequestData = {
        model: requestData.model || 'doubao-seedream-4-0-250828',
        prompt: requestData.prompt,
        response_format: 'url',
        size: apiSize,
        stream: true,
        watermark: requestData.watermark !== false
      };

      console.log('🎨 [API] 基础请求数据构建完成:', JSON.stringify(volcengineRequestData, null, 2));

      // 处理图片参数（支持单图和多图）
      if (requestData.image) {
        volcengineRequestData.image = requestData.image;
        console.log('🎨 [API] 处理图生图请求，图片数量:', Array.isArray(requestData.image) ? requestData.image.length : 1);
        if (Array.isArray(requestData.image)) {
          console.log('🎨 [API] 图片顺序:', requestData.image.map((url, index) => ({ index, url: url.substring(0, 50) + '...' })));
        }
      }

      // 根据生成图片数量决定是否启用序列生成
      console.log('🎨 [API] maxImages:', maxImages, '是否启用序列生成:', maxImages > 1);
      if (maxImages > 1) {
        volcengineRequestData.sequential_image_generation = 'auto';
        volcengineRequestData.sequential_image_generation_options = {
          max_images: maxImages
        };
        console.log('🎨 [API] 启用序列生成，最大图片数:', maxImages);
      } else {
        volcengineRequestData.sequential_image_generation = 'disabled';
        console.log('🎨 [API] 禁用序列生成');
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
      res.status(500);
      Object.keys(corsHeaders).forEach(key => {
        res.setHeader(key, corsHeaders[key]);
      });
      res.json({
        error: 'Proxy request failed',
        details: error.message,
        code: error.code
      });
    });

    // 设置超时处理
    proxyReq.setTimeout(25000, () => {
      console.error('🚨 请求超时');
      proxyReq.destroy();
      if (!res.headersSent) {
        res.status(500);
        Object.keys(corsHeaders).forEach(key => {
          res.setHeader(key, corsHeaders[key]);
        });
        res.json({ error: 'Request timeout' });
      }
    });

    proxyReq.write(postData);
    proxyReq.end();

  } catch (error) {
    console.error('🚨 [API] 请求处理错误:', error);
    console.error('🚨 [API] 错误堆栈:', error.stack);
    res.status(500);
    Object.keys(corsHeaders).forEach(key => {
      res.setHeader(key, corsHeaders[key]);
    });
    res.json({ error: 'Internal server error', details: error.message });
  }
};

// Vercel function - no server setup needed