import { Board, BoardChangeData, Wrapper } from '@plait-board/react-board';
import {
  PlaitBoard,
  PlaitBoardOptions,
  PlaitElement,
  PlaitPlugin,
  PlaitPointerType,
  PlaitTheme,
  Selection,
  ThemeColorMode,
  Viewport,
  getSelectedElements,
  RectangleClient,
  Transforms,
} from '@plait/core';
import React, { useState, useRef, useEffect } from 'react';
import { withGroup } from '@plait/common';
import { withDraw, PlaitDrawElement } from '@plait/draw';
import { MindThemeColors, withMind } from '@plait/mind';
import MobileDetect from 'mobile-detect';
import { withMindExtend } from './plugins/with-mind-extend';
import { withCommonPlugin } from './plugins/with-common';
import { CreationToolbar } from './components/toolbar/creation-toolbar';
import { ZoomToolbar } from './components/toolbar/zoom-toolbar';
import { PopupToolbar } from './components/toolbar/popup-toolbar/popup-toolbar';
import { AppToolbar } from './components/toolbar/app-toolbar/app-toolbar';
import classNames from 'classnames';
import './styles/index.scss';
import { buildDrawnixHotkeyPlugin } from './plugins/with-hotkey';
import { withFreehand } from './plugins/freehand/with-freehand';
import { ThemeToolbar } from './components/toolbar/theme-toolbar';
import { buildPencilPlugin } from './plugins/with-pencil';
import {
  DrawnixBoard,
  DrawnixContext,
  DrawnixState,
} from './hooks/use-drawnix';
import { ClosePencilToolbar } from './components/toolbar/pencil-mode-toolbar';
import { TTDDialog } from './components/ttd-dialog/ttd-dialog';
import { CleanConfirm } from './components/clean-confirm/clean-confirm';
import { SettingsModal, AppSettings } from './components/toolbar/app-toolbar/settings-modal';
import { ImageToImageDialog } from './components/image-to-image-dialog';
import {
  generateImageToImage,
  getImageUrl,
  getImageSize,
  getImageAspectRatio,
  calculateSizeFromAspectRatio,
  formatSizeForAPI
} from './utils/image-to-image-generation';
import { createImagePlaceholders, replacePlaceholderWithImage } from './utils/add-generated-image';
import { renderElementsToImage } from './utils/render-elements-to-image';

// 将宽高比转换为2K分辨率的具体像素尺寸
const convertAspectRatioToPixelSize = (aspectRatio: string): string => {
  if (aspectRatio === 'auto') {
    return '2K'; // 让AI自动决定
  }

  if (aspectRatio === 'custom') {
    // 图生图暂不支持自定义尺寸，使用默认
    return '2048x2048';
  }

  const [widthRatio, heightRatio] = aspectRatio.split(':').map(Number);
  if (!widthRatio || !heightRatio) {
    return '2K';
  }

  // 基于2K分辨率计算具体像素
  const baseResolution = 2048;
  let width: number, height: number;

  if (widthRatio >= heightRatio) {
    // 横版或正方形：长边为2048
    width = baseResolution;
    height = Math.round((heightRatio / widthRatio) * baseResolution);
  } else {
    // 竖版：短边基于长边计算
    height = baseResolution;
    width = Math.round((widthRatio / heightRatio) * baseResolution);
  }

  // 确保像素值是8的倍数（AI生成图片的常见要求）
  width = Math.round(width / 8) * 8;
  height = Math.round(height / 8) * 8;

  return `${width}x${height}`;
};

// 加载设置的函数
// 根据环境决定API端点
const getDefaultEndpoint = () => {
  if (typeof window !== 'undefined') {
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocalDev ? 'http://localhost:3001/generate-image' : '/api/generate-image';
  }
  return '/api/generate-image';
};

