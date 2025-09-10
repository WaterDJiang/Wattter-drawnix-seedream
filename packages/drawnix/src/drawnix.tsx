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
  appState: DrawnixState
) {
  try {
    console.log('🎨 开始处理图生图生成');

    // 获取当前AI输入框选择的宽高比
    // 从AI输入组件的按钮文本获取当前选择的宽高比
    let selectedAspectRatio = '3:4'; // 默认比例

    const ratioButton = document.querySelector('.ai-input .ratio-button');
    if (ratioButton) {
      const buttonText = ratioButton.textContent?.trim();
      if (buttonText && buttonText.includes(':')) {
        selectedAspectRatio = buttonText;
      }
    }

    console.log('🎨 使用宽高比:', selectedAspectRatio);

    // 获取第一张选中图片的信息作为参考
    const firstImage = selectedImages[0];
    const referenceSize = getImageSize(firstImage);
    const referenceAspectRatio = getImageAspectRatio(firstImage);

    console.log('🎨 参考图片信息:', { referenceSize, referenceAspectRatio });

    // 确定最终使用的宽高比（优先使用AI对话框选择的比例）
    const finalAspectRatio = selectedAspectRatio !== '1:1' ? selectedAspectRatio : referenceAspectRatio;

    // 计算生成图片的尺寸
    const targetSize = calculateSizeFromAspectRatio(finalAspectRatio, referenceSize);
    const apiSize = formatSizeForAPI(targetSize);

    console.log('🎨 目标尺寸:', { finalAspectRatio, targetSize, apiSize });

    // 获取选中图片的URLs
    const imageUrls: string[] = [];
    for (const image of selectedImages) {
      const url = getImageUrl(image);
      if (url) {
        imageUrls.push(url);
      }
    }

    if (imageUrls.length === 0) {
      console.error('❌ 没有找到有效的图片URL');
      return;
    }

    console.log('🎨 图片URLs:', imageUrls);

    // 计算占位符位置（在选中图片区域的右侧）
    const firstImageRect = RectangleClient.getRectangleByPoints(firstImage.points);
    const placeholderPosition: [number, number] = [
      firstImageRect.x + firstImageRect.width + 20, // 右侧20px间距
      firstImageRect.y
    ];

    console.log('🎨 占位符位置:', placeholderPosition);

    // 创建占位符
    const placeholders = createImagePlaceholders(board, {
      position: placeholderPosition,
      spacing: 20,
      maxWidth: targetSize.width,
      aspectRatio: finalAspectRatio,
      count: 1, // 每次生成一张图
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

    // 调用图生图API
    await generateImageToImage(
      {
        prompt,
        images: imageUrls,
        size: apiSize,
        watermark: settings.watermarkEnabled,
        apiKey: settings.apiKey
      },
      (result) => {
        console.log('🎨 收到图生图结果:', result);

        // 替换占位符
        if (placeholders[result.index]) {
          const placeholder = placeholders[result.index];
          const [width, height] = result.size.split('x').map(Number);

          // 使用replacePlaceholderWithImage函数来替换占位符
          replacePlaceholderWithImage(board, placeholder, {
            url: result.url,
            width,
            height,
            size: result.size
          });

          console.log('✅ 成功替换占位符为真实图片:', result.url);
        }
      }
    );

  } catch (error) {
    console.error('❌ 图生图生成失败:', error);
  }
}

const loadSettings = (): AppSettings => {
  console.log('Loading settings from localStorage...');
  try {
    const saved = localStorage.getItem('drawnix-settings');
    console.log('Raw saved settings:', saved);
    
    if (saved) {
      const parsed = JSON.parse(saved);
      console.log('Parsed settings:', parsed);
      
      const result = {
        apiEndpoint: parsed.apiEndpoint || getDefaultEndpoint(),
        apiKey: parsed.apiKey || '',
        watermarkEnabled: parsed.watermarkEnabled !== undefined ? parsed.watermarkEnabled : true,
        defaultModel: parsed.defaultModel || 'doubao-seedream-4-0-250828',
      };
      
      console.log('Final loaded settings:', result);
      return result;
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
              onClose={() => setAppState({...appState, openSettings: false})}
              onSave={(settings) => {
                // 保存设置逻辑
                console.log('Saving settings to localStorage:', settings);
                localStorage.setItem('drawnix-settings', JSON.stringify(settings));
                
                // 验证保存是否成功
                const saved = localStorage.getItem('drawnix-settings');
                console.log('Settings saved successfully:', saved);
                
                window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: settings }));
              }}
              initialSettings={loadSettings()}
            />
            {appState.imageToImageDialog?.isOpen && (
              <ImageToImageDialog
                board={board}
                selectedImages={appState.imageToImageDialog.selectedImages}
                position={appState.imageToImageDialog.position}
                onClose={() => setAppState({
                  ...appState,
                  imageToImageDialog: null
                })}
                onSubmit={async (prompt, images) => {
                  console.log('🎨 开始图生图流程:', { prompt, images });

                  // 关闭对话框
                  setAppState({
                    ...appState,
                    imageToImageDialog: null
                  });

                  // 调用图生图处理函数
                  if (board) {
                    await handleImageToImageGeneration(board, prompt, images, appState);
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
