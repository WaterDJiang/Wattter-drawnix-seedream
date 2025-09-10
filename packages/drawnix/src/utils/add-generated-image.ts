import { PlaitBoard, Point, PlaitElement, Transforms } from '@plait/core';
import { DrawTransforms, BasicShapes } from '@plait/draw';
import { loadHTMLImageElement, buildImage } from '../data/image';
import { ImageGenerationResult } from './image-generation';

export interface AddGeneratedImageOptions {
  position?: Point;
  maxWidth?: number;
  spacing?: number;
  aspectRatio?: string;
}

/**
 * 加载图片并获取尺寸信息
 */
export const loadImageInfo = async (url: string): Promise<{width: number, height: number}> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      resolve({ width: image.width, height: image.height });
    };
    image.onerror = () => {
      // 如果跨域失败，使用默认尺寸
      resolve({ width: 400, height: 300 });
    };
    // 使用代理URL来避免CORS问题
    const proxyUrl = `http://localhost:3001/image-proxy?url=${encodeURIComponent(url)}`;
    image.src = proxyUrl;
  });
};

/**
 * 计算基于宽高比的尺寸
 */
const calculateDimensionsFromAspectRatio = (aspectRatio: string, maxWidth: number): {width: number, height: number} => {
  if (aspectRatio === 'auto') {
    return { width: maxWidth, height: maxWidth * 0.75 }; // 默认4:3比例
  }
  
  const [widthRatio, heightRatio] = aspectRatio.split(':').map(Number);
  if (!widthRatio || !heightRatio) {
    return { width: maxWidth, height: maxWidth * 0.75 };
  }
  
  const ratio = heightRatio / widthRatio;
  return {
    width: maxWidth,
    height: maxWidth * ratio
  };
};

/**
 * 在画布上添加单张生成的图片
 */
export const addGeneratedImageToBoard = async (
  board: PlaitBoard,
  result: ImageGenerationResult,
  options: AddGeneratedImageOptions = {}
): Promise<void> => {
  const { position, maxWidth = 400 } = options;
  
  try {
    // 直接使用URL作为图片数据源
    const imageInfo = await loadImageInfo(result.url);
    
    // 计算缩放后的尺寸
    const width = imageInfo.width > maxWidth ? maxWidth : imageInfo.width;
    const height = (width / imageInfo.width) * imageInfo.height;
    
    // 构建图片数据 - 使用代理URL避免CORS问题
    const proxyUrl = `http://localhost:3001/image-proxy?url=${encodeURIComponent(result.url)}`;
    const imageItem = {
      url: proxyUrl,
      width,
      height,
    };
    
    // 插入到画布
    DrawTransforms.insertImage(board, imageItem, position);
    console.log('Successfully added image to board:', result.url);
  } catch (error) {
    console.error('Failed to add generated image to board:', error);
    throw error;
  }
};

/**
 * 创建图片占位符
 */
export const createImagePlaceholders = (
  board: PlaitBoard,
  count: number,
  options: AddGeneratedImageOptions = {}
): PlaitElement[] => {
  const { position = [400, 300], spacing = 320, maxWidth = 300, aspectRatio = '3:4' } = options;
  const placeholders: PlaitElement[] = [];
  
  // 计算基于宽高比的尺寸
  const dimensions = calculateDimensionsFromAspectRatio(aspectRatio, maxWidth);
  
  for (let i = 0; i < count; i++) {
    // 计算每张图片的位置（水平排列）
    const imagePosition: Point = [
      position[0] + i * (maxWidth + spacing),
      position[1]
    ];
    
    const endPosition: Point = [
      imagePosition[0] + dimensions.width,
      imagePosition[1] + dimensions.height
    ];
    
    // 使用DrawTransforms.insertGeometry创建占位符
    const placeholder = DrawTransforms.insertGeometry(
      board, 
      [imagePosition, endPosition], 
      BasicShapes.rectangle
    );
    
    if (placeholder) {
      // 直接将占位符添加到数组
      placeholders.push(placeholder);
      console.log('成功创建占位符:', placeholder);
    }
  }
  
  return placeholders;
};

/**
 * 为占位符添加颜色渐变动画（暂时禁用）
 */
const startPlaceholderAnimation = (board: PlaitBoard, element: PlaitElement) => {
  // 暂时禁用动画以确保基本功能正常工作
  console.log('占位符动画已禁用');
};

/**
 * 替换占位符为真实图片
 */
export const replacePlaceholderWithImage = async (
  board: PlaitBoard,
  placeholder: PlaitElement,
  result: ImageGenerationResult,
  options: AddGeneratedImageOptions = {}
): Promise<void> => {
  const { maxWidth = 300 } = options;
  
  try {
    // 获取占位符的位置 - 使用points属性获取几何元素的起始位置
    const position: Point = (placeholder as any).points ? (placeholder as any).points[0] : [400, 300];
    
    // 加载图片信息
    const imageInfo = await loadImageInfo(result.url);
    
    // 计算缩放后的尺寸
    const width = imageInfo.width > maxWidth ? maxWidth : imageInfo.width;
    const height = (width / imageInfo.width) * imageInfo.height;
    
    // 创建图片元素 - 使用代理URL避免CORS问题  
    const proxyUrl = `http://localhost:3001/image-proxy?url=${encodeURIComponent(result.url)}`;
    const imageItem = {
      url: proxyUrl,
      width,
      height,
    };
    
    // 清理动画定时器
    if ((placeholder as any)._animationTimer) {
      clearInterval((placeholder as any)._animationTimer);
    }
    
    // 删除占位符 - 使用 CoreTransforms
    const { CoreTransforms } = await import('@plait/core');
    CoreTransforms.removeElements(board, [placeholder]);
    
    // 添加真实图片
    DrawTransforms.insertImage(board, imageItem, position);
    
    console.log('Successfully replaced placeholder with image:', result.url);
  } catch (error) {
    console.error('Failed to replace placeholder with image:', error);
    throw error;
  }
};

/**
 * 在画布上添加多张生成的图片（带占位符）
 */
export const addGeneratedImagesToBoard = async (
  board: PlaitBoard,
  results: ImageGenerationResult[],
  options: AddGeneratedImageOptions = {}
): Promise<void> => {
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    
    // 计算每张图片的位置（水平排列）
    const imagePosition: Point = [
      (options.position?.[0] || 400) + i * ((options.maxWidth || 300) + (options.spacing || 320)),
      options.position?.[1] || 300
    ];
    
    try {
      await addGeneratedImageToBoard(board, result, {
        ...options,
        position: imagePosition
      });
    } catch (error) {
      console.error(`Failed to add image ${i}:`, error);
      // 继续添加其他图片
    }
  }
};