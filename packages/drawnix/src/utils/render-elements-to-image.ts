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

  // 创建一个临时的画板状态，只包含要渲染的元素
  const tempBoard = {
    ...board,
    children: elements
  };

  try {
    // 使用Plait的toImage功能渲染元素
    const imageBlob = await toImage(tempBoard, {
      // 设置渲染区域为边界框
      x: boundingBox.x,
      y: boundingBox.y,
      width: boundingBox.width,
      height: boundingBox.height,
      // 设置合适的像素密度
      pixelRatio: 2,
      // 背景透明
      backgroundColor: 'transparent'
    });

    // 将Blob转换为base64 URL
    const imageUrl = await blobToBase64(imageBlob);
    console.log('✅ 元素渲染完成，图片大小:', imageBlob.size, 'bytes');
    
    return imageUrl;
  } catch (error) {
    console.error('❌ 渲染元素为图片失败:', error);
    throw new Error(`渲染失败: ${error.message}`);
  }
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
