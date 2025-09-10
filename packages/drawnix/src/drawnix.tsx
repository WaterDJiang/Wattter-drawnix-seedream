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
} from '@plait/core';
import React, { useState, useRef, useEffect } from 'react';
import { withGroup } from '@plait/common';
import { withDraw } from '@plait/draw';
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

// 加载设置的函数
// 根据环境决定API端点
const getDefaultEndpoint = () => {
  if (typeof window !== 'undefined') {
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocalDev ? 'http://localhost:3001/generate-image' : '/api/generate-image';
  }
  return '/api/generate-image';
};

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
            <AIInput></AIInput>
          </Wrapper>
        </div>
      </DrawnixContext.Provider>
    </I18nProvider>
  );
};
