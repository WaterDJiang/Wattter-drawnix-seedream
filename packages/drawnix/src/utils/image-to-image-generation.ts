import { PlaitElement } from '@plait/core';
import { PlaitDrawElement } from '@plait/draw';

export interface ImageToImageRequest {
  prompt: string;
  images: string[]; // 图片URL数组
  size?: string;
  watermark?: boolean;
  apiKey: string;
}

export interface ImageToImageResponse {
  index: number;
  url: string;
  size: string;
}

/**
 * 获取图片元素的URL
 */
export function getImageUrl(imageElement: PlaitElement): string | null {
  console.log('🔍 检查图片元素:', imageElement);
  console.log('🔍 元素类型:', (imageElement as any).type);
  console.log('🔍 是否为图片:', PlaitDrawElement.isImage(imageElement));

  // 更宽松的检查：直接检查是否有imageItem
  const imageItem = (imageElement as any).imageItem;
  console.log('🔍 imageItem:', imageItem);

  if (imageItem?.url) {
    console.log('🔍 找到图片URL:', imageItem.url);
    return imageItem.url;
  }

  // 备用检查：直接检查url属性
  const directUrl = (imageElement as any).url;
  if (directUrl) {
    console.log('🔍 找到直接URL:', directUrl);
    return directUrl;
  }

  console.log('🔍 未找到图片URL');
  return null;
}

/**
 * 获取图片元素的尺寸
 */
export function getImageSize(imageElement: PlaitElement): { width: number; height: number } | null {
  if (!PlaitDrawElement.isImage(imageElement)) {
    return null;
  }
  
  const imageItem = (imageElement as any).imageItem;
  return {
    width: imageItem?.width || 300,
    height: imageItem?.height || 300
  };
}

/**
 * 计算图片的宽高比
 */
export function getImageAspectRatio(imageElement: PlaitElement): string {
  const size = getImageSize(imageElement);
  if (!size) return '1:1';
  
  const { width, height } = size;
  const ratio = width / height;
  
  // 常见比例判断
  if (Math.abs(ratio - 1) < 0.1) return '1:1';
  if (Math.abs(ratio - 3/4) < 0.1) return '3:4';
  if (Math.abs(ratio - 4/3) < 0.1) return '4:3';
  if (Math.abs(ratio - 16/9) < 0.1) return '16:9';
  if (Math.abs(ratio - 9/16) < 0.1) return '9:16';
  
  // 默认返回计算的比例
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

/**
 * 根据宽高比计算像素尺寸
 */
export function calculateSizeFromAspectRatio(
  aspectRatio: string,
  referenceSize?: { width: number; height: number }
): { width: number; height: number } {
  const [widthRatio, heightRatio] = aspectRatio.split(':').map(Number);
  
  if (referenceSize) {
    // 基于参考尺寸计算
    const referenceRatio = referenceSize.width / referenceSize.height;
    const targetRatio = widthRatio / heightRatio;
    
    if (Math.abs(referenceRatio - targetRatio) < 0.1) {
      // 比例相近，直接使用参考尺寸
      return referenceSize;
    }
    
    // 保持参考图片的面积，调整比例
    const area = referenceSize.width * referenceSize.height;
    const width = Math.sqrt(area * targetRatio);
    const height = width / targetRatio;
    
    return {
      width: Math.round(width),
      height: Math.round(height)
    };
  }
  
  // 默认尺寸计算
  const baseSize = 512;
  const ratio = widthRatio / heightRatio;
  
  if (ratio > 1) {
    // 横向
    return {
      width: Math.round(baseSize * ratio),
      height: baseSize
    };
  } else {
    // 纵向或正方形
    return {
      width: baseSize,
      height: Math.round(baseSize / ratio)
    };
  }
}

/**
 * 转换尺寸为API格式
 */
export function formatSizeForAPI(size: { width: number; height: number }): string {
  return `${size.width}x${size.height}`;
}

/**
 * 调用图生图API
 */
export async function generateImageToImage(
  request: ImageToImageRequest,
  onProgress?: (response: ImageToImageResponse) => void
): Promise<ImageToImageResponse[]> {
  const apiEndpoint = 'http://localhost:3001/generate-image';

  // 根据豆包Seedream API文档格式化请求
  const requestBody = {
    model: "doubao-seedream-4-0-250828",
    prompt: request.prompt,
    image: request.images, // 豆包API支持多图输入
    size: request.size || "2K",
    response_format: "url",
    watermark: false,
    stream: true,
    apiKey: request.apiKey
  };

  console.log('🎨 发送图生图请求:', requestBody);

  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`图生图API请求失败: ${response.status} ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('无法读取响应流');
  }

  const results: ImageToImageResponse[] = [];
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            console.log('🎨 图生图生成完成');
            return results;
          }

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'image_generation.partial_succeeded') {
              const result: ImageToImageResponse = {
                index: parsed.image_index || 0,
                url: parsed.url,
                size: parsed.size || '1024x1024'
              };
              
              console.log('🎨 收到图生图结果:', result);
              results.push(result);
              
              if (onProgress) {
                onProgress(result);
              }
            }
          } catch (e) {
            console.warn('解析图生图响应失败:', e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return results;
}
