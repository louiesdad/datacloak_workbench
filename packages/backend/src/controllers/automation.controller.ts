import { Request, Response } from 'express';
import { AutomationEngine, CustomerData } from '../services/automation-engine.service';
import { AutomationRulesSQLiteSchema } from '../database/schemas/automation-rules-sqlite.schema';

export interface CreateRuleRequest {
  name: string;
  conditions: any;
  actions: any[];
  is_active?: boolean;
}

export interface UpdateRuleRequest {
  name?: string;
  conditions?: any;
  actions?: any[];
  is_active?: boolean;
}

export class AutomationController {
  constructor(
    private automationEngine: AutomationEngine,
    private schema: AutomationRulesSQLiteSchema
  ) {}

  async createRule(req: Request, res: Response): Promise<void> {
    try {
      const { name, conditions, actions, is_active = true }: CreateRuleRequest = req.body;

      // Validation
      if (!name || !conditions || !actions) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: name, conditions, and actions are required for rule validation'
        });
        return;
      }

      if (!Array.isArray(actions)) {
        res.status(400).json({
          success: false,
          error: 'Actions must be an array for proper validation'
        });
        return;
      }

      // Create rule in database
      const ruleId = this.schema.createRule({
        name,
        conditions: JSON.stringify(conditions),
        actions: JSON.stringify(actions),
        is_active: is_active ? 1 : 0
      });

      // Retrieve the created rule
      const createdRule = this.schema.getRule(ruleId);
      
      if (!createdRule) {
        res.status(500).json({
          success: false,
          error: 'Failed to create rule'
        });
        return;
      }

      // Format response
      const formattedRule = this.formatRuleForResponse(createdRule);

      res.status(201).json({
        success: true,
        data: formattedRule
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }

  async getAllRules(req: Request, res: Response): Promise<void> {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      
      let rules;
      if (includeInactive) {
        // For now, we only have getActiveRules. In a real implementation,
        // we'd need a getAllRules method in the schema
        rules = this.schema.getActiveRules();
      } else {
        rules = this.schema.getActiveRules();
      }

      const formattedRules = rules.map(rule => this.formatRuleForResponse(rule));

      res.json({
        success: true,
        data: formattedRules
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }

  async getRule(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const rule = this.schema.getRule(id);

      if (!rule) {
        res.status(404).json({
          success: false,
          error: 'Rule not found'
        });
        return;
      }

      const formattedRule = this.formatRuleForResponse(rule);

      res.json({
        success: true,
        data: formattedRule
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }

  async updateRule(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates: UpdateRuleRequest = req.body;

      // Check if rule exists
      const existingRule = this.schema.getRule(id);
      if (!existingRule) {
        res.status(404).json({
          success: false,
          error: 'Rule not found'
        });
        return;
      }

      // For simplicity, we'll just handle status updates for now
      // A full implementation would need an updateRule method in the schema
      if (updates.is_active !== undefined) {
        this.schema.updateRuleStatus(id, updates.is_active ? 1 : 0);
      }

      const updatedRule = this.schema.getRule(id);
      const formattedRule = this.formatRuleForResponse(updatedRule!);

      res.json({
        success: true,
        data: formattedRule
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }

  async deleteRule(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if rule exists
      const existingRule = this.schema.getRule(id);
      if (!existingRule) {
        res.status(404).json({
          success: false,
          error: 'Rule not found'
        });
        return;
      }

      this.schema.deleteRule(id);

      res.json({
        success: true,
        message: 'Rule deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }

  async activateRule(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.automationEngine.activateRule(id);

      res.json({
        success: true,
        message: 'Rule activated successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }

  async deactivateRule(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.automationEngine.deactivateRule(id);

      res.json({
        success: true,
        message: 'Rule deactivated successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }

  async testRule(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const testData: CustomerData = req.body;

      const result = await this.automationEngine.testRule(id, testData);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }

  async getRuleStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const statistics = await this.automationEngine.getRuleStatistics(id);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }

  async getRuleExecutions(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const executions = this.schema.getExecutionsByRule(id);

      const formattedExecutions = executions.map(execution => ({
        id: execution.id,
        customerId: execution.customer_id,
        triggeredAt: execution.triggered_at,
        success: execution.success === 1,
        actionsTaken: JSON.parse(execution.actions_taken)
      }));

      res.json({
        success: true,
        data: formattedExecutions
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }

  async evaluateCustomer(req: Request, res: Response): Promise<void> {
    try {
      const customerData: CustomerData = req.body;

      // Validation
      if (!customerData.customerId) {
        res.status(400).json({
          success: false,
          error: 'customerId is required for customer evaluation'
        });
        return;
      }

      const results = await this.automationEngine.evaluateCustomer(customerData);

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }

  private formatRuleForResponse(rule: any) {
    return {
      id: rule.id,
      name: rule.name,
      conditions: JSON.parse(rule.conditions),
      actions: JSON.parse(rule.actions),
      isActive: rule.is_active === 1,
      createdAt: rule.created_at,
      updatedAt: rule.updated_at
    };
  }
}