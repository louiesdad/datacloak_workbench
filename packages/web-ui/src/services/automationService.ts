export interface AutomationRule {
  id?: string;
  name: string;
  conditions: {
    operator: 'AND' | 'OR';
    rules: Condition[];
  };
  actions: Action[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Condition {
  field: string;
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'greaterThanOrEquals' | 'lessThanOrEquals';
  value: any;
}

export interface Action {
  type: 'email' | 'createTask' | 'slack' | 'webhook';
  config: any;
}

export interface TestResult {
  triggered: boolean;
  message: string;
  details?: any;
}

export interface RuleStatistics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
}

class AutomationService {
  private baseUrl = '/api/automation';

  async createRule(rule: Omit<AutomationRule, 'id'>): Promise<AutomationRule> {
    const response = await fetch(`${this.baseUrl}/rules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: rule.name,
        conditions: rule.conditions,
        actions: rule.actions,
        is_active: rule.isActive,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create rule');
    }

    const data = await response.json();
    return this.formatRule(data.data);
  }

  async updateRule(id: string, rule: Partial<AutomationRule>): Promise<AutomationRule> {
    const response = await fetch(`${this.baseUrl}/rules/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: rule.name,
        conditions: rule.conditions,
        actions: rule.actions,
        is_active: rule.isActive,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update rule');
    }

    const data = await response.json();
    return this.formatRule(data.data);
  }

  async deleteRule(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/rules/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete rule');
    }
  }

  async getRules(): Promise<AutomationRule[]> {
    const response = await fetch(`${this.baseUrl}/rules`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch rules');
    }

    const data = await response.json();
    return data.data.map((rule: any) => this.formatRule(rule));
  }

  async getRule(id: string): Promise<AutomationRule> {
    const response = await fetch(`${this.baseUrl}/rules/${id}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch rule');
    }

    const data = await response.json();
    return this.formatRule(data.data);
  }

  async activateRule(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/rules/${id}/activate`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to activate rule');
    }
  }

  async deactivateRule(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/rules/${id}/deactivate`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to deactivate rule');
    }
  }

  async testRule(id: string, testData: any): Promise<TestResult> {
    const response = await fetch(`${this.baseUrl}/rules/${id}/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to test rule');
    }

    const data = await response.json();
    return {
      triggered: data.data.triggered,
      message: data.data.triggered 
        ? 'Rule would trigger for this data' 
        : 'Rule would not trigger for this data',
      details: data.data
    };
  }

  async testRuleData(ruleData: Omit<AutomationRule, 'id'>, testData: any): Promise<TestResult> {
    // For testing rule data without saving, we'll create a temporary rule
    // In a real implementation, this might be a separate endpoint
    try {
      const tempRule = await this.createRule({ ...ruleData, isActive: false });
      const result = await this.testRule(tempRule.id!, testData);
      await this.deleteRule(tempRule.id!);
      return result;
    } catch (error) {
      throw new Error('Failed to test rule data');
    }
  }

  async getRuleStatistics(id: string): Promise<RuleStatistics> {
    const response = await fetch(`${this.baseUrl}/rules/${id}/statistics`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch rule statistics');
    }

    const data = await response.json();
    return data.data;
  }

  async evaluateCustomer(customerData: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customerData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to evaluate customer');
    }

    const data = await response.json();
    return data.data;
  }

  // Utility methods for the UI
  async getFields(): Promise<string[]> {
    // In a real implementation, this would fetch available fields from the backend
    // For now, return common fields
    return [
      'customerLifetimeValue',
      'sentimentScore',
      'daysSinceLastOrder',
      'supportTickets',
      'orderFrequency',
      'averageOrderValue',
      'churRisk',
      'satisfactionScore',
      'engagementLevel',
      'lastContactDate'
    ];
  }

  async getTemplates(): Promise<Array<{ id: string; name: string; description?: string }>> {
    // Return predefined rule templates
    return [
      { 
        id: 'customer-at-risk', 
        name: 'Customer at Risk',
        description: 'High-value customer with declining sentiment'
      },
      { 
        id: 'upsell-opportunity', 
        name: 'Upsell Opportunity',
        description: 'Satisfied customer with high engagement'
      },
      { 
        id: 'churn-prevention', 
        name: 'Churn Prevention',
        description: 'Customer showing early churn signals'
      },
      { 
        id: 'loyalty-reward', 
        name: 'Loyalty Reward',
        description: 'Long-term customer deserving recognition'
      }
    ];
  }

  private formatRule(apiRule: any): AutomationRule {
    return {
      id: apiRule.id,
      name: apiRule.name,
      conditions: apiRule.conditions,
      actions: apiRule.actions,
      isActive: apiRule.isActive,
      createdAt: apiRule.createdAt,
      updatedAt: apiRule.updatedAt,
    };
  }
}

export const automationService = new AutomationService();