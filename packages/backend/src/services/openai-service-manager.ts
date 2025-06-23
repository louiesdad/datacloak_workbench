import { OpenAIService, OpenAIConfig } from './openai.service';
import { ConfigService } from './config.service';
import { getCacheService } from './cache.service';

/**
 * Singleton manager for OpenAI service
 * Ensures all parts of the application use the same instance
 * so logs and stats are properly shared
 */
class OpenAIServiceManager {
  private static instance: OpenAIServiceManager;
  private openaiService: OpenAIService | null = null;
  private configService: ConfigService;

  private constructor() {
    this.configService = ConfigService.getInstance();
    this.initializeService();
    
    // Listen for config updates
    this.configService.on('config.updated', async (event) => {
      if (event.key && event.key.toString().startsWith('OPENAI_')) {
        console.log('OpenAI configuration updated, reinitializing service...');
        this.initializeService();
      }
    });
  }

  static getInstance(): OpenAIServiceManager {
    if (!OpenAIServiceManager.instance) {
      OpenAIServiceManager.instance = new OpenAIServiceManager();
    }
    return OpenAIServiceManager.instance;
  }

  private initializeService(): void {
    if (!this.configService.isOpenAIConfigured()) {
      console.log('OpenAI not configured');
      this.openaiService = null;
      return;
    }

    try {
      const config = this.configService.getOpenAIConfig();
      
      if (!config.apiKey) {
        throw new Error('OpenAI API key is not configured');
      }
      
      const openaiConfig: OpenAIConfig = {
        apiKey: config.apiKey,
        model: config.model || 'gpt-3.5-turbo',
        maxTokens: config.maxTokens || 150,
        temperature: config.temperature || 0.1,
        timeout: config.timeout || 30000,
        enableCache: true,
        cacheService: getCacheService(),
        cacheTTL: 3600
      };

      this.openaiService = new OpenAIService(openaiConfig);
      console.log('OpenAI service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OpenAI service:', error);
      this.openaiService = null;
    }
  }

  getService(): OpenAIService | null {
    return this.openaiService;
  }

  isConfigured(): boolean {
    return this.openaiService !== null;
  }
}

// Export singleton instance getter
export const getOpenAIServiceInstance = (): OpenAIService | null => {
  return OpenAIServiceManager.getInstance().getService();
};

export const isOpenAIConfigured = (): boolean => {
  return OpenAIServiceManager.getInstance().isConfigured();
};