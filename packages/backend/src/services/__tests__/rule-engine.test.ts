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

  describe('Action execution', () => {
    test('should execute actions when conditions met', () => {
      // Arrange
      const mockEmailAction = jest.fn();
      const mockCRMAction = jest.fn();
      
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
        },
        actions: [
          {
            type: 'email',
            handler: mockEmailAction,
            config: {
              to: 'account_manager@company.com',
              subject: 'High-value customer at risk'
            }
          },
          {
            type: 'createTask',
            handler: mockCRMAction,
            config: {
              taskName: 'High-value customer at risk',
              priority: 'high'
            }
          }
        ]
      };

      const data = {
        customerLifetimeValue: 1500,
        sentimentScore: 35,
        customerId: 'CUST-12345'
      };

      // Act
      ruleEngine.executeRule(rule, data);

      // Assert
      expect(mockEmailAction).toHaveBeenCalledWith({
        to: 'account_manager@company.com',
        subject: 'High-value customer at risk'
      }, data);
      expect(mockCRMAction).toHaveBeenCalledWith({
        taskName: 'High-value customer at risk',
        priority: 'high'
      }, data);
    });

    test('should not execute actions when conditions not met', () => {
      // Arrange
      const mockEmailAction = jest.fn();
      
      const rule = {
        conditions: {
          operator: 'AND',
          rules: [
            {
              field: 'customerLifetimeValue',
              operator: 'greaterThan',
              value: 1000
            }
          ]
        },
        actions: [
          {
            type: 'email',
            handler: mockEmailAction,
            config: {
              to: 'account_manager@company.com'
            }
          }
        ]
      };

      const data = {
        customerLifetimeValue: 500, // Doesn't meet condition
        customerId: 'CUST-12345'
      };

      // Act
      ruleEngine.executeRule(rule, data);

      // Assert
      expect(mockEmailAction).not.toHaveBeenCalled();
    });
  });

  describe('Comparison operators', () => {
    test.each([
      ['equals', 'status', 'active', 'active', true],
      ['equals', 'status', 'active', 'inactive', false],
      ['notEquals', 'status', 'active', 'inactive', true],
      ['notEquals', 'status', 'active', 'active', false],
      ['greaterThanOrEquals', 'amount', 100, 100, true],
      ['greaterThanOrEquals', 'amount', 100, 150, true],
      ['greaterThanOrEquals', 'amount', 100, 50, false],
      ['lessThanOrEquals', 'amount', 100, 100, true],
      ['lessThanOrEquals', 'amount', 100, 50, true],
      ['lessThanOrEquals', 'amount', 100, 150, false],
    ])('should evaluate %s operator correctly', (operator, field, value, dataValue, expected) => {
      // Arrange
      const rule = {
        conditions: {
          operator: 'AND',
          rules: [
            {
              field,
              operator,
              value
            }
          ]
        }
      };

      const data = {
        [field]: dataValue
      };

      // Act
      const result = ruleEngine.evaluate(rule, data);

      // Assert
      expect(result).toBe(expected);
    });
  });
});