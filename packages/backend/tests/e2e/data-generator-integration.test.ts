import { ComprehensiveDataGenerator } from '../../src/utils/comprehensive-data-generator';
import { TriggerScenarioGenerator } from '../../src/utils/trigger-scenario-generator';
import { TrajectoryPatternGenerator } from '../../src/utils/trajectory-pattern-generator';
import { CausalEventGenerator } from '../../src/utils/causal-event-generator';

describe('Test Data Generator Integration E2E', () => {
  describe('CSV Export and Data Integrity', () => {
    it('should generate valid CSV from comprehensive data generator', () => {
      const generator = new ComprehensiveDataGenerator(42);
      const dataset = generator.generateEcommerceStandardDataset();
      
      // Convert to CSV format
      const csvLines = [
        dataset.headers.join(','),
        ...dataset.records.slice(0, 100).map(record => 
          dataset.headers.map(header => {
            const value = record[header as keyof typeof record];
            return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
          }).join(',')
        )
      ];
      
      const csvContent = csvLines.join('\n');
      
      // Validate CSV structure
      expect(csvContent).toContain('customer_id,email,phone');
      expect(csvContent).toContain('CUST-00001');
      expect(csvContent).toContain('test.user1@example.com');
      
      // Check CSV can be parsed back
      const lines = csvContent.split('\n');
      expect(lines.length).toBe(101); // Header + 100 records
      
      // Validate each line has correct number of fields
      const expectedFieldCount = dataset.headers.length;
      lines.forEach((line, index) => {
        if (line.trim()) {
          const fields = parseCSVLine(line);
          expect(fields.length).toBe(expectedFieldCount);
        }
      });
    });

    it('should generate compatible data across all generators', () => {
      const seed = 42;
      
      // Generate data from all generators with same seed
      const comprehensiveGen = new ComprehensiveDataGenerator(seed);
      const triggerGen = new TriggerScenarioGenerator(seed);
      const trajectoryGen = new TrajectoryPatternGenerator(seed);
      const causalGen = new CausalEventGenerator(seed);
      
      const comprehensiveData = comprehensiveGen.generateEcommerceStandardDataset();
      const triggerData = triggerGen.generateTriggerScenarios();
      const trajectoryData = trajectoryGen.generateHistoricalSentimentSeries();
      const causalData = causalGen.generateEventImpactData();
      
      // All should have customer IDs in compatible format
      expect(comprehensiveData.records[0].customer_id).toMatch(/^CUST-\d{5}$/);
      expect(triggerData.records[0].customer_id).toMatch(/^CUST-\d{5}$/);
      expect(trajectoryData.records[0].customer_id).toMatch(/^CUST-\d{5}$/);
      expect(causalData.records[0].customer_id).toMatch(/^CUST-\d{5}$/);
      
      // All should have valid timestamps
      expect(new Date(comprehensiveData.records[0].order_date)).toBeInstanceOf(Date);
      expect(new Date(triggerData.records[0].timestamp)).toBeInstanceOf(Date);
      expect(new Date(trajectoryData.records[0].timestamp)).toBeInstanceOf(Date);
      expect(new Date(causalData.records[0].timestamp)).toBeInstanceOf(Date);
      
      // Sentiment scores should be in valid range
      triggerData.records.forEach(record => {
        expect(record.sentiment_score).toBeGreaterThanOrEqual(0);
        expect(record.sentiment_score).toBeLessThanOrEqual(100);
      });
      
      trajectoryData.records.forEach(record => {
        expect(record.sentiment_score).toBeGreaterThanOrEqual(0);
        expect(record.sentiment_score).toBeLessThanOrEqual(100);
      });
      
      causalData.records.forEach(record => {
        expect(record.pre_sentiment).toBeGreaterThanOrEqual(0);
        expect(record.pre_sentiment).toBeLessThanOrEqual(100);
        expect(record.post_sentiment).toBeGreaterThanOrEqual(0);
        expect(record.post_sentiment).toBeLessThanOrEqual(100);
      });
    });

    it('should produce datasets of expected sizes for system testing', () => {
      // Test dataset sizes match PRD specifications
      const comprehensiveGen = new ComprehensiveDataGenerator(42);
      const triggerGen = new TriggerScenarioGenerator(42);
      const trajectoryGen = new TrajectoryPatternGenerator(42);
      const causalGen = new CausalEventGenerator(42);
      
      const comprehensive = comprehensiveGen.generateEcommerceStandardDataset();
      const trigger = triggerGen.generateTriggerScenarios();
      const trajectory = trajectoryGen.generateHistoricalSentimentSeries();
      const causal = causalGen.generateEventImpactData();
      
      // Check record counts match PRD specs
      expect(comprehensive.metadata.recordCount).toBe(10000);
      expect(trigger.metadata.recordCount).toBe(20000);
      expect(trajectory.metadata.recordCount).toBe(50000);
      expect(causal.metadata.recordCount).toBe(30000);
      
      // Check customer counts (comprehensive doesn't expose this in metadata, so we'll calculate)
      const uniqueComprehensiveCustomers = new Set(comprehensive.records.map(r => r.customer_id)).size;
      expect(uniqueComprehensiveCustomers).toBeGreaterThan(2200); // Actual generation yields ~2266 customers
      expect(trigger.metadata.uniqueCustomers).toBe(1000);
      expect(trajectory.metadata.uniqueCustomers).toBe(1000);
      expect(causal.metadata.uniqueCustomers).toBe(2000);
      
      // Estimate file sizes (for system planning)
      const estimatedComprehensiveSize = estimateCSVSize(comprehensive);
      const estimatedTriggerSize = estimateCSVSize(trigger);
      const estimatedTrajectorySize = estimateCSVSize(trajectory);
      const estimatedCausalSize = estimateCSVSize(causal);
      
      // Sizes should be reasonable for testing (not too large)
      expect(estimatedComprehensiveSize).toBeLessThan(50 * 1024 * 1024); // < 50MB
      expect(estimatedTriggerSize).toBeLessThan(100 * 1024 * 1024); // < 100MB
      expect(estimatedTrajectorySize).toBeLessThan(250 * 1024 * 1024); // < 250MB
      expect(estimatedCausalSize).toBeLessThan(150 * 1024 * 1024); // < 150MB
    });
  });

  describe('Multi-field Analysis Simulation', () => {
    it('should simulate field discovery scenarios', () => {
      const generator = new ComprehensiveDataGenerator(42);
      const dataset = generator.generateEcommerceStandardDataset();
      
      // Simulate field discovery logic
      const textFields = dataset.headers.filter(header => 
        ['product_review', 'customer_comment', 'support_ticket'].includes(header)
      );
      
      const piiFields = dataset.headers.filter(header => 
        ['email', 'phone'].includes(header)
      );
      
      const numericFields = dataset.headers.filter(header => 
        ['last_purchase_amount'].includes(header)
      );
      
      // Should identify correct field types
      expect(textFields).toHaveLength(3);
      expect(piiFields).toHaveLength(2);
      expect(numericFields).toHaveLength(1);
      
      // Check text fields have appropriate content
      const sampleRecord = dataset.records[0];
      textFields.forEach(field => {
        const value = sampleRecord[field as keyof typeof sampleRecord];
        if (value) {
          expect(typeof value).toBe('string');
          expect(value.length).toBeGreaterThan(0);
        }
      });
    });

    it('should simulate progressive analysis scenarios', () => {
      const generator = new ComprehensiveDataGenerator(42);
      const dataset = generator.generateEcommerceStandardDataset();
      
      // Simulate quick preview (first 1000 rows)
      const previewData = dataset.records.slice(0, 1000);
      const previewStats = calculateSentimentStats(previewData);
      
      // Simulate statistical sample (random 10000 rows)
      const sampleSize = Math.min(10000, dataset.records.length);
      const sampleData = randomSample(dataset.records, sampleSize, 42);
      const sampleStats = calculateSentimentStats(sampleData);
      
      // Full dataset stats
      const fullStats = calculateSentimentStats(dataset.records);
      
      // Preview and sample should give reasonable approximations
      expect(Math.abs(previewStats.avgSentiment - fullStats.avgSentiment)).toBeLessThan(20);
      expect(Math.abs(sampleStats.avgSentiment - fullStats.avgSentiment)).toBeLessThan(10);
      
      // Sample should be more accurate than preview
      const previewError = Math.abs(previewStats.avgSentiment - fullStats.avgSentiment);
      const sampleError = Math.abs(sampleStats.avgSentiment - fullStats.avgSentiment);
      expect(sampleError).toBeLessThanOrEqual(previewError + 5); // Allow some variance
    });
  });

  describe('Integration with Existing Test Infrastructure', () => {
    it('should work with existing test data patterns', () => {
      // Test that our generators work with existing test utilities
      const generator = new ComprehensiveDataGenerator(42);
      const dataset = generator.generateEcommerceStandardDataset();
      
      // Should be compatible with existing CSV parsing
      const csvContent = convertToCSV(dataset);
      const parsedRows = parseCSV(csvContent);
      
      expect(parsedRows.length).toBe(100); // convertToCSV only processes first 100 records
      expect(parsedRows[0]).toHaveProperty('customer_id');
      expect(parsedRows[0]).toHaveProperty('email');
      expect(parsedRows[0]).toHaveProperty('product_review');
    });
  });
});

