export interface ImageGenerationConfig {
  apiKey: string;
  endpoint?: string;
  model?: string;
}

export interface ImageGenerationRequest {
  prompt: string;
  image?: string[];
  maxImages?: number;
  size?: string;
  watermark?: boolean;
}

export interface ImageGenerationResult {
  index: number;
  url: string;
  size: string;
}

export interface ImageGenerationResponse {
  images: ImageGenerationResult[];
  completed: boolean;
  error?: string;
}

// 根据环境决定API端点
const getDefaultEndpoint = () => {
  if (typeof window !== 'undefined') {
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocalDev ? 'http://localhost:3000/generate-image' : '/generate-image';
  }
  return '/generate-image';
};

const DEFAULT_CONFIG: Partial<ImageGenerationConfig> = {
  endpoint: getDefaultEndpoint(),
  model: 'doubao-seedream-4-0-250828',
};

export class ImageGenerationAPI {
  private config: ImageGenerationConfig;

  constructor(config: ImageGenerationConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async generateImages(
    request: ImageGenerationRequest,
    onProgress?: (result: ImageGenerationResult) => void
  ): Promise<ImageGenerationResponse> {
    const { prompt, image, maxImages = 3, size, watermark = true } = request;

    const requestBody = {
      prompt,
      ...(image && { image }),
      maxImages,
      size: size || '2K', // 使用传入的size，如果没有则默认为2K
      watermark,
      apiKey: this.config.apiKey, // 从配置中包含API密钥
      model: this.config.model, // 从配置中包含模型
    };

    console.log('Sending image generation request with size:', size, 'requestBody:', requestBody);

    try {
      const response = await fetch(this.config.endpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        
        if (response.status === 401) {
          errorMessage = 'API密钥无效或已过期，请检查设置中的API密钥配置';
        } else if (response.status === 403) {
          errorMessage = 'API访问被拒绝，请检查API密钥权限';
        } else if (response.status === 429) {
          errorMessage = 'API请求频率过高，请稍后重试';
        } else if (response.status >= 500) {
          errorMessage = 'API服务暂时不可用，请稍后重试';
        }
        
        throw new Error(errorMessage);
      }

      const images: ImageGenerationResult[] = [];
      const reader = response.body?.getReader();
      
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: image_generation.partial_succeeded')) {
            continue;
          }
          
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            
            if (dataStr === '[DONE]') {
              return { images, completed: true };
            }

            try {
              const data = JSON.parse(dataStr);
              
              if (data.type === 'image_generation.partial_succeeded') {
                const result: ImageGenerationResult = {
                  index: data.image_index,
                  url: data.url,
                  size: data.size,
                };
                
                images.push(result);
                
                if (onProgress) {
                  onProgress(result);
                }
              } else if (data.type === 'image_generation.completed') {
                return { images, completed: true };
              }
            } catch (e) {
              console.warn('Failed to parse SSE data:', dataStr);
            }
          }
        }
      }

      return { images, completed: true };
    } catch (error) {
      console.error('Image generation error:', error);
      return {
        images: [],
        completed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// 创建获取当前设置的函数
const getCurrentSettings = () => {
  try {
    const saved = localStorage.getItem('drawnix-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        apiKey: parsed.apiKey || '',
        endpoint: parsed.apiEndpoint || getDefaultEndpoint(),
        model: parsed.defaultModel || 'doubao-seedream-4-0-250828',
      };
    }
  } catch (error) {
    console.warn('Failed to load settings:', error);
  }
  return {
    apiKey: '',
    endpoint: getDefaultEndpoint(),
    model: 'doubao-seedream-4-0-250828',
  };
};

// 创建动态API实例
export const createImageGenerationAPI = (): ImageGenerationAPI => {
  const settings = getCurrentSettings();
  return new ImageGenerationAPI({
    apiKey: settings.apiKey,
    endpoint: settings.endpoint,
    model: settings.model,
  });
};

// 默认实例（为了向后兼容）
export const imageGenerationAPI = createImageGenerationAPI();