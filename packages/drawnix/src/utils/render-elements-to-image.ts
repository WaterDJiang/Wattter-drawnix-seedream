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

  console.log('🎨 开始渲染元素为图片:', elements.length, '个元素');
  console.log('🎨 元素类型:', elements.map(el => ({
    id: el.id,
    type: (el as any).type || 'unknown',
    isFreehand: Freehand.isFreehand(el),
    isDrawElement: PlaitDrawElement.isDrawElement(el)
  })));

  try {
    // 使用Plait的toImage功能渲染选中的元素
    const imageDataUrl = await toImage(board, {
      elements: elements,
      fillStyle: 'transparent', // 透明背景
      padding: 20, // 添加一些边距
      ratio: 2, // 高分辨率
    });

    if (!imageDataUrl) {
      console.warn('⚠️ toImage返回空结果，使用占位符');
      return createSimplePlaceholderImage();
    }

    console.log('✅ 成功渲染元素为图片:', imageDataUrl.substring(0, 50) + '...');
    return imageDataUrl;
  } catch (error) {
    console.error('❌ 渲染元素为图片失败:', error);
    console.log('🔄 降级到占位符图片');
    return createSimplePlaceholderImage();
  }
}

/**
 * 创建一个简化的占位符图片
 */
function createSimplePlaceholderImage(): string {
  // 创建一个简单的SVG占位符，避免使用Canvas
  const svg = `
    <svg width="200" height="150" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="150" fill="#f0f0f0" stroke="#ccc" stroke-width="2"/>
      <text x="100" y="75" text-anchor="middle" font-family="Arial" font-size="14" fill="#666">
        渲染的元素
      </text>
    </svg>
  `;

  // 转换为base64 data URL
  return `data:image/svg+xml;base64,${btoa(svg)}`;
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
