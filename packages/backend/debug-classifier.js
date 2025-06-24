// Debug script to test the event classifier
const { EventClassifierService } = require('./dist/services/event-classifier.service');
const { BusinessEventService } = require('./dist/services/business-event.service');

async function testClassifier() {
  try {
    const mockBusinessEventService = new BusinessEventService({} as any);
    const classifier = new EventClassifierService(mockBusinessEventService);
    
    const testDescriptions = [
      'Price increase of 10% across all products',
      'Complete system outage for 3 hours',
      'New dashboard feature launched for premium users'
    ];
    
    for (const desc of testDescriptions) {
      console.log(`\nTesting: "${desc}"`);
      const result = await classifier.classifyEventType(desc, { includeAlternatives: true });
      console.log('Result:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testClassifier();