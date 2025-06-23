import * as duckdb from 'duckdb';

export interface AutomationRule {
  id?: string;
  name: string;
  conditions: string; // JSON string
  actions: string; // JSON string
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface TriggerExecution {
  id?: string;
  rule_id: string;
  triggered_at?: Date;
  customer_id: string;
  actions_taken: string; // JSON string
  success: boolean;
}

export class AutomationRulesSchema {
  constructor(private db: duckdb.Database) {}

  async createTables(): Promise<void> {
    // Create automation_rules table
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS automation_rules (
        id VARCHAR PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name VARCHAR(255) NOT NULL,
        conditions TEXT NOT NULL,
        actions TEXT NOT NULL,
        is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create trigger_executions table
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS trigger_executions (
        id VARCHAR PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        rule_id VARCHAR NOT NULL,
        triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        customer_id VARCHAR(255) NOT NULL,
        actions_taken TEXT NOT NULL,
        success BOOLEAN NOT NULL,
        FOREIGN KEY (rule_id) REFERENCES automation_rules(id)
      )
    `);

    // Create index for performance
    await this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_trigger_executions_rule_id 
      ON trigger_executions(rule_id)
    `);

    await this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_trigger_executions_customer_id 
      ON trigger_executions(customer_id)
    `);
  }

  async createRule(rule: Omit<AutomationRule, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const id = this.generateId();
    await this.db.run(`
      INSERT INTO automation_rules (id, name, conditions, actions, is_active)
      VALUES (?, ?, ?, ?, ?)
    `, [id, rule.name, rule.conditions, rule.actions, rule.is_active]);
    
    return id;
  }

  async getRule(id: string): Promise<AutomationRule> {
    const result = await this.db.all(`
      SELECT * FROM automation_rules WHERE id = ?
    `, [id]);
    
    return result[0];
  }

  async updateRuleStatus(id: string, isActive: boolean): Promise<void> {
    await this.db.run(`
      UPDATE automation_rules 
      SET is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [isActive, id]);
  }

  async getActiveRules(): Promise<AutomationRule[]> {
    return await this.db.all(`
      SELECT * FROM automation_rules 
      WHERE is_active = true
      ORDER BY created_at DESC
    `);
  }

  async recordExecution(execution: Omit<TriggerExecution, 'id' | 'triggered_at'>): Promise<string> {
    const id = this.generateId();
    await this.db.run(`
      INSERT INTO trigger_executions (id, rule_id, customer_id, actions_taken, success)
      VALUES (?, ?, ?, ?, ?)
    `, [id, execution.rule_id, execution.customer_id, execution.actions_taken, execution.success]);
    
    return id;
  }

  async getExecution(id: string): Promise<TriggerExecution> {
    const result = await this.db.all(`
      SELECT * FROM trigger_executions WHERE id = ?
    `, [id]);
    
    return result[0];
  }

  private generateId(): string {
    // Simple UUID v4 generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}