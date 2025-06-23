import { RuleEngine, Rule } from './rule-engine.service';
import { ActionIntegrationService, ActionConfig } from './action-integration.service';
import { AutomationRulesSQLiteSchema, AutomationRule } from '../database/schemas/automation-rules-sqlite.schema';

export interface CustomerData {
  customerId: string;
  [key: string]: any;
}

export interface EvaluationResult {
  ruleId: string;
  ruleName: string;
  triggered: boolean;
  error?: string;
  actions?: any[];
}

export interface RuleStatistics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
}

export class AutomationEngine {
  constructor(
    private ruleEngine: RuleEngine,
    private actionService: ActionIntegrationService,
    private schema: AutomationRulesSQLiteSchema
  ) {}

  async evaluateCustomer(customerData: CustomerData): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];
    const activeRules = this.schema.getActiveRules();

    for (const dbRule of activeRules) {
      try {
        const rule = this.convertDbRuleToRule(dbRule);
        const triggered = this.ruleEngine.evaluate(rule, customerData);

        const result: EvaluationResult = {
          ruleId: dbRule.id!,
          ruleName: dbRule.name,
          triggered,
        };

        if (triggered && rule.actions) {
          try {
            const actionResults = await this.actionService.executeBatch(rule.actions, customerData);
            result.actions = actionResults;

            // Record execution
            await this.recordExecution(dbRule.id!, customerData.customerId, actionResults);
          } catch (error) {
            result.error = error instanceof Error ? error.message : 'Unknown error';
            result.triggered = false;

            // Record failed execution
            await this.recordExecution(dbRule.id!, customerData.customerId, [], false, result.error);
          }
        }

        results.push(result);
      } catch (error) {
        results.push({
          ruleId: dbRule.id!,
          ruleName: dbRule.name,
          triggered: false,
          error: error instanceof Error ? error.message : 'Rule evaluation error'
        });
      }
    }

    return results;
  }

  async evaluateBatch(customers: CustomerData[]): Promise<EvaluationResult[]> {
    const allResults: EvaluationResult[] = [];

    for (const customer of customers) {
      try {
        const customerResults = await this.evaluateCustomer(customer);
        allResults.push(...customerResults);
      } catch (error) {
        // Add error result for this customer
        allResults.push({
          ruleId: 'batch-error',
          ruleName: 'Batch Processing Error',
          triggered: false,
          error: error instanceof Error ? error.message : 'Batch processing error'
        });
      }
    }

    return allResults;
  }

  async activateRule(ruleId: string): Promise<void> {
    this.schema.updateRuleStatus(ruleId, 1);
  }

  async deactivateRule(ruleId: string): Promise<void> {
    this.schema.updateRuleStatus(ruleId, 0);
  }

  async getRuleStatistics(ruleId: string): Promise<RuleStatistics> {
    const stats = this.schema.getExecutionStats(ruleId);
    
    return {
      totalExecutions: stats.total,
      successfulExecutions: stats.successful,
      failedExecutions: stats.failed,
      successRate: stats.total > 0 ? stats.successful / stats.total : 0
    };
  }

  private convertDbRuleToRule(dbRule: AutomationRule): Rule {
    return {
      conditions: JSON.parse(dbRule.conditions),
      actions: JSON.parse(dbRule.actions) as ActionConfig[]
    };
  }

  private async recordExecution(
    ruleId: string, 
    customerId: string, 
    actionResults: any[] = [], 
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    const actionsData = errorMessage 
      ? actionResults.concat([{ error: errorMessage }])
      : actionResults;

    // Determine overall success
    const overallSuccess = success && actionResults.every(result => result.success);

    this.schema.recordExecution({
      rule_id: ruleId,
      customer_id: customerId,
      actions_taken: JSON.stringify(actionsData),
      success: overallSuccess ? 1 : 0
    });
  }

  // Utility methods for testing and monitoring
  async getActiveRulesCount(): Promise<number> {
    return this.schema.getActiveRules().length;
  }

  async getRecentExecutions(limit: number = 100): Promise<any[]> {
    // This would need a new method in the schema, but for now return empty
    return [];
  }

  async testRule(ruleId: string, testData: CustomerData): Promise<EvaluationResult> {
    const dbRule = this.schema.getRule(ruleId);
    if (!dbRule) {
      throw new Error(`Rule not found: ${ruleId}`);
    }

    const rule = this.convertDbRuleToRule(dbRule);
    const triggered = this.ruleEngine.evaluate(rule, testData);

    return {
      ruleId: dbRule.id!,
      ruleName: dbRule.name,
      triggered
    };
  }
}