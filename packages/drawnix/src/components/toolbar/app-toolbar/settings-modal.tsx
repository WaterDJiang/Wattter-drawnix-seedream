import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Eye, EyeOff } from 'lucide-react';

export interface AppSettings {
  apiEndpoint: string;
  apiKey: string;
  watermarkEnabled: boolean;
  defaultModel: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
  initialSettings: AppSettings;
}

// 根据环境决定API端点
const getDefaultEndpoint = () => {
  if (typeof window !== 'undefined') {
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocalDev ? 'http://localhost:3000/generate-image' : '/generate-image';
  }
  return '/generate-image';
};

const DEFAULT_SETTINGS: AppSettings = {
  apiEndpoint: getDefaultEndpoint(),
  apiKey: '',
  watermarkEnabled: true,
  defaultModel: 'doubao-seedream-4-0-250828',
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialSettings,
}) => {
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [errors, setErrors] = useState<Partial<AppSettings>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  const validateSettings = (): boolean => {
    const newErrors: Partial<AppSettings> = {};

    if (!settings.apiKey.trim()) {
      newErrors.apiKey = 'API密钥不能为空';
    } else if (settings.apiKey.trim().length < 10) {
      newErrors.apiKey = 'API密钥格式无效，请检查是否完整';
    } else if (!settings.apiKey.startsWith('sk-') && !settings.apiKey.includes('-')) {
      newErrors.apiKey = 'API密钥格式可能不正确，请确认是否为有效的豆包API密钥';
    }

    // 只有在显示高级设置时才验证这些字段
    if (showAdvanced) {
      if (!settings.apiEndpoint.trim()) {
        newErrors.apiEndpoint = 'API端点不能为空';
      } else if (!isValidUrl(settings.apiEndpoint)) {
        newErrors.apiEndpoint = 'API端点格式无效';
      }

      if (!settings.defaultModel.trim()) {
        newErrors.defaultModel = '默认模型不能为空';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSave = () => {
    if (validateSettings()) {
      onSave(settings);
      onClose();
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setErrors({});
  };

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="settings-modal-overlay">
      <div className="settings-modal">
        <div className="settings-modal-header">
          <h3>应用设置</h3>
          <button
            type="button"
            className="settings-modal-close"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="settings-modal-content">
          {/* 基本设置部分 */}
          <div className="settings-section">
            <h4 className="settings-section-title">基本设置</h4>
            
            <div className="settings-field">
              <label htmlFor="apiKey">API密钥</label>
              <div className="settings-field-description">
                <div className="settings-help-box">
                  <p className="settings-help-title">📋 配置步骤：</p>
                  <ol className="settings-help-steps">
                    <li>访问 <a href="https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey" target="_blank" rel="noopener noreferrer" className="settings-link">火山引擎控制台</a></li>
                    <li>登录您的账号并进入API密钥管理页面</li>
                    <li>创建新的API密钥或复制现有密钥</li>
                    <li>将密钥粘贴到下方输入框中</li>
                  </ol>
                  <p className="settings-help-tip">💡 提示：API密钥通常以"sk-"开头或包含连字符</p>
                </div>
              </div>
              <div className="settings-input-with-toggle">
                <input
                  id="apiKey"
                  type={showApiKey ? "text" : "password"}
                  value={settings.apiKey}
                  onChange={(e) => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                  onBlur={() => validateSettings()}
                  className={`settings-input ${errors.apiKey ? 'settings-input--error' : ''}`}
                  placeholder="输入豆包Seedream API密钥"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="settings-toggle-button"
                  aria-label={showApiKey ? "隐藏API密钥" : "显示API密钥"}
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.apiKey && (
                <div className="settings-error-box">
                  <span className="settings-field-error">❌ {errors.apiKey}</span>
                  <p className="settings-error-help">请检查API密钥是否正确复制，确保没有多余的空格或字符。</p>
                </div>
              )}
              {!errors.apiKey && settings.apiKey && (
                <div className="settings-success-box">
                  <span className="settings-field-success">✅ API密钥配置成功！现在可以开始生成图片了。</span>
                </div>
              )}
            </div>
            
            <div className="settings-field">
              <div className="settings-toggle">
                <label htmlFor="watermarkEnabled" className="settings-toggle-label">
                  图片添加AI生成水印
                  <span className="settings-toggle-description">
                    在生成的图片上添加AI生成标识
                  </span>
                </label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.watermarkEnabled}
                  onClick={() => setSettings(prev => ({ ...prev, watermarkEnabled: !prev.watermarkEnabled }))}
                  className={`settings-switch ${settings.watermarkEnabled ? 'settings-switch--on' : 'settings-switch--off'}`}
                >
                  <span className="settings-switch-thumb" />
                </button>
              </div>
            </div>
          </div>

          {/* 高级设置部分 */}
          <div className="settings-section">
            <div className="settings-advanced-toggle">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="settings-advanced-button"
              >
                <span>高级设置</span>
                <span className={`settings-advanced-arrow ${showAdvanced ? 'settings-advanced-arrow--expanded' : ''}`}>
                  ▼
                </span>
              </button>
            </div>
            
            {showAdvanced && (
              <>
                <div className="settings-field">
                  <label htmlFor="apiEndpoint">API端点</label>
                  <input
                    id="apiEndpoint"
                    type="url"
                    value={settings.apiEndpoint}
                    onChange={(e) => setSettings(prev => ({ ...prev, apiEndpoint: e.target.value }))}
                    onBlur={() => validateSettings()}
                    className={`settings-input ${errors.apiEndpoint ? 'settings-input--error' : ''}`}
                    placeholder="输入API端点地址"
                  />
                  {errors.apiEndpoint && (
                    <span className="settings-field-error">{errors.apiEndpoint}</span>
                  )}
                </div>

                <div className="settings-field">
                  <label htmlFor="defaultModel">默认模型</label>
                  <input
                    id="defaultModel"
                    type="text"
                    value={settings.defaultModel}
                    onChange={(e) => setSettings(prev => ({ ...prev, defaultModel: e.target.value }))}
                    onBlur={() => validateSettings()}
                    className={`settings-input ${errors.defaultModel ? 'settings-input--error' : ''}`}
                    placeholder="doubao-seedream-4-0-250828"
                  />
                  {errors.defaultModel && (
                    <span className="settings-field-error">{errors.defaultModel}</span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="settings-modal-actions">
          <button
            type="button"
            className="settings-modal-reset"
            onClick={handleReset}
          >
            重置默认
          </button>
          <div className="settings-modal-main-actions">
            <button
              type="button"
              className="settings-modal-cancel"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="button"
              className="settings-modal-save"
              onClick={handleSave}
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};