// 处理图生图生成
async function handleImageToImageGeneration(
  board: PlaitBoard,
  prompt: string,
  selectedImages: PlaitElement[],
  appState: DrawnixState,
  selectedRenderableElements?: PlaitElement[]
) {
  try {
    console.log('🎨 开始处理图生图生成');
    console.log('🎨 选中图片数量:', selectedImages.length);
    console.log('🎨 选中可渲染元素数量:', selectedRenderableElements?.length || 0);

    // 处理可渲染元素：将它们渲染成图片
    let allImageUrls: string[] = [];

    // 首先处理可渲染元素（如果有的话）
    if (selectedRenderableElements && selectedRenderableElements.length > 0) {
      console.log('🎨 开始渲染非图片元素为图片...');
      try {
        const renderedImageUrl = await renderElementsToImage(board, selectedRenderableElements);
        allImageUrls.push(renderedImageUrl);
        console.log('✅ 成功渲染非图片元素为图片');
      } catch (error) {
        console.error('❌ 渲染非图片元素失败:', error);
        // 继续执行，不中断流程
      }
    }

    // 获取当前AI输入框选择的宽高比
    // 从AI输入组件的比例按钮获取当前选择的宽高比
    let selectedAspectRatio = '3:4'; // 默认比例

    const ratioButton = document.querySelector('.ai-ratio-current');
    if (ratioButton) {
      const buttonText = ratioButton.textContent?.trim();
      if (buttonText && buttonText.includes(':')) {
        selectedAspectRatio = buttonText;
      } else if (buttonText === '智能') {
        selectedAspectRatio = 'auto';
      }
    }

    console.log('🎨 使用宽高比:', selectedAspectRatio);

    // 使用AI对话框的比例设置来确定生成图片的尺寸
    const apiSize = convertAspectRatioToPixelSize(selectedAspectRatio);

    // 解析尺寸用于创建占位符和API调用
    let originalSize: { width: number; height: number };
    if (apiSize === '2K') {
      originalSize = { width: 2048, height: 2048 }; // 默认正方形
    } else {
      const [width, height] = apiSize.split('x').map(Number);
      originalSize = { width, height };
    }

    // 占位符使用缩小4倍的尺寸，更美观
    const targetSize = {
      width: Math.round(originalSize.width / 4),
      height: Math.round(originalSize.height / 4)
    };

    console.log('🎨 目标尺寸:', { targetSize, apiSize, pixels: targetSize.width * targetSize.height });

    // 按照画布位置（从左到右，从上到下）对选中图片进行排序
    const sortedImages = [...selectedImages].sort((a, b) => {
      const rectA = RectangleClient.getRectangleByPoints(a.points);
      const rectB = RectangleClient.getRectangleByPoints(b.points);

      // 首先按Y坐标排序（从上到下）
      const yDiff = rectA.y - rectB.y;
      if (Math.abs(yDiff) > 50) { // 如果Y坐标差距超过50px，认为是不同行
        return yDiff;
      }

      // 如果在同一行，按X坐标排序（从左到右）
      return rectA.x - rectB.x;
    });

    console.log('🔍 选中图片的原始顺序:', selectedImages.map((img, index) => {
      const rect = RectangleClient.getRectangleByPoints(img.points);
      return {
        index,
        id: img.id,
        position: { x: rect.x, y: rect.y },
        url: getImageUrl(img)?.substring(0, 50) + '...'
      };
    }));

    console.log('🔍 排序后的图片顺序:', sortedImages.map((img, index) => {
      const rect = RectangleClient.getRectangleByPoints(img.points);
      return {
        index,
        id: img.id,
        position: { x: rect.x, y: rect.y },
        url: getImageUrl(img)?.substring(0, 50) + '...'
      };
    }));

    // 获取排序后图片的URLs，并与渲染的图片URL合并
    for (const image of sortedImages) {
      const url = getImageUrl(image);
      if (url) {
        allImageUrls.push(url);
      }
    }

    if (allImageUrls.length === 0) {
      console.error('❌ 没有找到有效的图片URL（包括渲染的图片）');
      return;
    }

    console.log('🎨 所有图片URLs顺序:', allImageUrls.map((url, index) => ({ index, url: url.substring(0, 50) + '...' })));

    // 计算占位符位置（在选中元素区域的右侧）
    // 优先使用图片元素，如果没有图片则使用可渲染元素
    const referenceElement = selectedImages[0] || selectedRenderableElements?.[0];
    if (!referenceElement) {
      console.error('❌ 没有找到参考元素来计算占位符位置');
      return;
    }

    const referenceRect = RectangleClient.getRectangleByPoints(referenceElement.points);
    const placeholderPosition: [number, number] = [
      referenceRect.x + referenceRect.width + 20, // 右侧20px间距
      referenceRect.y
    ];

    console.log('🎨 占位符位置:', placeholderPosition);

    // 默认创建1个占位符，让API决定是否生成多张图片
    const placeholders = createImagePlaceholders(board, {
      position: placeholderPosition,
      spacing: 20,
      maxWidth: Math.min(targetSize.width, 300), // 限制占位符最大宽度为300px
      aspectRatio: 'custom', // 使用自定义比例
      count: 1, // 默认1个占位符
      customWidth: targetSize.width,
      customHeight: targetSize.height
    });

    if (placeholders.length === 0) {
      console.error('❌ 创建占位符失败');
      return;
    }

    console.log('🎨 创建占位符成功:', placeholders);

    // 获取设置
    const settings = loadSettings();

    // 调用图生图API，让豆包API自己判断是否生成多张图片
    await generateImageToImage(
      {
        prompt,
        images: allImageUrls,
        size: apiSize,
        watermark: settings.watermarkEnabled,
        apiKey: settings.apiKey,
        // 让豆包API自动判断是否需要生成多张图片
        sequential_image_generation: 'auto',
        max_images: 10 // 设置最大限制，防止生成过多图片
      },
      (result) => {
        console.log('🎨 收到图生图结果:', result);

        // 如果是总数通知事件（index=-1），立即创建所有需要的占位符
        if (result.index === -1 && result.totalImages && result.totalImages > 1) {
          console.log(`🎨 收到总数通知，需要生成${result.totalImages}张图片，立即创建所有占位符`);

          // 创建剩余的占位符（第2张到第N张）
          for (let i = 1; i < result.totalImages; i++) {
            if (placeholders.length <= i) { // 只创建还不存在的占位符
              const newPosition: [number, number] = [
                placeholderPosition[0] + i * (targetSize.width + 20),
                placeholderPosition[1]
              ];

              const newPlaceholders = createImagePlaceholders(board, {
                position: newPosition,
                spacing: 20,
                maxWidth: Math.min(targetSize.width, 300),
                aspectRatio: 'custom',
                count: 1,
                customWidth: targetSize.width,
                customHeight: targetSize.height
              });

              if (newPlaceholders.length > 0) {
                placeholders.push(newPlaceholders[0]);
                console.log(`🎨 提前创建第${i + 1}张图片的占位符`);
              }
            }
          }
          return; // 总数通知事件不需要替换图片
        }

        // 通用兜底逻辑：确保有足够的占位符来容纳所有图片
        while (result.index >= placeholders.length) {
          const newIndex = placeholders.length;
          console.log(`🎨 动态创建占位符：第${newIndex + 1}张图片需要占位符`);

          const newPosition: [number, number] = [
            placeholderPosition[0] + newIndex * (targetSize.width + 20),
            placeholderPosition[1]
          ];

          const newPlaceholders = createImagePlaceholders(board, {
            position: newPosition,
            spacing: 20,
            maxWidth: Math.min(targetSize.width, 300),
            aspectRatio: 'custom',
            count: 1,
            customWidth: targetSize.width,
            customHeight: targetSize.height
          });

          if (newPlaceholders.length > 0) {
            placeholders.push(newPlaceholders[0]);
            console.log(`✅ 成功创建第${newIndex + 1}张图片的占位符`);
          } else {
            console.error(`❌ 创建第${newIndex + 1}张图片的占位符失败`);
            break; // 避免无限循环
          }
        }

        // 替换对应索引的占位符
        if (result.index >= 0 && placeholders[result.index]) {
          const placeholder = placeholders[result.index];
          const [originalWidth, originalHeight] = result.size.split('x').map(Number);

          // 缩小4倍插入，使画布更美观
          const displayWidth = Math.round(originalWidth / 4);
          const displayHeight = Math.round(originalHeight / 4);

          // 使用replacePlaceholderWithImage函数来替换占位符
          replacePlaceholderWithImage(board, placeholder, {
            url: result.url,
            width: displayWidth,
            height: displayHeight,
            size: result.size
          });

          console.log(`✅ 成功替换第${result.index + 1}张图片:`, result.url, `尺寸: ${originalWidth}x${originalHeight} → ${displayWidth}x${displayHeight}`);
        } else if (result.index >= 0) {
          console.warn(`⚠️ 未找到索引为${result.index}的占位符`);
        }
      }
    );

  } catch (error) {
    console.error('❌ 图生图生成失败:', error);
  }
}

