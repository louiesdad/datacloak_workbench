/**
 * Test to verify ConfigService integration with SentimentService
 */

import { SentimentService } from '../services/sentiment.service';
import { ConfigService } from '../services/config.service';

async function testConfigIntegration() {
  console.log('Testing ConfigService integration with SentimentService...\n');

  // Get ConfigService instance
  const configService = ConfigService.getInstance();
  
  // Create SentimentService instance
  const sentimentService = new SentimentService();
  
  // Test 1: Check initial OpenAI configuration
  console.log('1. Checking initial OpenAI configuration:');
  const isConfigured = configService.isOpenAIConfigured();
  console.log(`   - OpenAI configured: ${isConfigured}`);
  
  if (isConfigured) {
    const config = configService.getOpenAIConfig();
    console.log(`   - Model: ${config.model}`);
    console.log(`   - Max tokens: ${config.maxTokens}`);
    console.log(`   - Temperature: ${config.temperature}`);
    console.log(`   - Timeout: ${config.timeout}ms`);
  }
  
  // Test 2: Test configuration update
  console.log('\n2. Testing configuration update:');
  try {
    const updateResult = await sentimentService.updateOpenAIConfig({
      model: 'gpt-4',
      maxTokens: 200,
      temperature: 0.2
    });
    
    console.log(`   - Update result: ${updateResult.success ? 'SUCCESS' : 'FAILED'}`);
    if (!updateResult.success) {
      console.log(`   - Error: ${updateResult.error}`);
    }
    
    // Verify the configuration was updated
    const updatedConfig = configService.getOpenAIConfig();
    console.log(`   - Updated model: ${updatedConfig.model}`);
    console.log(`   - Updated max tokens: ${updatedConfig.maxTokens}`);
    console.log(`   - Updated temperature: ${updatedConfig.temperature}`);
    
  } catch (error) {
    console.error('   - Error updating configuration:', error);
  }
  
  // Test 3: Test configuration event listener
  console.log('\n3. Testing configuration event listener:');
  console.log('   - Manually updating OpenAI model through ConfigService...');
  
  // Set up a listener to track if the event was fired
  let eventFired = false;
  configService.once('config.updated', (event) => {
    if (event.key === 'OPENAI_MODEL') {
      eventFired = true;
      console.log(`   - Event fired! Old value: ${event.oldValue}, New value: ${event.newValue}`);
    }
  });
  
  // Update configuration directly through ConfigService
  await configService.update('OPENAI_MODEL', 'gpt-3.5-turbo');
  
  // Give the event listener time to fire
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log(`   - Event listener ${eventFired ? 'worked correctly' : 'did not fire'}`);
  
  // Clean up
  console.log('\n4. Cleaning up:');
  sentimentService.destroy();
  console.log('   - Removed event listeners');
  
  console.log('\n✅ ConfigService integration test completed!');
}

// Run the test if executed directly
if (require.main === module) {
  testConfigIntegration()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export { testConfigIntegration };