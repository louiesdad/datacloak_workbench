import { getSQLiteConnection } from '../database/sqlite';
import { AppError } from '../middleware/error.middleware';
import { v4 as uuidv4 } from 'uuid';
import { TransformValidationService, TransformOperation } from './transform-validation.service';

export interface SavedTransform {
  id: string;
  name: string;
  description?: string;
  operations: TransformOperation[];
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
  usageCount: number;
  tags?: string[];
  isPublic: boolean;
  userId?: string;
}

export interface TransformTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  operations: TransformOperation[];
  parameters?: Record<string, any>;
  example?: {
    input: any[];
    output: any[];
  };
}

export interface TransformHistory {
  id: string;
  transformId: string;
  executedAt: Date;
  duration: number;
  rowsProcessed: number;
  success: boolean;
  error?: string;
  inputSummary?: Record<string, any>;
  outputSummary?: Record<string, any>;
}

export class TransformPersistenceService {
  private validationService: TransformValidationService;

  constructor() {
    this.validationService = new TransformValidationService();
    this.initializeDatabase();
  }

  /**
   * Initialize database tables for transform persistence
   */
  private async initializeDatabase(): Promise<void> {
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    try {
      // Create saved transforms table
      db.exec(`
        CREATE TABLE IF NOT EXISTS saved_transforms (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          operations TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_used DATETIME,
          usage_count INTEGER DEFAULT 0,
          tags TEXT,
          is_public INTEGER DEFAULT 0,
          user_id TEXT
        )
      `);

      // Create transform history table
      db.exec(`
        CREATE TABLE IF NOT EXISTS transform_history (
          id TEXT PRIMARY KEY,
          transform_id TEXT,
          executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          duration INTEGER,
          rows_processed INTEGER,
          success INTEGER,
          error TEXT,
          input_summary TEXT,
          output_summary TEXT,
          FOREIGN KEY (transform_id) REFERENCES saved_transforms(id)
        )
      `);

      // Create transform templates table
      db.exec(`
        CREATE TABLE IF NOT EXISTS transform_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          category TEXT,
          operations TEXT NOT NULL,
          parameters TEXT,
          example TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for better performance
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_transforms_user ON saved_transforms(user_id);
        CREATE INDEX IF NOT EXISTS idx_transforms_public ON saved_transforms(is_public);
        CREATE INDEX IF NOT EXISTS idx_transforms_tags ON saved_transforms(tags);
        CREATE INDEX IF NOT EXISTS idx_history_transform ON transform_history(transform_id);
        CREATE INDEX IF NOT EXISTS idx_history_executed ON transform_history(executed_at);
      `);

    } catch (error) {
      console.error('Failed to initialize transform persistence database:', error);
      throw new AppError('Failed to initialize database', 500, 'DB_INIT_ERROR');
    }
  }

  /**
   * Save a transform configuration
   */
  async saveTransform(
    name: string,
    operations: TransformOperation[],
    options?: {
      description?: string;
      tags?: string[];
      isPublic?: boolean;
      userId?: string;
    }
  ): Promise<SavedTransform> {
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    // Validate all operations
    for (const operation of operations) {
      const validation = this.validationService.validateTransform(operation, []);
      if (!validation.valid) {
        throw new AppError(
          `Invalid transform operation: ${validation.errors.join(', ')}`,
          400,
          'INVALID_TRANSFORM'
        );
      }
    }

    const id = uuidv4();
    const now = new Date();

    try {
      const stmt = db.prepare(`
        INSERT INTO saved_transforms (
          id, name, description, operations, created_at, updated_at,
          tags, is_public, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        name,
        options?.description || null,
        JSON.stringify(operations),
        now.toISOString(),
        now.toISOString(),
        options?.tags ? JSON.stringify(options.tags) : null,
        options?.isPublic ? 1 : 0,
        options?.userId || null
      );

      return {
        id,
        name,
        description: options?.description,
        operations,
        createdAt: now,
        updatedAt: now,
        usageCount: 0,
        tags: options?.tags,
        isPublic: options?.isPublic || false,
        userId: options?.userId
      };

    } catch (error) {
      throw new AppError(
        `Failed to save transform: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'SAVE_ERROR'
      );
    }
  }

