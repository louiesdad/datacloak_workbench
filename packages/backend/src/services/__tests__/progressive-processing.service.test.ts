import { ProgressiveProcessor } from '../progressive-processing.service';
import { DataCloakService } from '../datacloak.service';
import { EventEmitter } from 'events';

// Mock dependencies
jest.mock('../datacloak.service');

describe('Progressive Processing', () => {
  let processor: ProgressiveProcessor;
  let mockDataCloak: jest.Mocked<DataCloakService>;
  let progressEvents: EventEmitter;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDataCloak = {
      maskFields: jest.fn()
    } as any;
    progressEvents = new EventEmitter();
    
    processor = new ProgressiveProcessor(mockDataCloak);
  });

  describe('Quick Preview Processing', () => {
    test('should process first 1000 rows within 5 minutes', async () => {
      // Arrange
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        fieldName: `field${i}`,
        text: `Sample text ${i} with email${i}@example.com`
      }));

      const startTime = Date.now();

      // Act - This method doesn't exist yet
      const previewResult = await processor.processPreview(largeDataset);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Assert
      expect(previewResult.rowsProcessed).toBe(1000);
      expect(previewResult.totalRows).toBe(10000);
      expect(processingTime).toBeLessThan(5 * 60 * 1000); // Less than 5 minutes
      expect(previewResult.results).toHaveLength(1000);
      expect(previewResult.isComplete).toBe(false);
      expect(previewResult.previewType).toBe('quick');
    });

    test('should handle datasets smaller than 1000 rows', async () => {
      // Arrange
      const smallDataset = Array.from({ length: 500 }, (_, i) => ({
        fieldName: `field${i}`,
        text: `Sample text ${i}`
      }));

      // Act - This method doesn't exist yet
      const previewResult = await processor.processPreview(smallDataset);

      // Assert
      expect(previewResult.rowsProcessed).toBe(500);
      expect(previewResult.totalRows).toBe(500);
      expect(previewResult.isComplete).toBe(true);
      expect(previewResult.results).toHaveLength(500);
    });
  });

  describe('Progress Event Emission', () => {
    test('should emit progress events every 1000 rows', async () => {
      // Arrange
      const dataset = Array.from({ length: 5000 }, (_, i) => ({
        fieldName: `field${i}`,
        text: `Text ${i}`
      }));

      const progressUpdates: any[] = [];
      
      // Subscribe to progress events - method doesn't exist yet
      processor.on('progress', (update) => {
        progressUpdates.push(update);
      });

      // Act
      await processor.processFull(dataset);

      // Assert
      expect(progressUpdates.length).toBeGreaterThanOrEqual(5); // At least 5 updates for 5000 rows
      expect(progressUpdates[0].processedRows).toBe(1000);
      expect(progressUpdates[1].processedRows).toBe(2000);
      expect(progressUpdates[progressUpdates.length - 1].processedRows).toBe(5000);
    });

    test('should include progress percentage in events', async () => {
      // Arrange
      const dataset = Array.from({ length: 2000 }, (_, i) => ({
        fieldName: `field${i}`,
        text: `Text ${i}`
      }));

      let lastProgress: any;
      processor.on('progress', (update) => {
        lastProgress = update;
      });

      // Act
      await processor.processFull(dataset);

      // Assert
      expect(lastProgress).toBeDefined();
      expect(lastProgress.percentage).toBe(100);
      expect(lastProgress.processedRows).toBe(2000);
      expect(lastProgress.totalRows).toBe(2000);
    });

    test('should emit completion event when finished', async () => {
      // Arrange
      const dataset = Array.from({ length: 100 }, (_, i) => ({
        fieldName: `field${i}`,
        text: `Text ${i}`
      }));

      let completionEvent: any;
      processor.on('complete', (event) => {
        completionEvent = event;
      });

      // Act
      await processor.processFull(dataset);

      // Assert
      expect(completionEvent).toBeDefined();
      expect(completionEvent.totalProcessed).toBe(100);
      expect(completionEvent.processingTime).toBeGreaterThan(0);
      expect(completionEvent.status).toBe('completed');
    });
  });

  describe('Statistical Sampling', () => {
    test('should calculate statistical sample with 95% confidence', async () => {
      // Arrange
      const dataset = Array.from({ length: 100000 }, (_, i) => ({
        fieldName: `field${i}`,
        text: `Text ${i} with varying sentiment`
      }));

      // Act - This method doesn't exist yet
      const sampleResult = await processor.processStatisticalSample(dataset);

      // Assert
      expect(sampleResult.sampleSize).toBe(10000); // 10% sample for large datasets
      expect(sampleResult.confidenceLevel).toBe(0.95);
      expect(sampleResult.marginOfError).toBeLessThanOrEqual(0.05);
      expect(sampleResult.results).toHaveLength(10000);
      expect(sampleResult.isStatisticallyValid).toBe(true);
    });

    test('should use stratified sampling for better representation', async () => {
      // Arrange - dataset with known distribution
      const dataset = [
        ...Array.from({ length: 3000 }, () => ({ fieldName: 'positive', text: 'Great product!' })),
        ...Array.from({ length: 5000 }, () => ({ fieldName: 'neutral', text: 'It is okay.' })),
        ...Array.from({ length: 2000 }, () => ({ fieldName: 'negative', text: 'Bad experience.' }))
      ];

      // Act
      const sampleResult = await processor.processStatisticalSample(dataset, {
        stratifyBy: 'fieldName'
      });

      // Assert - sample should maintain proportions
      const positiveSamples = sampleResult.results.filter(r => r.fieldName === 'positive').length;
      const neutralSamples = sampleResult.results.filter(r => r.fieldName === 'neutral').length;
      const negativeSamples = sampleResult.results.filter(r => r.fieldName === 'negative').length;

      const totalSamples = positiveSamples + neutralSamples + negativeSamples;
      
      expect(Math.abs(positiveSamples / totalSamples - 0.3)).toBeLessThan(0.05); // ~30%
      expect(Math.abs(neutralSamples / totalSamples - 0.5)).toBeLessThan(0.05); // ~50%
      expect(Math.abs(negativeSamples / totalSamples - 0.2)).toBeLessThan(0.05); // ~20%
    });

    test('should complete statistical sample within 30 minutes', async () => {
      // Arrange
      const dataset = Array.from({ length: 50000 }, (_, i) => ({
        fieldName: `field${i}`,
        text: `Text ${i} with content`
      }));

      const startTime = Date.now();

      // Act
      const sampleResult = await processor.processStatisticalSample(dataset);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Assert
      expect(processingTime).toBeLessThan(30 * 60 * 1000); // Less than 30 minutes
      expect(sampleResult.processingTime).toBe(processingTime);
    });
  });

  describe('Progressive Processing Options', () => {
    test('should support pause and resume functionality', async () => {
      // Arrange
      const dataset = Array.from({ length: 5000 }, (_, i) => ({
        fieldName: `field${i}`,
        text: `Text ${i}`
      }));

      let processedBeforePause = 0;
      processor.on('progress', (update) => {
        if (update.processedRows >= 2000 && processedBeforePause === 0) {
          processor.pause();
          processedBeforePause = update.processedRows;
        }
      });

      // Act
      const processPromise = processor.processFull(dataset);
      
      // Wait a bit then resume
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(processor.isPaused()).toBe(true);
      
      processor.resume();
      const result = await processPromise;

      // Assert
      expect(processedBeforePause).toBeGreaterThanOrEqual(2000);
      expect(result.totalProcessed).toBe(5000);
    });

    test('should allow cancellation of processing', async () => {
      // Arrange
      const dataset = Array.from({ length: 10000 }, (_, i) => ({
        fieldName: `field${i}`,
        text: `Text ${i}`
      }));

      let cancelledAt = 0;
      processor.on('progress', (update) => {
        if (update.processedRows >= 3000) {
          processor.cancel();
          cancelledAt = update.processedRows;
        }
      });

      // Act & Assert
      await expect(processor.processFull(dataset)).rejects.toThrow('Processing cancelled');
      expect(cancelledAt).toBeGreaterThanOrEqual(3000);
      expect(cancelledAt).toBeLessThan(10000);
    });

    test('should save partial results on cancellation', async () => {
      // Arrange
      const dataset = Array.from({ length: 5000 }, (_, i) => ({
        fieldName: `field${i}`,
        text: `Text ${i}`
      }));

      processor.on('progress', (update) => {
        if (update.processedRows >= 2000) {
          processor.cancel();
        }
      });

      // Act
      try {
        await processor.processFull(dataset);
      } catch (error) {
        // Expected cancellation
      }

      const partialResults = await processor.getPartialResults();

      // Assert
      expect(partialResults).toBeDefined();
      expect(partialResults.results.length).toBeGreaterThanOrEqual(2000);
      expect(partialResults.status).toBe('cancelled');
    });
  });

  describe('Processing Modes', () => {
    test('should support different processing priorities', async () => {
      // Arrange
      const dataset = Array.from({ length: 1000 }, (_, i) => ({
        fieldName: `field${i}`,
        text: `Text ${i}`
      }));

      // Act - Test different priority modes
      const quickResult = await processor.process(dataset, { mode: 'quick' });
      const balancedResult = await processor.process(dataset, { mode: 'balanced' });
      const thoroughResult = await processor.process(dataset, { mode: 'thorough' });

      // Assert
      expect(quickResult.processingTime).toBeLessThan(balancedResult.processingTime);
      expect(balancedResult.processingTime).toBeLessThan(thoroughResult.processingTime);
      expect(thoroughResult.accuracy).toBeGreaterThan(quickResult.accuracy);
    });
  });

  describe('Error Handling', () => {
    test('should handle processing errors gracefully', async () => {
      // Arrange
      const dataset = Array.from({ length: 100 }, (_, i) => ({
        fieldName: `field${i}`,
        text: i === 50 ? null : `Text ${i}` // Invalid data at position 50
      }));

      // Act
      const result = await processor.processFull(dataset, { continueOnError: true });

      // Assert
      expect(result.totalProcessed).toBe(100);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].index).toBe(50);
      expect(result.successfulRows).toBe(99);
    });

    test('should emit error events for failed rows', async () => {
      // Arrange
      const dataset = [
        { fieldName: 'field1', text: 'Valid text' },
        { fieldName: 'field2', text: null },
        { fieldName: 'field3', text: 'Another valid text' }
      ];

      const errors: any[] = [];
      processor.on('error', (error) => {
        errors.push(error);
      });

      // Act
      await processor.processFull(dataset, { continueOnError: true });

      // Assert
      expect(errors).toHaveLength(1);
      expect(errors[0].index).toBe(1);
      expect(errors[0].fieldName).toBe('field2');
    });
  });

  describe('Integration with DataCloak', () => {
    test('should use DataCloak maskFields for batch processing', async () => {
      // Arrange
      const dataset = Array.from({ length: 100 }, (_, i) => ({
        fieldName: `field${i}`,
        text: `Text ${i}`
      }));

      mockDataCloak.maskFields.mockResolvedValue(
        dataset.map((field, i) => ({
          fieldName: field.fieldName,
          originalText: field.text,
          maskedText: `Masked ${field.text}`,
          piiItemsFound: 1,
          success: true
        }))
      );

      // Act
      const result = await processor.processFull(dataset);

      // Assert
      expect(mockDataCloak.maskFields).toHaveBeenCalled();
      expect(result.results).toHaveLength(100);
      expect(result.results[0].maskedText).toContain('Masked');
    });
  });
});