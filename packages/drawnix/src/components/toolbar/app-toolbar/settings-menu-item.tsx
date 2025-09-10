import React, { useState } from 'react';
import { SettingsIcon } from '../../icons';
import MenuItem from '../../menu/menu-item';
import { SettingsModal, AppSettings } from './settings-modal';
import { useDrawnix } from '../../../hooks/use-drawnix';

const STORAGE_KEY = 'drawnix-settings';

// 根据环境决定API端点
const getDefaultEndpoint = () => {
  if (typeof window !== 'undefined') {
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocalDev ? 'http://localhost:3001/generate-image' : '/api/generate-image';
  }
  return '/api/generate-image';
};

const DEFAULT_SETTINGS: AppSettings = {
  apiEndpoint: getDefaultEndpoint(),
  apiKey: '',
  watermarkEnabled: true,
  defaultModel: 'doubao-seedream-4-0-250828',
};

// 从 localStorage加载设置
const loadSettings = (): AppSettings => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
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
  return DEFAULT_SETTINGS;
};

// 保存设置到localStorage
const saveSettings = (settings: AppSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save settings to localStorage:', error);
  }
};

export const SettingsMenuItem: React.FC = () => {
  const drawnixContext = useDrawnix();
  console.log('useDrawnix context:', drawnixContext);
  
  const { appState, setAppState } = drawnixContext;
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  console.log('SettingsMenuItem render, openSettings:', appState.openSettings);
  console.log('Full appState:', appState);
  console.log('setAppState function:', typeof setAppState);

  const handleSaveSettings = (newSettings: AppSettings) => {
    console.log('Settings saved:', newSettings);
    setSettings(newSettings);
    saveSettings(newSettings);
    
    // 广播设置更新事件，其他组件可以监听
    window.dispatchEvent(new CustomEvent('settingsUpdated', { 
      detail: newSettings 
    }));
  };

  const handleOpenModal = () => {
    console.log('Settings menu item clicked, opening modal');
    console.log('Before setAppState - openSettings:', appState.openSettings);
    
    // 使用setTimeout确保菜单事件完全处理完毕
    setTimeout(() => {
      console.log('Setting openSettings to true after delay');
      setAppState(prevState => ({
        ...prevState,
        openSettings: true,
      }));
    }, 10);
  };

  const handleCloseModal = () => {
    console.log('Settings modal closed');
    setAppState({
      ...appState,
      openSettings: false,
    });
  };

  console.log('About to render SettingsModal with isOpen:', appState.openSettings);

  return (
    <>
      <MenuItem
        icon={SettingsIcon}
        data-testid="settings-button"
        onSelect={handleOpenModal}
        aria-label="应用设置"
      >
        设置
      </MenuItem>
      
      
    </>
  );
};

// 导出获取当前设置的函数，供其他组件使用
export const getCurrentSettings = (): AppSettings => {
  return loadSettings();
};

SettingsMenuItem.displayName = 'SettingsMenuItem';