  /**
   * Get a saved transform by ID
   */
  async getTransform(id: string): Promise<SavedTransform | null> {
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    try {
      const stmt = db.prepare(`
        SELECT * FROM saved_transforms WHERE id = ?
      `);
      
      const row = stmt.get(id) as any;
      
      if (!row) {
        return null;
      }

      return this.mapRowToTransform(row);

    } catch (error) {
      throw new AppError(
        `Failed to get transform: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'GET_ERROR'
      );
    }
  }

  /**
   * List saved transforms
   */
  async listTransforms(options?: {
    userId?: string;
    isPublic?: boolean;
    tags?: string[];
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    transforms: SavedTransform[];
    total: number;
  }> {
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    try {
      let query = 'SELECT * FROM saved_transforms WHERE 1=1';
      let countQuery = 'SELECT COUNT(*) as total FROM saved_transforms WHERE 1=1';
      const params: any[] = [];
      const countParams: any[] = [];

      if (options?.userId !== undefined) {
        query += ' AND user_id = ?';
        countQuery += ' AND user_id = ?';
        params.push(options.userId);
        countParams.push(options.userId);
      }

      if (options?.isPublic !== undefined) {
        query += ' AND is_public = ?';
        countQuery += ' AND is_public = ?';
        params.push(options.isPublic ? 1 : 0);
        countParams.push(options.isPublic ? 1 : 0);
      }

      if (options?.search) {
        query += ' AND (name LIKE ? OR description LIKE ?)';
        countQuery += ' AND (name LIKE ? OR description LIKE ?)';
        const searchPattern = `%${options.search}%`;
        params.push(searchPattern, searchPattern);
        countParams.push(searchPattern, searchPattern);
      }

      // Order by last used and usage count
      query += ' ORDER BY last_used DESC, usage_count DESC';

      // Add pagination
      const limit = options?.limit || 20;
      const offset = options?.offset || 0;
      query += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);

      // Get total count
      const countStmt = db.prepare(countQuery);
      const { total } = countStmt.get(...countParams) as { total: number };

      // Get transforms
      const stmt = db.prepare(query);
      const rows = stmt.all(...params) as any[];

      const transforms = rows.map(row => this.mapRowToTransform(row));

      // Filter by tags if specified
      let filteredTransforms = transforms;
      if (options?.tags && options.tags.length > 0) {
        filteredTransforms = transforms.filter(transform =>
          transform.tags && options.tags!.some(tag => transform.tags!.includes(tag))
        );
      }

      return {
        transforms: filteredTransforms,
        total
      };

    } catch (error) {
      throw new AppError(
        `Failed to list transforms: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'LIST_ERROR'
      );
    }
  }

  /**
   * Update a saved transform
   */
  async updateTransform(
    id: string,
    updates: {
      name?: string;
      description?: string;
      operations?: TransformOperation[];
      tags?: string[];
      isPublic?: boolean;
    }
  ): Promise<SavedTransform | null> {
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    // Validate operations if provided
    if (updates.operations) {
      for (const operation of updates.operations) {
        const validation = this.validationService.validateTransform(operation, []);
        if (!validation.valid) {
          throw new AppError(
            `Invalid transform operation: ${validation.errors.join(', ')}`,
            400,
            'INVALID_TRANSFORM'
          );
        }
      }
    }

    try {
      const existingTransform = await this.getTransform(id);
      if (!existingTransform) {
        return null;
      }

      const setClause: string[] = ['updated_at = ?'];
      const params: any[] = [new Date().toISOString()];

      if (updates.name !== undefined) {
        setClause.push('name = ?');
        params.push(updates.name);
      }

      if (updates.description !== undefined) {
        setClause.push('description = ?');
        params.push(updates.description);
      }

      if (updates.operations !== undefined) {
        setClause.push('operations = ?');
        params.push(JSON.stringify(updates.operations));
      }

      if (updates.tags !== undefined) {
        setClause.push('tags = ?');
        params.push(JSON.stringify(updates.tags));
      }

      if (updates.isPublic !== undefined) {
        setClause.push('is_public = ?');
        params.push(updates.isPublic ? 1 : 0);
      }

      params.push(id);

      const stmt = db.prepare(`
        UPDATE saved_transforms
        SET ${setClause.join(', ')}
        WHERE id = ?
      `);

      stmt.run(...params);

      return this.getTransform(id);

    } catch (error) {
      throw new AppError(
        `Failed to update transform: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'UPDATE_ERROR'
      );
    }
  }

  /**
   * Delete a saved transform
   */
  async deleteTransform(id: string): Promise<boolean> {
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    try {
      // Delete history first due to foreign key constraint
      const historyStmt = db.prepare('DELETE FROM transform_history WHERE transform_id = ?');
      historyStmt.run(id);

      // Delete the transform
      const stmt = db.prepare('DELETE FROM saved_transforms WHERE id = ?');
      const result = stmt.run(id);

      return result.changes > 0;

    } catch (error) {
      throw new AppError(
        `Failed to delete transform: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'DELETE_ERROR'
      );
    }
  }

