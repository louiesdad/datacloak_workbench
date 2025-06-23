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

  describe('OR conditions', () => {
    test('should evaluate OR conditions correctly', () => {
      // Arrange
      const rule = {
        conditions: {
          operator: 'OR',
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
        sentimentScore: 35 // But this passes the second condition
      };

      // Act
      const result = ruleEngine.evaluate(rule, data);

      // Assert
      expect(result).toBe(true); // Should be true because one condition passes
    });

    test('should return false when all OR conditions fail', () => {
      // Arrange
      const rule = {
        conditions: {
          operator: 'OR',
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
        customerLifetimeValue: 500, // Fails first condition
        sentimentScore: 50 // Fails second condition too
      };

      // Act
      const result = ruleEngine.evaluate(rule, data);

      // Assert
      expect(result).toBe(false);
    });
  });
});