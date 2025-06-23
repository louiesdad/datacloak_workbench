import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export interface AutomationRule {
  id?: string;
  name: string;
  conditions: string; // JSON string
  actions: string; // JSON string
  is_active: number; // SQLite uses 0/1 for boolean
  created_at?: string;
  updated_at?: string;
}

export interface TriggerExecution {
  id?: string;
  rule_id: string;
  triggered_at?: string;
  customer_id: string;
  actions_taken: string; // JSON string
  success: number; // SQLite uses 0/1 for boolean
}

export class AutomationRulesSQLiteSchema {
  constructor(private db: Database.Database) {}

  createTables(): void {
    // Create automation_rules table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS automation_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        conditions TEXT NOT NULL,
        actions TEXT NOT NULL,
        is_active INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create trigger_executions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trigger_executions (
        id TEXT PRIMARY KEY,
        rule_id TEXT NOT NULL,
        triggered_at TEXT DEFAULT CURRENT_TIMESTAMP,
        customer_id TEXT NOT NULL,
        actions_taken TEXT NOT NULL,
        success INTEGER NOT NULL,
        FOREIGN KEY (rule_id) REFERENCES automation_rules(id)
      )
    `);

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_trigger_executions_rule_id 
      ON trigger_executions(rule_id);
      
      CREATE INDEX IF NOT EXISTS idx_trigger_executions_customer_id 
      ON trigger_executions(customer_id);
      
      CREATE INDEX IF NOT EXISTS idx_automation_rules_active
      ON automation_rules(is_active);
    `);
  }

  createRule(rule: Omit<AutomationRule, 'id' | 'created_at' | 'updated_at'>): string {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO automation_rules (id, name, conditions, actions, is_active)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, rule.name, rule.conditions, rule.actions, rule.is_active);
    return id;
  }

  getRule(id: string): AutomationRule | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM automation_rules WHERE id = ?
    `);
    
    return stmt.get(id) as AutomationRule | undefined;
  }

  updateRuleStatus(id: string, isActive: number): void {
    const stmt = this.db.prepare(`
      UPDATE automation_rules 
      SET is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(isActive, id);
  }

  getActiveRules(): AutomationRule[] {
    const stmt = this.db.prepare(`
      SELECT * FROM automation_rules 
      WHERE is_active = 1
      ORDER BY created_at DESC
    `);
    
    return stmt.all() as AutomationRule[];
  }

  deleteRule(id: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM automation_rules WHERE id = ?
    `);
    
    stmt.run(id);
  }

  recordExecution(execution: Omit<TriggerExecution, 'id' | 'triggered_at'>): string {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO trigger_executions (id, rule_id, customer_id, actions_taken, success)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, execution.rule_id, execution.customer_id, execution.actions_taken, execution.success);
    return id;
  }

  getExecution(id: string): TriggerExecution | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM trigger_executions WHERE id = ?
    `);
    
    return stmt.get(id) as TriggerExecution | undefined;
  }

  getExecutionsByRule(ruleId: string): TriggerExecution[] {
    const stmt = this.db.prepare(`
      SELECT * FROM trigger_executions 
      WHERE rule_id = ?
      ORDER BY triggered_at DESC
    `);
    
    return stmt.all(ruleId) as TriggerExecution[];
  }

  getExecutionsByCustomer(customerId: string): TriggerExecution[] {
    const stmt = this.db.prepare(`
      SELECT * FROM trigger_executions 
      WHERE customer_id = ?
      ORDER BY triggered_at DESC
    `);
    
    return stmt.all(customerId) as TriggerExecution[];
  }

  // Utility method to get execution statistics
  getExecutionStats(ruleId: string): { total: number; successful: number; failed: number } {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed
      FROM trigger_executions
      WHERE rule_id = ?
    `);
    
    const result = stmt.get(ruleId) as any;
    return {
      total: result.total || 0,
      successful: result.successful || 0,
      failed: result.failed || 0
    };
  }
}