import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Island } from '../island';
import classNames from 'classnames';
import { useI18n } from '../../i18n';
import { ToolButton } from '../tool-button';
import { SendIcon } from '../icons';
import { Paperclip, Send, X, Image, Sparkles, ChevronDown } from 'lucide-react';
import { useBoard } from '@plait-board/react-board';
import { PlaitElement } from '@plait/core';
import { imageGenerationAPI, ImageGenerationResult } from '../../utils/image-generation';
import { createImagePlaceholders, replacePlaceholderWithImage } from '../../utils/add-generated-image';
import './ai-input.scss';

export interface AIInputProps {
  className?: string;
  placeholder?: string;
  maxRows?: number;
  onSubmit?: (message: string) => void;
  apiEndpoint?: string;
}

export const AIInput: React.FC<AIInputProps> = ({
  className,
  placeholder = "输入图片描述来生成...",
  maxRows = 4,
  onSubmit,
  apiEndpoint = '/api/ai-chat',
}) => {
  const { t } = useI18n();
  const board = useBoard();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ratioButtonRef = useRef<HTMLButtonElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [selectedRatio, setSelectedRatio] = useState<string>('3:4');
  const [showRatioDropdown, setShowRatioDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  // Keep textarea at fixed height
  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = '48px';
      textarea.style.overflowY = 'hidden';
    }
  }, [inputValue, maxRows]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showRatioDropdown && !(event.target as Element).closest('.ai-ratio-selector') && !(event.target as Element).closest('.ai-ratio-menu')) {
        setShowRatioDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showRatioDropdown]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() && !isLoading) {
        handleFormSubmit(e as any);
      }
    } else if (e.key === 'Escape') {
      setIsExpanded(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      setIsLoading(true);
      
      const currentPrompt = inputValue.trim();
      setInputValue('');
      
      const options = {
        position: [400, 300] as [number, number],
        spacing: 320,
        maxWidth: 300,
        aspectRatio: selectedRatio
      };
      
      // 立即创建占位符
      const placeholders = createImagePlaceholders(board, 1, options);
      
      try {
        // 转换上传的图片为 data URLs
        const imageUrls: string[] = [];
        for (const file of uploadedImages) {
          const dataUrl = await convertFileToDataURL(file);
          imageUrls.push(dataUrl);
        }

        // Call image generation API  
        const pixelSize = convertAspectRatioToPixelSize(selectedRatio);
        console.log('Selected ratio:', selectedRatio, 'Converted to pixel size:', pixelSize);
        const result = await imageGenerationAPI.generateImages(
          {
            prompt: currentPrompt,
            maxImages: 1,
            size: pixelSize,
            watermark: true,
            ...(imageUrls.length > 0 && { image: imageUrls })
          },
          // 进度回调：每生成一张图片就替换对应的占位符
          (imageResult) => {
            if (placeholders[imageResult.index]) {
              replacePlaceholderWithImage(
                board, 
                placeholders[imageResult.index], 
                imageResult, 
                options
              ).catch(error => {
                console.error(`Failed to replace placeholder ${imageResult.index}:`, error);
              });
            }
          }
        );
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        if (onSubmit) {
          onSubmit(currentPrompt);
        }
        
      } catch (error) {
        console.error('Image generation error:', error);
        alert(`图片生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
        
        // 清理占位符
        try {
          const { CoreTransforms } = await import('@plait/core');
          CoreTransforms.removeElements(board, placeholders);
        } catch (cleanupError) {
          console.error('Failed to cleanup placeholders:', cleanupError);
        }
      }
      
      setIsLoading(false);
    }
  };

  const handleInputChangeLocal = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => file.type.startsWith('image/'));
    
    // 限制最多10张图片
    const limitedFiles = validFiles.slice(0, 10 - uploadedImages.length);
    setUploadedImages(prev => [...prev, ...limitedFiles].slice(0, 10));
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const convertFileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  };

  // 将宽高比转换为2K分辨率的具体像素尺寸
  const convertAspectRatioToPixelSize = (aspectRatio: string): string => {
    if (aspectRatio === 'auto') {
      return '2K'; // 让AI自动决定
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

  const aspectRatios = [
    { label: '智能', value: 'auto' },
    { label: '21:9', value: '21:9' },
    { label: '16:9', value: '16:9' },
    { label: '3:2', value: '3:2' },
    { label: '4:3', value: '4:3' },
    { label: '1:1', value: '1:1' },
    { label: '3:4', value: '3:4' },
    { label: '2:3', value: '2:3' },
    { label: '9:16', value: '9:16' },
  ];

  return (
    <div className={classNames('ai-input-container', className)}>
      <div className="ai-input-card">
        <form onSubmit={handleFormSubmit} className="ai-input-form">
          {/* 单行输入区域 - 所有控件整合 */}
          <div className="ai-input-unified-row">
            {/* 图片上传 - 移到最左边 */}
            <div className="ai-upload-section">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="ai-file-input"
                disabled={uploadedImages.length >= 10}
                id="ai-file-upload"
                style={{ display: 'none' }}
              />
              <button 
                type="button"
                className={classNames('ai-upload-btn', {
                  'ai-upload-btn--active': uploadedImages.length > 0,
                  'ai-upload-btn--disabled': uploadedImages.length >= 10
                })}
                onClick={() => document.getElementById('ai-file-upload')?.click()}
                disabled={uploadedImages.length >= 10}
                title={uploadedImages.length >= 10 ? "已达图片上传上限" : "上传参考图片"}
              >
                <Image size={20} strokeWidth={1.5} />
                {uploadedImages.length > 0 && (
                  <span className="ai-upload-badge">{uploadedImages.length}</span>
                )}
              </button>
            </div>

            <div className="ai-input-field-wrapper">
              <textarea
                ref={textareaRef}
                className={classNames('ai-input-field', {
                  'ai-input-field--focused': isExpanded
                })}
                value={inputValue}
                onChange={handleInputChangeLocal}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsExpanded(true)}
                placeholder="描述你想要生成的图片..."
                rows={1}
                aria-label={t('ai.input.placeholder') || placeholder}
              />
            </div>
            
            {/* 右侧工具按钮组 */}
            <div className="ai-controls-group">
              {/* 比例选择 */}
              <div className="ai-ratio-selector">
                <button 
                  ref={ratioButtonRef}
                  type="button"
                  className={classNames('ai-ratio-btn', {
                    'ai-ratio-btn--open': showRatioDropdown
                  })}
                  onClick={() => {
                    if (!showRatioDropdown && ratioButtonRef.current) {
                      const rect = ratioButtonRef.current.getBoundingClientRect();
                      const menuHeight = aspectRatios.length * 36 + 16; // 动态计算：选项数 * 36px + padding
                      const spacing = 4; // 按钮和菜单间距
                      
                      let top = rect.top - menuHeight - spacing;
                      
                      // 边界检测：如果菜单会超出视口顶部，则显示在按钮下方
                      if (top < 10) {
                        top = rect.bottom + spacing;
                      }
                      
                      setDropdownPosition({
                        top: top,
                        left: rect.left,
                        width: rect.width
                      });
                    }
                    setShowRatioDropdown(!showRatioDropdown);
                  }}
                  title="选择图片比例"
                >
                  <span className="ai-ratio-current">
                    {aspectRatios.find(r => r.value === selectedRatio)?.label || '3:4'}
                  </span>
                  <ChevronDown 
                    size={16} 
                    strokeWidth={1.5}
                    className="ai-ratio-chevron"
                  />
                </button>
              </div>

              {/* 生成按钮 */}
              <button
                type="submit"
                className={classNames('ai-send-btn', { 
                  'ai-send-btn--disabled': !inputValue.trim()
                })}
                disabled={!inputValue.trim()}
                title="开始创作 (⏎)"
              >
                <Send className="ai-send-icon" size={20} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* 图片预览区域 */}
          {uploadedImages.length > 0 && (
            <div className="ai-images-preview">
              <div className="ai-images-grid">
                {uploadedImages.map((file, index) => (
                  <div key={index} className="ai-image-item">
                    <div className="ai-image-wrapper">
                      <img 
                        src={URL.createObjectURL(file)} 
                        alt={`参考图片 ${index + 1}`}
                        className="ai-image"
                      />
                      <button
                        type="button"
                        className="ai-image-remove"
                        onClick={() => removeImage(index)}
                        aria-label="删除图片"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
      {showRatioDropdown && createPortal(
        <div 
          className="ai-ratio-menu"
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            zIndex: 9999
          }}
        >
          {aspectRatios.map((ratio) => (
            <button
              key={ratio.value}
              type="button"
              className={classNames('ai-ratio-item', {
                'ai-ratio-item--selected': ratio.value === selectedRatio
              })}
              onClick={() => {
                setSelectedRatio(ratio.value);
                setShowRatioDropdown(false);
              }}
            >
              {ratio.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

export default AIInput;