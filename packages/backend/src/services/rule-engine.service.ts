export interface Condition {
  field: string;
  operator: 'greaterThan' | 'lessThan' | 'equals' | 'notEquals' | 'greaterThanOrEquals' | 'lessThanOrEquals';
  value: any;
}

export interface RuleGroup {
  operator: 'AND' | 'OR';
  rules: Condition[];
}

export interface Rule {
  conditions: RuleGroup;
}

export class RuleEngine {
  evaluate(rule: Rule, data: Record<string, any>): boolean {
    const { conditions } = rule;
    
    if (conditions.operator === 'AND') {
      return conditions.rules.every(condition => this.evaluateCondition(condition, data));
    }
    
    return false; // For now, only implementing AND
  }

  private evaluateCondition(condition: Condition, data: Record<string, any>): boolean {
    const { field, operator, value } = condition;
    const fieldValue = data[field];

    switch (operator) {
      case 'greaterThan':
        return fieldValue > value;
      case 'lessThan':
        return fieldValue < value;
      default:
        return false;
    }
  }
}