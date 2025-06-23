import { RuleEngine } from '../rule-engine.service';

describe('Rule Engine', () => {
  let ruleEngine: RuleEngine;

  beforeEach(() => {
    ruleEngine = new RuleEngine();
  });

  describe('AND conditions', () => {
    test('should evaluate AND conditions correctly', () => {
      // Arrange
      const rule = {
        conditions: {
          operator: 'AND',
          rules: [
            {
              field: 'customerLifetimeValue',
              operator: 'greaterThan',
              value: 1000
            },
            {
              field: 'sentimentScore',
              operator: 'lessThan',
              value: 40
            }
          ]
        }
      };

      const data = {
        customerLifetimeValue: 1500,
        sentimentScore: 35
      };

      // Act
      const result = ruleEngine.evaluate(rule, data);

      // Assert
      expect(result).toBe(true);
    });

    test('should return false when any AND condition fails', () => {
      // Arrange
      const rule = {
        conditions: {
          operator: 'AND',
          rules: [
            {
              field: 'customerLifetimeValue',
              operator: 'greaterThan',
              value: 1000
            },
            {
              field: 'sentimentScore',
              operator: 'lessThan',
              value: 40
            }
          ]
        }
      };

      const data = {
        customerLifetimeValue: 500, // This fails the first condition
        sentimentScore: 35
      };

      // Act
      const result = ruleEngine.evaluate(rule, data);

      // Assert
      expect(result).toBe(false);
    });
  });
});