import { TriggerScenarioGenerator } from '../trigger-scenario-generator';

describe('TriggerScenarioGenerator', () => {
  describe('generateTriggerScenarios', () => {
    it('should generate 20000 records for 1000 customers over 20 time periods', () => {
      const generator = new TriggerScenarioGenerator(42);
      const dataset = generator.generateTriggerScenarios();
      
      expect(dataset.metadata.recordCount).toBe(20000);
      expect(dataset.metadata.uniqueCustomers).toBe(1000);
      expect(dataset.metadata.timePeriods).toBe(20);
      expect(dataset.metadata.filename).toBe('test_trigger_scenarios_20k.csv');
    });

    it('should include all required scenario types', () => {
      const generator = new TriggerScenarioGenerator(42);
      const dataset = generator.generateTriggerScenarios();
      
      // Count scenario types
      const scenarioTypes = new Map<string, number>();
      dataset.records.forEach(record => {
        const type = record.scenario_type;
        scenarioTypes.set(type, (scenarioTypes.get(type) || 0) + 1);
      });

      // Should have all scenario types
      expect(scenarioTypes.has('sentiment_decline')).toBe(true);
      expect(scenarioTypes.has('sudden_drop')).toBe(true);
      expect(scenarioTypes.has('high_value_at_risk')).toBe(true);
      expect(scenarioTypes.has('false_positive')).toBe(true);
      expect(scenarioTypes.has('positive_trigger')).toBe(true);
    });

    it('should generate sentiment decline scenarios correctly', () => {
      const generator = new TriggerScenarioGenerator(42);
      const dataset = generator.generateTriggerScenarios();
      
      // Find sentiment decline customers
      const declineCustomers = new Set<string>();
      dataset.records.forEach(record => {
        if (record.scenario_type === 'sentiment_decline') {
          declineCustomers.add(record.customer_id);
        }
      });

      // Check that decline customers have proper pattern
      declineCustomers.forEach(customerId => {
        const customerRecords = dataset.records
          .filter(r => r.customer_id === customerId)
          .sort((a, b) => a.week_number - b.week_number);

        // First week should have high sentiment
        expect(customerRecords[0].sentiment_score).toBeGreaterThan(80);
        
        // Last weeks should have low sentiment
        const lastWeeks = customerRecords.slice(-5);
        const avgLastSentiment = lastWeeks.reduce((sum, r) => sum + r.sentiment_score, 0) / lastWeeks.length;
        expect(avgLastSentiment).toBeLessThan(30);
      });
    });

    it('should generate sudden drop scenarios correctly', () => {
      const generator = new TriggerScenarioGenerator(42);
      const dataset = generator.generateTriggerScenarios();
      
      // Find sudden drop customers
      const suddenDropCustomers = new Set<string>();
      dataset.records.forEach(record => {
        if (record.scenario_type === 'sudden_drop') {
          suddenDropCustomers.add(record.customer_id);
        }
      });

      // Check pattern for sudden drops
      let testedCustomers = 0;
      suddenDropCustomers.forEach(customerId => {
        if (testedCustomers++ < 5) { // Test only first 5 customers
          const customerRecords = dataset.records
            .filter(r => r.customer_id === customerId)
            .sort((a, b) => a.week_number - b.week_number);

          // Should find a week with significant drop
          let foundDrop = false;
          for (let i = 1; i < customerRecords.length; i++) {
            const prevSentiment = customerRecords[i-1].sentiment_score;
            const currSentiment = customerRecords[i].sentiment_score;
            if (prevSentiment - currSentiment > 40) {
              foundDrop = true;
              break;
            }
          }
          expect(foundDrop).toBe(true);
        }
      });
    });

    it('should have proper week progression', () => {
      const generator = new TriggerScenarioGenerator(42);
      const dataset = generator.generateTriggerScenarios();
      
      // Check each customer has all 20 weeks
      const customerWeeks = new Map<string, Set<number>>();
      dataset.records.forEach(record => {
        if (!customerWeeks.has(record.customer_id)) {
          customerWeeks.set(record.customer_id, new Set());
        }
        customerWeeks.get(record.customer_id)!.add(record.week_number);
      });

      customerWeeks.forEach((weeks, customerId) => {
        expect(weeks.size).toBe(20);
        // Check weeks are sequential from 1 to 20
        for (let i = 1; i <= 20; i++) {
          expect(weeks.has(i)).toBe(true);
        }
      });
    });
  });
});