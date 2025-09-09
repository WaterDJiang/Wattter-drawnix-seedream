import React, { useState, useRef, useEffect } from 'react';
import { Island } from '../island';
import classNames from 'classnames';
import { useI18n } from '../../i18n';
import { ToolButton } from '../tool-button';
import { SendIcon } from '../icons';
import './ai-input.scss';

export interface AIInputProps {
  className?: string;
  placeholder?: string;
  maxRows?: number;
  onSubmit?: (message: string) => void;
}

export const AIInput: React.FC<AIInputProps> = ({
  className,
  placeholder = "Ask AI anything about your drawing...",
  maxRows = 4,
  onSubmit,
}) => {
  const { t } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
      const maxHeight = lineHeight * maxRows;
      
      if (scrollHeight > maxHeight) {
        textarea.style.height = maxHeight + 'px';
        textarea.style.overflowY = 'auto';
      } else {
        textarea.style.height = scrollHeight + 'px';
        textarea.style.overflowY = 'hidden';
      }
    }
  }, [inputValue, maxRows]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() && !isLoading) {
        handleSubmit();
      }
    }
  };

  const handleSubmit = async () => {
    if (inputValue.trim() && !isLoading) {
      setIsLoading(true);
      
      try {
        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (onSubmit) {
          onSubmit(inputValue.trim());
        }
        
        // For demo purposes, show an alert
        alert(`AI received: "${inputValue.trim()}"\n\nIn a real implementation, this would connect to your AI service.`);
        
      } catch (error) {
        console.error('AI processing error:', error);
      } finally {
        setIsLoading(false);
      }
      
      setInputValue('');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  return (
    <div className={classNames('ai-input-container', className)}>
      <Island className="ai-input-island" padding={0}>
        <div className="ai-input-wrapper">
          <textarea
            ref={textareaRef}
            className="ai-input"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={isLoading}
            aria-label={t('ai.input.placeholder') || placeholder}
          />
          
          <ToolButton
            type="icon"
            className={classNames('ai-send-button', { 'ai-loading': isLoading })}
            onPointerUp={handleSubmit}
            disabled={!inputValue.trim() || isLoading}
            icon={SendIcon}
            title={t('ai.input.send') || 'Send message'}
            aria-label={t('ai.input.send') || 'Send message'}
          />
        </div>
      </Island>
    </div>
  );
};