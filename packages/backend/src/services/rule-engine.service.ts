export interface Condition {
  field: string;
  operator: 'greaterThan' | 'lessThan' | 'equals' | 'notEquals' | 'greaterThanOrEquals' | 'lessThanOrEquals';
  value: any;
}

export interface RuleGroup {
  operator: 'AND' | 'OR';
  rules: Condition[];
}

export interface Action {
  type: string;
  handler: (config: any, data: any) => void;
  config: any;
}

export interface Rule {
  conditions: RuleGroup;
  actions?: Action[];
}

export class RuleEngine {
  evaluate(rule: Rule, data: Record<string, any>): boolean {
    const { conditions } = rule;
    
    if (conditions.operator === 'AND') {
      return conditions.rules.every(condition => this.evaluateCondition(condition, data));
    } else if (conditions.operator === 'OR') {
      return conditions.rules.some(condition => this.evaluateCondition(condition, data));
    }
    
    return false;
  }

  private evaluateCondition(condition: Condition, data: Record<string, any>): boolean {
    const { field, operator, value } = condition;
    const fieldValue = data[field];

    switch (operator) {
      case 'greaterThan':
        return fieldValue > value;
      case 'lessThan':
        return fieldValue < value;
      case 'equals':
        return fieldValue === value;
      case 'notEquals':
        return fieldValue !== value;
      case 'greaterThanOrEquals':
        return fieldValue >= value;
      case 'lessThanOrEquals':
        return fieldValue <= value;
      default:
        return false;
    }
  }

  executeRule(rule: Rule, data: Record<string, any>): void {
    if (this.evaluate(rule, data) && rule.actions) {
      rule.actions.forEach(action => {
        action.handler(action.config, data);
      });
    }
  }
}