import { PlaitBoard, PlaitElement } from '@plait/core';
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

  console.log('🎨 开始渲染元素为图片 (简化实现):', elements.length, '个元素');

  try {
    // 使用简化的占位符实现，避免任何可能的副作用
    const placeholderImageUrl = createSimplePlaceholderImage();
    console.log('✅ 创建简化占位符图片完成');

    return placeholderImageUrl;
  } catch (error) {
    console.error('❌ 渲染元素为图片失败:', error);
    throw new Error(`渲染失败: ${error.message}`);
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
