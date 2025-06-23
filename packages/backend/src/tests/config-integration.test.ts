/**
 * Configuration Integration Tests
 * Tests for configuration service integration with other components
 */

import { ConfigService } from '../services/config.service';

describe('Configuration Integration', () => {
  let configService: ConfigService;

  beforeEach(() => {
    configService = ConfigService.getInstance();
  });

  it('should integrate with configuration system', () => {
    expect(configService).toBeDefined();
    expect(typeof configService.get).toBe('function');
  });

  it('should handle environment configuration', () => {
    const nodeEnv = configService.get('NODE_ENV');
    expect(nodeEnv).toBeDefined();
  });

  it('should handle OpenAI configuration detection', () => {
    const isConfigured = configService.isOpenAIConfigured();
    expect(typeof isConfigured).toBe('boolean');
  });
});