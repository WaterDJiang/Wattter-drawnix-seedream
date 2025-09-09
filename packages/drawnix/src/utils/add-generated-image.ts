import { PlaitBoard, Point, PlaitElement } from '@plait/core';
import { DrawTransforms, DrawElement } from '@plait/draw';
import { loadHTMLImageElement, buildImage } from '../data/image';
import { ImageGenerationResult } from './image-generation';

export interface AddGeneratedImageOptions {
  position?: Point;
  maxWidth?: number;
  spacing?: number;
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
    image.src = url;
  });
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
    
    // 构建图片数据
    const imageItem = {
      url: result.url,
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
  const { position = [400, 300], spacing = 320, maxWidth = 300 } = options;
  const placeholders: PlaitElement[] = [];
  
  for (let i = 0; i < count; i++) {
    // 计算每张图片的位置（水平排列）
    const imagePosition: Point = [
      position[0] + i * (maxWidth + spacing),
      position[1]
    ];
    
    // 创建占位符矩形
    const placeholder = {
      id: `placeholder_${Date.now()}_${i}`,
      type: 'geometry',
      shape: 'rectangle',
      x: imagePosition[0],
      y: imagePosition[1],
      width: maxWidth,
      height: maxWidth * 0.75, // 4:3 比例
      points: [
        [imagePosition[0], imagePosition[1]],
        [imagePosition[0] + maxWidth, imagePosition[1] + maxWidth * 0.75]
      ],
      strokeColor: '#ddd',
      strokeWidth: 2,
      fillColor: '#f5f5f5',
      strokeLineDash: [5, 5], // 虚线边框
      text: {
        children: [{ text: '生成中...' }],
        align: 'center',
        verticalAlign: 'middle'
      }
    } as PlaitElement;
    
    placeholders.push(placeholder);
  }
  
  // 批量添加占位符到画布
  DrawTransforms.insertElements(board, placeholders);
  
  return placeholders;
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
    // 获取占位符的位置
    const position: Point = [placeholder.x || 0, placeholder.y || 0];
    
    // 加载图片信息
    const imageInfo = await loadImageInfo(result.url);
    
    // 计算缩放后的尺寸
    const width = imageInfo.width > maxWidth ? maxWidth : imageInfo.width;
    const height = (width / imageInfo.width) * imageInfo.height;
    
    // 创建图片元素
    const imageItem = {
      url: result.url,
      width,
      height,
    };
    
    // 删除占位符
    DrawTransforms.removeElements(board, [placeholder]);
    
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