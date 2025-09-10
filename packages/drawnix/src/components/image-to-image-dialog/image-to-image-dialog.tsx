import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Send, X } from 'lucide-react';
import { PlaitElement, PlaitBoard } from '@plait/core';
import './image-to-image-dialog.scss';

export interface ImageToImageDialogProps {
  board: PlaitBoard;
  selectedImages: PlaitElement[];
  position: { x: number; y: number };
  onClose: () => void;
  onSubmit: (prompt: string, images: PlaitElement[]) => Promise<void>;
}

export const ImageToImageDialog: React.FC<ImageToImageDialogProps> = ({
  board,
  selectedImages,
  position,
  onClose,
  onSubmit,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 自动聚焦输入框
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // 处理键盘事件
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSubmit();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [prompt, onClose]);

  // 处理点击外部区域关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const dialogElement = document.querySelector('.image-to-image-dialog');
      if (dialogElement && !dialogElement.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleSubmit = async () => {
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    try {
      await onSubmit(prompt.trim(), selectedImages);
    } catch (error) {
      console.error('图生图提交失败:', error);
    } finally {
      // 重置loading状态，以便下次使用
      setIsLoading(false);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPrompt(event.target.value);
  };

  return createPortal(
    <div
      className="image-to-image-dialog"
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex: 1000,
      }}
    >
      <button
        className="image-to-image-dialog__close"
        onClick={onClose}
        disabled={isLoading}
        aria-label="关闭"
      >
        <X size={14} />
      </button>

      <div className="image-to-image-dialog__input-group">
        <input
          ref={inputRef}
          type="text"
          className="image-to-image-dialog__input"
          placeholder="输入你的提示词"
          value={prompt}
          onChange={handleInputChange}
          disabled={isLoading}
        />
        <button
          className="image-to-image-dialog__submit"
          onClick={handleSubmit}
          disabled={!prompt.trim() || isLoading}
        >
          {isLoading ? (
            <div className="image-to-image-dialog__loading">
              <div className="image-to-image-dialog__spinner" />
            </div>
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>
    </div>,
    document.body
  );
};
