import Database from 'better-sqlite3';

export interface JoinRecommendation {
  files: string[];
  joinKeys: Array<{
    left: string;
    right: string;
    leftTable?: string;
    rightTable?: string;
  }>;
  joinType?: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  includeColumns?: string[];
  conditions?: Array<{
    column: string;
    operator: string;
    value: any;
  }>;
  aggregations?: Array<{
    function: string;
    column: string;
    alias: string;
  }>;
  groupBy?: string[];
  sampleSize?: number;
  estimatedRows?: number;
  tableSizes?: Record<string, number>;
}

export interface QueryResult {
  toString(): string;
  getParameters(): any[];
  getIndexSuggestions(): string[];
}

export class DynamicQueryBuilder {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  buildJoinQuery(recommendation: JoinRecommendation): QueryResult {
    this.validateRecommendation(recommendation);

    const { files, joinKeys, joinType = 'INNER', includeColumns, conditions, aggregations, groupBy } = recommendation;
    
    // Optimize join order based on table sizes
    const orderedTables = this.optimizeJoinOrder(files, recommendation.tableSizes);
    
    // Build SELECT clause
    const selectClause = this.buildSelectClause(includeColumns, aggregations, orderedTables);
    
    // Build FROM and JOIN clauses
    const fromClause = this.buildFromClause(orderedTables, joinKeys, joinType);
    
    // Build WHERE clause
    const { whereClause, parameters } = this.buildWhereClause(conditions);
    
    // Build GROUP BY clause
    const groupByClause = this.buildGroupByClause(groupBy);
    
    let sql = `${selectClause} ${fromClause}`;
    if (whereClause) sql += ` ${whereClause}`;
    if (groupByClause) sql += ` ${groupByClause}`;

    return {
      toString: () => sql,
      getParameters: () => parameters,
      getIndexSuggestions: () => this.generateIndexSuggestions(joinKeys, orderedTables)
    };
  }

  buildAnalyticsQuery(recommendation: JoinRecommendation): QueryResult {
    const baseQuery = this.buildJoinQuery(recommendation);
    let sql = baseQuery.toString();
    
    // Add DuckDB-specific optimizations
    if (recommendation.sampleSize) {
      sql = sql.replace(/FROM\s+(\w+)/, `FROM $1 TABLESAMPLE SYSTEM (${recommendation.sampleSize} ROWS)`);
    } else if (recommendation.estimatedRows && recommendation.estimatedRows > 1000000) {
      // Auto-sample for large datasets
      const sampleRows = Math.min(100000, Math.floor(recommendation.estimatedRows * 0.01));
      sql = sql.replace(/FROM\s+(\w+)/, `FROM $1 TABLESAMPLE SYSTEM (${sampleRows} ROWS)`);
    }
    
    return {
      toString: () => sql,
      getParameters: () => baseQuery.getParameters(),
      getIndexSuggestions: () => baseQuery.getIndexSuggestions()
    };
  }

  private validateRecommendation(recommendation: JoinRecommendation): void {
    // Validate table names
    for (const table of recommendation.files) {
      if (!this.isValidIdentifier(table)) {
        throw new Error(`Invalid table name: ${table}`);
      }
    }
    
    // Validate column names in join keys
    for (const joinKey of recommendation.joinKeys) {
      if (!this.isValidIdentifier(joinKey.left)) {
        throw new Error(`Invalid column name: ${joinKey.left}`);
      }
      if (!this.isValidIdentifier(joinKey.right)) {
        throw new Error(`Invalid column name: ${joinKey.right}`);
      }
    }
    
    // Validate join keys exist
    if (recommendation.joinKeys.length === 0) {
      throw new Error('At least one join key is required');
    }
  }

  private isValidIdentifier(identifier: string): boolean {
    // Simple validation - alphanumeric, underscore, dot
    return /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)?$/.test(identifier);
  }

  private optimizeJoinOrder(files: string[], tableSizes?: Record<string, number>): string[] {
    if (!tableSizes) return files;
    
    // Sort by table size (smallest first for better join performance)
    return [...files].sort((a, b) => (tableSizes[a] || 0) - (tableSizes[b] || 0));
  }

  private buildSelectClause(includeColumns?: string[], aggregations?: Array<{function: string; column: string; alias: string}>, tables?: string[]): string {
    let selectItems: string[] = [];
    
    if (aggregations && aggregations.length > 0) {
      selectItems = aggregations.map(agg => `${agg.function}(${agg.column}) AS ${agg.alias}`);
    } else if (includeColumns && includeColumns.length > 0) {
      selectItems = includeColumns;
    } else {
      selectItems = ['*'];
    }
    
    return `SELECT ${selectItems.join(', ')}`;
  }

  private buildFromClause(tables: string[], joinKeys: Array<{left: string; right: string; leftTable?: string; rightTable?: string}>, joinType: string): string {
    if (tables.length === 1) {
      return `FROM ${tables[0]}`;
    }
    
    let fromClause = `FROM ${tables[0]}`;
    
    for (let i = 1; i < tables.length; i++) {
      const joinKey = joinKeys[i - 1];
      const leftTable = joinKey.leftTable || tables[i - 1];
      const rightTable = joinKey.rightTable || tables[i];
      
      fromClause += ` ${joinType} JOIN ${rightTable} ON ${leftTable}.${joinKey.left} = ${rightTable}.${joinKey.right}`;
    }
    
    return fromClause;
  }

  private buildWhereClause(conditions?: Array<{column: string; operator: string; value: any}>): {whereClause: string; parameters: any[]} {
    if (!conditions || conditions.length === 0) {
      return { whereClause: '', parameters: [] };
    }
    
    const clauses = conditions.map(condition => `${condition.column} ${condition.operator} ?`);
    const parameters = conditions.map(condition => condition.value);
    
    return {
      whereClause: `WHERE ${clauses.join(' AND ')}`,
      parameters
    };
  }

  private buildGroupByClause(groupBy?: string[]): string {
    if (!groupBy || groupBy.length === 0) {
      return '';
    }
    
    return `GROUP BY ${groupBy.join(', ')}`;
  }

  private generateIndexSuggestions(joinKeys: Array<{left: string; right: string; leftTable?: string; rightTable?: string}>, tables: string[]): string[] {
    const suggestions: string[] = [];
    
    for (const joinKey of joinKeys) {
      const leftTable = joinKey.leftTable || tables[0];
      const rightTable = joinKey.rightTable || tables[1];
      
      suggestions.push(`CREATE INDEX idx_${leftTable}_${joinKey.left} ON ${leftTable}(${joinKey.left})`);
      suggestions.push(`CREATE INDEX idx_${rightTable}_${joinKey.right} ON ${rightTable}(${joinKey.right})`);
    }
    
    return suggestions;
  }
}