const loadSettings = (): AppSettings => {
  try {
    const saved = localStorage.getItem('drawnix-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        apiEndpoint: parsed.apiEndpoint || getDefaultEndpoint(),
        apiKey: parsed.apiKey || '',
        watermarkEnabled: parsed.watermarkEnabled !== undefined ? parsed.watermarkEnabled : true,
        defaultModel: parsed.defaultModel || 'doubao-seedream-4-0-250828',
      };
    }
  } catch (error) {
    console.warn('Failed to load settings from localStorage:', error);
  }
  
  const defaultSettings = {
    apiEndpoint: getDefaultEndpoint(),
    apiKey: '',
    watermarkEnabled: true,
    defaultModel: 'doubao-seedream-4-0-250828',
  };
  
  console.log('Using default settings:', defaultSettings);
  return defaultSettings;
};
import { buildTextLinkPlugin } from './plugins/with-text-link';
import { LinkPopup } from './components/popup/link-popup/link-popup';
import { I18nProvider } from './i18n';
import { Tutorial } from './components/tutorial';
import { AIInput } from './components/ai-input';

export type DrawnixProps = {
  value: PlaitElement[];
  viewport?: Viewport;
  theme?: PlaitTheme;
  onChange?: (value: BoardChangeData) => void;
  onSelectionChange?: (selection: Selection | null) => void;
  onValueChange?: (value: PlaitElement[]) => void;
  onViewportChange?: (value: Viewport) => void;
  onThemeChange?: (value: ThemeColorMode) => void;
  afterInit?: (board: PlaitBoard) => void;
  tutorial?: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

export const Drawnix: React.FC<DrawnixProps> = ({
  value,
  viewport,
  theme,
  onChange,
  onSelectionChange,
  onViewportChange,
  onThemeChange,
  onValueChange,
  afterInit,
  tutorial = false,
}) => {
  const options: PlaitBoardOptions = {
    readonly: false,
    hideScrollbar: false,
    disabledScrollOnNonFocus: false,
    themeColors: MindThemeColors,
    // 修复高DPI屏幕缩放问题
    pixelRatio: window.devicePixelRatio,
  };

  const [appState, setAppState] = useState<DrawnixState>(() => {
    // TODO: need to consider how to maintenance the pointer state in future
    const md = new MobileDetect(window.navigator.userAgent);
    return {
      pointer: PlaitPointerType.hand,
      isMobile: md.mobile() !== null,
      isPencilMode: false,
      openDialogType: null,
      openCleanConfirm: false,
      openSettings: false,
    };
  });

  const [board, setBoard] = useState<DrawnixBoard | null>(null);

  if (board) {
    board.appState = appState;
  }

  const updateAppState = (newAppState: Partial<DrawnixState>) => {
    setAppState({
      ...appState,
      ...newAppState,
    });
  };

  const plugins: PlaitPlugin[] = [
    withDraw,
    withGroup,
    withMind,
    withMindExtend,
    withCommonPlugin,
    buildDrawnixHotkeyPlugin(updateAppState),
    withFreehand,
    buildPencilPlugin(updateAppState),
    buildTextLinkPlugin(updateAppState),
  ];

  const containerRef = useRef<HTMLDivElement>(null);



  return (
    <I18nProvider>
      <DrawnixContext.Provider value={{ appState, setAppState }}>
        <div
          className={classNames('drawnix', {
            'drawnix--mobile': appState.isMobile,
          })}
          ref={containerRef}
        >
          <Wrapper
            value={value}
            viewport={viewport}
            theme={theme}
            options={options}
            plugins={plugins}
            onChange={(data: BoardChangeData) => {
              onChange && onChange(data);
            }}
            onSelectionChange={onSelectionChange}
            onViewportChange={onViewportChange}
            onThemeChange={onThemeChange}
            onValueChange={onValueChange}
          >
            <Board
              afterInit={(board) => {
                setBoard(board as DrawnixBoard);
                afterInit && afterInit(board);
              }}
            >
              {tutorial &&
                board &&
                PlaitBoard.isPointer(board, PlaitPointerType.selection) && (
                  <Tutorial />
                )}
            </Board>
            <AppToolbar></AppToolbar>
            <CreationToolbar></CreationToolbar>
            <ZoomToolbar></ZoomToolbar>
            <ThemeToolbar></ThemeToolbar>
            <PopupToolbar></PopupToolbar>
            <LinkPopup></LinkPopup>
            <ClosePencilToolbar></ClosePencilToolbar>
            <TTDDialog container={containerRef.current}></TTDDialog>
            <CleanConfirm container={containerRef.current}></CleanConfirm>
            <SettingsModal
              isOpen={appState.openSettings}
              onClose={() => setAppState(prevState => ({...prevState, openSettings: false}))}
              onSave={(settings) => {
                localStorage.setItem('drawnix-settings', JSON.stringify(settings));
                window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: settings }));
              }}
              initialSettings={loadSettings()}
            />
            {appState.imageToImageDialog?.isOpen && (
              <ImageToImageDialog
                board={board}
                selectedImages={appState.imageToImageDialog.selectedImages}
                position={appState.imageToImageDialog.position}
                onClose={() => setAppState(prevState => ({
                  ...prevState,
                  imageToImageDialog: null
                }))}
                onSubmit={async (prompt, images) => {
                  // 关闭对话框
                  setAppState(prevState => ({
                    ...prevState,
                    imageToImageDialog: null
                  }));

                  // 调用图生图处理函数
                  if (board) {
                    await handleImageToImageGeneration(
                      board,
                      prompt,
                      images,
                      appState,
                      appState.imageToImageDialog?.selectedRenderableElements
                    );
                  }
                }}
              />
            )}
            <AIInput></AIInput>
          </Wrapper>
        </div>
      </DrawnixContext.Provider>
    </I18nProvider>
  );
};
