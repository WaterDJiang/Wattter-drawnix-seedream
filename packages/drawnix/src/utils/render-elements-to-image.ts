import { PlaitBoard, PlaitElement, RectangleClient, toImage } from '@plait/core';
import { PlaitDrawElement } from '@plait/draw';
import { Freehand } from '../plugins/freehand/type';

/**
 * 检测元素是否为可渲染的非图片元素
 */
export function isRenderableNonImageElement(element: PlaitElement): boolean {
  // 画笔元素
  if (Freehand.isFreehand(element)) {
    return true;
  }
  
  // 绘图元素（但不是图片）
  if (PlaitDrawElement.isDrawElement(element) && !PlaitDrawElement.isImage(element)) {
    return true;
  }
  
  return false;
}

/**
 * 将选中的非图片元素渲染成图片
 * @param board Plait画板实例
 * @param elements 要渲染的元素数组
 * @returns Promise<string> 返回base64格式的图片URL
 */
export async function renderElementsToImage(
  board: PlaitBoard,
  elements: PlaitElement[]
): Promise<string> {
  if (elements.length === 0) {
    throw new Error('没有元素需要渲染');
  }

  console.log('🎨 开始渲染元素为图片:', elements.map(el => ({
    id: el.id,
    type: el.type || 'unknown',
    isFreehand: Freehand.isFreehand(el),
    isDrawElement: PlaitDrawElement.isDrawElement(el),
    isImage: PlaitDrawElement.isImage(el)
  })));

  // 计算所有元素的边界框
  const boundingBox = calculateBoundingBox(elements);
  console.log('📐 计算的边界框:', boundingBox);

  try {
    // 暂时使用一个简化的实现：创建一个占位符图片
    // TODO: 实现真正的元素渲染功能
    const placeholderImageUrl = await createPlaceholderImage(boundingBox);
    console.log('✅ 创建占位符图片完成');

    return placeholderImageUrl;
  } catch (error) {
    console.error('❌ 渲染元素为图片失败:', error);
    throw new Error(`渲染失败: ${error.message}`);
  }
}

/**
 * 创建一个占位符图片（临时实现）
 */
async function createPlaceholderImage(boundingBox: { width: number; height: number }): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('无法创建Canvas上下文');
  }

  // 设置画布尺寸
  canvas.width = Math.max(boundingBox.width, 100);
  canvas.height = Math.max(boundingBox.height, 100);

  // 绘制一个简单的占位符
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#666';
  ctx.font = '16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('渲染的元素', canvas.width / 2, canvas.height / 2);

  // 转换为base64
  return canvas.toDataURL('image/png');
}

/**
 * 计算多个元素的边界框
 */
function calculateBoundingBox(elements: PlaitElement[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (elements.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  elements.forEach(element => {
    const rect = RectangleClient.getRectangleByPoints(element.points);
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  });

  // 添加一些边距
  const padding = 10;
  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + 2 * padding,
    height: maxY - minY + 2 * padding
  };
}

/**
 * 将Blob转换为base64 URL
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * 分离选中元素为图片和非图片元素
 */
export function separateSelectedElements(elements: PlaitElement[]): {
  imageElements: PlaitElement[];
  renderableElements: PlaitElement[];
} {
  const imageElements: PlaitElement[] = [];
  const renderableElements: PlaitElement[] = [];

  elements.forEach(element => {
    if (PlaitDrawElement.isImage(element)) {
      imageElements.push(element);
    } else if (isRenderableNonImageElement(element)) {
      renderableElements.push(element);
    }
  });

  return { imageElements, renderableElements };
}
