import { EventClassifierService } from '../event-classifier.service';
import { BusinessEventService } from '../business-event.service';

// Mock dependencies
jest.mock('../business-event.service');

describe('EventClassifierService', () => {
  let eventClassifier: EventClassifierService;
  let mockBusinessEventService: jest.Mocked<BusinessEventService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBusinessEventService = new BusinessEventService({} as any) as jest.Mocked<BusinessEventService>;
    eventClassifier = new EventClassifierService(mockBusinessEventService);
  });

  describe('Automatic Event Type Classification', () => {
    test('should classify price-related events based on keywords', async () => {
      // RED: This test should fail - EventClassifierService doesn't exist yet
      const eventDescriptions = [
        'Price increase of 10% across all products',
        'We have reduced prices by 15% for summer sale',
        'Cost adjustment due to inflation',
        'New pricing tiers introduced',
        'Discount offers available this week'
      ];

      for (const description of eventDescriptions) {
        const classification = await eventClassifier.classifyEventType(description);
        expect(classification.primaryType).toBe('price_change');
        expect(classification.confidence).toBeGreaterThan(0.5);
      }
    });

    test('should classify outage events based on keywords', async () => {
      // RED: This test should fail - outage classification not implemented
      const eventDescriptions = [
        'Complete system outage for 3 hours',
        'Service downtime scheduled for maintenance',
        'Platform unavailable due to technical issues',
        'API endpoints experiencing intermittent failures',
        'Website offline for emergency repairs'
      ];

      for (const description of eventDescriptions) {
        const classification = await eventClassifier.classifyEventType(description);
        expect(classification.primaryType).toBe('system_outage');
        expect(classification.confidence).toBeGreaterThan(0.5);
      }
    });

    test('should classify feature launch events', async () => {
      // RED: This test should fail - feature launch classification not implemented
      const eventDescriptions = [
        'New dashboard feature launched for premium users',
        'Introducing advanced analytics capabilities',
        'Beta release of mobile app now available',
        'We have added new reporting functionality',
        'Product update: Enhanced security features'
      ];

      for (const description of eventDescriptions) {
        const classification = await eventClassifier.classifyEventType(description);
        expect(classification.primaryType).toBe('feature_launch');
        expect(classification.confidence).toBeGreaterThan(0.5);
      }
    });

    test('should provide multiple type suggestions with confidence scores', async () => {
      // RED: This test should fail - multi-type classification not implemented
      const ambiguousDescription = 'Due to system upgrade, prices will be adjusted and service may be interrupted';
      
      const classification = await eventClassifier.classifyEventType(ambiguousDescription, {
        includeAlternatives: true
      });

      expect(classification.primaryType).toBeDefined();
      expect(classification.alternatives).toBeDefined();
      expect(classification.alternatives.length).toBeGreaterThan(0);
      
      // Should identify both system_outage and price_change
      const types = [classification.primaryType, ...classification.alternatives.map(alt => alt.type)];
      expect(types).toContain('system_outage');
      expect(types).toContain('price_change');
    });

    test('should handle unknown/ambiguous event types', async () => {
      // RED: This test should fail - unknown type handling not implemented
      const unknownDescription = 'The weather today is sunny and warm';
      
      const classification = await eventClassifier.classifyEventType(unknownDescription);
      
      expect(classification.primaryType).toBe('other');
      expect(classification.confidence).toBeLessThan(0.5);
      expect(classification.suggestedCustomType).toBeDefined();
    });
  });

  describe('Confidence Scoring and Thresholds', () => {
    test('should calculate confidence based on keyword density', async () => {
      // RED: This test should fail - confidence calculation not implemented
      const strongMatch = 'URGENT: Complete system outage affecting all services. Outage expected to last 4 hours.';
      const weakMatch = 'There might be some issues with the system today';
      
      const strongClassification = await eventClassifier.classifyEventType(strongMatch);
      const weakClassification = await eventClassifier.classifyEventType(weakMatch);
      
      expect(strongClassification.confidence).toBeGreaterThan(0.6);
      expect(weakClassification.confidence).toBeLessThan(0.6);
    });

    test('should respect custom confidence thresholds', async () => {
      // RED: This test should fail - custom threshold not implemented
      const description = 'Minor price adjustment for select items';
      
      const strictClassification = await eventClassifier.classifyEventType(description, {
        minConfidence: 0.9
      });
      
      const lenientClassification = await eventClassifier.classifyEventType(description, {
        minConfidence: 0.3
      });
      
      // With high threshold, should return 'other' due to low confidence
      expect(strictClassification.primaryType).toBe('other');
      expect(strictClassification.reason).toContain('confidence below threshold');
      
      // With low threshold, should return 'price_change'
      expect(lenientClassification.primaryType).toBe('price_change');
    });
  });

  describe('Manual Override and Learning', () => {
    test('should allow manual override of classification', async () => {
      // RED: This test should fail - manual override not implemented
      const description = 'New terms of service effective next month';
      
      // Initial classification
      const autoClassification = await eventClassifier.classifyEventType(description);
      expect(autoClassification.primaryType).toBe('policy_change');
      
      // Override classification
      await eventClassifier.overrideClassification(description, 'regulatory_change', {
        reason: 'Legal team classified as regulatory',
        userId: 'user123'
      });
      
      // Future classification should respect override
      const newClassification = await eventClassifier.classifyEventType(description);
      expect(newClassification.primaryType).toBe('regulatory_change');
      expect(newClassification.overridden).toBe(true);
      expect(newClassification.overrideReason).toBe('Legal team classified as regulatory');
    });

    test('should track classification history for learning', async () => {
      // RED: This test should fail - history tracking not implemented
      const descriptions = [
        'Service maintenance window scheduled',
        'Platform upgrade in progress',
        'System updates being applied'
      ];
      
      // Classify multiple similar events
      for (const desc of descriptions) {
        await eventClassifier.classifyEventType(desc);
      }
      
      // Get classification statistics
      const stats = await eventClassifier.getClassificationStats();
      
      expect(stats.totalClassifications).toBe(3);
      expect(stats.typeDistribution['system_outage']).toBe(3);
      expect(stats.averageConfidence).toBeGreaterThan(0.5);
    });
  });

  describe('Custom Patterns and Rules', () => {
    test('should support custom classification patterns', async () => {
      // RED: This test should fail - custom patterns not implemented
      await eventClassifier.addCustomPattern({
        name: 'data_breach',
        patterns: [
          /security\s+incident/i,
          /data\s+breach/i,
          /unauthorized\s+access/i,
          /compromised\s+accounts/i
        ],
        keywords: ['breach', 'security', 'compromised', 'unauthorized'],
        confidence: 0.9
      });
      
      const description = 'Security incident detected - some user accounts may be compromised';
      const classification = await eventClassifier.classifyEventType(description);
      
      expect(classification.primaryType).toBe('data_breach');
      expect(classification.confidence).toBeGreaterThan(0.7);
    });

    test('should prioritize custom patterns over default ones', async () => {
      // RED: This test should fail - pattern priority not implemented
      await eventClassifier.addCustomPattern({
        name: 'planned_maintenance',
        patterns: [/scheduled\s+maintenance/i],
        keywords: ['scheduled', 'maintenance', 'planned'],
        confidence: 0.95,
        priority: 10 // Higher priority
      });
      
      const description = 'Scheduled maintenance will cause system downtime';
      const classification = await eventClassifier.classifyEventType(description);
      
      // Should choose planned_maintenance over system_outage due to priority
      expect(classification.primaryType).toBe('planned_maintenance');
    });
  });

  describe('Batch Classification', () => {
    test('should classify multiple events efficiently', async () => {
      // RED: This test should fail - batch classification not implemented
      const events = [
        { id: '1', description: 'Price increase announcement' },
        { id: '2', description: 'System maintenance tonight' },
        { id: '3', description: 'New feature release notes' },
        { id: '4', description: 'Service disruption alert' }
      ];
      
      const classifications = await eventClassifier.classifyBatch(events);
      
      expect(classifications).toHaveLength(4);
      expect(classifications[0].id).toBe('1');
      expect(classifications[0].classification.primaryType).toBe('price_change');
      expect(classifications[1].classification.primaryType).toBe('system_outage');
      expect(classifications[2].classification.primaryType).toBe('feature_launch');
      expect(classifications[3].classification.primaryType).toBe('service_disruption');
    });

    test('should handle batch classification errors gracefully', async () => {
      // RED: This test should fail - error handling not implemented
      const events = [
        { id: '1', description: 'Valid description' },
        { id: '2', description: null as any }, // Invalid
        { id: '3', description: 'Another valid description' }
      ];
      
      const classifications = await eventClassifier.classifyBatch(events, {
        continueOnError: true
      });
      
      expect(classifications).toHaveLength(3);
      expect(classifications[1].error).toBeDefined();
      expect(classifications[1].error.message).toContain('Invalid description');
      expect(classifications[0].classification).toBeDefined();
      expect(classifications[2].classification).toBeDefined();
    });
  });

  describe('Integration with BusinessEventService', () => {
    test('should suggest event type when creating business event', async () => {
      // RED: This test should fail - integration not implemented
      const eventData = {
        eventDate: '2024-06-23',
        description: 'Emergency maintenance due to critical security patch',
        affectedCustomers: ['CUST-001', 'CUST-002']
      };
      
      const suggestion = await eventClassifier.suggestEventType(eventData);
      
      expect(suggestion).toEqual({
        suggestedType: 'system_outage',
        confidence: expect.any(Number),
        alternatives: expect.arrayContaining([
          { type: 'service_disruption', confidence: expect.any(Number) }
        ]),
        keywords: expect.arrayContaining(['emergency', 'maintenance'])
      });
    });

    test('should validate event type consistency', async () => {
      // RED: This test should fail - validation not implemented
      const result = await eventClassifier.validateEventTypeConsistency(
        'price_change',
        'System will be offline for maintenance'
      );
      
      expect(result.isConsistent).toBe(false);
      expect(result.suggestedType).toBe('system_outage');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.warning).toContain('Description suggests system_outage');
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});