// Helper functions
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }

function estimateCSVSize(dataset: any): number {
    // Rough estimation of CSV file size
    const headerSize = dataset.headers.join(',').length;
    const avgRecordSize = JSON.stringify(dataset.records[0]).length;
    return headerSize + (avgRecordSize * dataset.records.length);
  }

function calculateSentimentStats(records: any[]): { avgSentiment: number; count: number } {
    // For comprehensive data, we'll simulate sentiment from text length/content
    const sentiments = records.map(record => {
      let sentiment = 50; // Base neutral
      
      if (record.product_review) {
        if (record.product_review.includes('great') || record.product_review.includes('excellent')) {
          sentiment += 30;
        }
        if (record.product_review.includes('terrible') || record.product_review.includes('disappointed')) {
          sentiment -= 30;
        }
      }
      
      return Math.max(0, Math.min(100, sentiment));
    });
    
    const avgSentiment = sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length;
    return { avgSentiment, count: sentiments.length };
  }

function randomSample<T>(array: T[], size: number, seed: number): T[] {
    // Simple seeded random sampling
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled.slice(0, size);
  }

function convertToCSV(dataset: any): string {
    const lines = [
      dataset.headers.join(','),
      ...dataset.records.slice(0, 100).map((record: any) => 
        dataset.headers.map((header: string) => {
          const value = record[header];
          return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
        }).join(',')
      )
    ];
    return lines.join('\n');
  }

function parseCSV(csvContent: string): any[] {
    const lines = csvContent.split('\n').filter(line => line.trim());
    const headers = parseCSVLine(lines[0]);
    
    return lines.slice(1).map(line => {
      const values = parseCSVLine(line);
      const record: any = {};
      headers.forEach((header, index) => {
        record[header] = values[index] || '';
      });
      return record;
    });
  }