  /**
   * Record transform execution
   */
  async recordExecution(
    transformId: string,
    execution: {
      duration: number;
      rowsProcessed: number;
      success: boolean;
      error?: string;
      inputSummary?: Record<string, any>;
      outputSummary?: Record<string, any>;
    }
  ): Promise<void> {
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    try {
      // Record in history
      const historyStmt = db.prepare(`
        INSERT INTO transform_history (
          id, transform_id, executed_at, duration, rows_processed,
          success, error, input_summary, output_summary
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      historyStmt.run(
        uuidv4(),
        transformId,
        new Date().toISOString(),
        execution.duration,
        execution.rowsProcessed,
        execution.success ? 1 : 0,
        execution.error || null,
        execution.inputSummary ? JSON.stringify(execution.inputSummary) : null,
        execution.outputSummary ? JSON.stringify(execution.outputSummary) : null
      );

      // Update transform usage stats
      const updateStmt = db.prepare(`
        UPDATE saved_transforms
        SET last_used = ?, usage_count = usage_count + 1
        WHERE id = ?
      `);

      updateStmt.run(new Date().toISOString(), transformId);

    } catch (error) {
      // Log but don't throw - we don't want to fail the operation just because we couldn't record it
      console.error('Failed to record transform execution:', error);
    }
  }

  /**
   * Get transform execution history
   */
  async getExecutionHistory(
    transformId: string,
    limit: number = 10
  ): Promise<TransformHistory[]> {
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    try {
      const stmt = db.prepare(`
        SELECT * FROM transform_history
        WHERE transform_id = ?
        ORDER BY executed_at DESC
        LIMIT ?
      `);

      const rows = stmt.all(transformId, limit) as any[];

      return rows.map(row => ({
        id: row.id,
        transformId: row.transform_id,
        executedAt: new Date(row.executed_at),
        duration: row.duration,
        rowsProcessed: row.rows_processed,
        success: row.success === 1,
        error: row.error,
        inputSummary: row.input_summary ? JSON.parse(row.input_summary) : undefined,
        outputSummary: row.output_summary ? JSON.parse(row.output_summary) : undefined
      }));

    } catch (error) {
      throw new AppError(
        `Failed to get execution history: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'HISTORY_ERROR'
      );
    }
  }

  /**
   * Create a transform template
   */
  async createTemplate(template: Omit<TransformTemplate, 'id'>): Promise<TransformTemplate> {
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    const id = uuidv4();

    try {
      const stmt = db.prepare(`
        INSERT INTO transform_templates (
          id, name, description, category, operations, parameters, example
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        template.name,
        template.description,
        template.category,
        JSON.stringify(template.operations),
        template.parameters ? JSON.stringify(template.parameters) : null,
        template.example ? JSON.stringify(template.example) : null
      );

      return {
        id,
        ...template
      };

    } catch (error) {
      throw new AppError(
        `Failed to create template: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'CREATE_TEMPLATE_ERROR'
      );
    }
  }

  /**
   * Get available templates
   */
  async getTemplates(category?: string): Promise<TransformTemplate[]> {
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    try {
      let query = 'SELECT * FROM transform_templates';
      const params: any[] = [];

      if (category) {
        query += ' WHERE category = ?';
        params.push(category);
      }

      query += ' ORDER BY category, name';

      const stmt = db.prepare(query);
      const rows = stmt.all(...params) as any[];

      return rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        category: row.category,
        operations: JSON.parse(row.operations),
        parameters: row.parameters ? JSON.parse(row.parameters) : undefined,
        example: row.example ? JSON.parse(row.example) : undefined
      }));

    } catch (error) {
      throw new AppError(
        `Failed to get templates: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'GET_TEMPLATES_ERROR'
      );
    }
  }

  /**
   * Map database row to SavedTransform object
   */
  private mapRowToTransform(row: any): SavedTransform {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      operations: JSON.parse(row.operations),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastUsed: row.last_used ? new Date(row.last_used) : undefined,
      usageCount: row.usage_count,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      isPublic: row.is_public === 1,
      userId: row.user_id
    };
  }

  /**
   * Export transform as shareable configuration
   */
  async exportTransform(id: string): Promise<{
    name: string;
    description?: string;
    operations: TransformOperation[];
    version: string;
    exportedAt: Date;
  }> {
    const transform = await this.getTransform(id);
    
    if (!transform) {
      throw new AppError('Transform not found', 404, 'NOT_FOUND');
    }

    return {
      name: transform.name,
      description: transform.description,
      operations: transform.operations,
      version: '1.0',
      exportedAt: new Date()
    };
  }

  /**
   * Import transform from configuration
   */
  async importTransform(
    config: {
      name: string;
      description?: string;
      operations: TransformOperation[];
    },
    options?: {
      userId?: string;
      tags?: string[];
    }
  ): Promise<SavedTransform> {
    // Add imported tag
    const tags = [...(options?.tags || []), 'imported'];

    return this.saveTransform(
      config.name,
      config.operations,
      {
        description: config.description,
        tags,
        userId: options?.userId,
        isPublic: false
      }
    );
  }
}