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

const DEFAULT_CONFIG: Partial<ImageGenerationConfig> = {
  endpoint: 'http://localhost:3001/generate-image',
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
    const { prompt, image, maxImages = 3, size = '2K', watermark = true } = request;

    const requestBody = {
      prompt,
      ...(image && { image }),
      maxImages,
      size,
      watermark,
    };

    try {
      const response = await fetch(this.config.endpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
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

// 默认实例（需要在使用前设置API key）
export const imageGenerationAPI = new ImageGenerationAPI({
  apiKey: '30046952-67e8-42d3-aa44-d0da565c3bfb', // 从你的示例中获取
});