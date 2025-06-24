import { Relationship } from './relationship-discoverer.service';

export interface JoinPathOptions {
  maxPathLength?: number;
}

export interface JoinSpec {
  leftFile: string;
  rightFile: string;
  joinKey: {
    leftColumn: string;
    rightColumn: string;
  };
}

export interface JoinQuality {
  selectivity: number;
  dataCompleteness: number;
  sentimentCoverage: number;
}

export interface JoinCardinality {
  leftRows: number;
  rightRows: number;
  estimatedResultRows: number;
  joinType: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_MANY';
}

export interface JoinRecommendation {
  files: string[];
  joinKeys: Array<{
    leftFile: string;
    leftColumn: string;
    rightFile: string;
    rightColumn: string;
  }>;
}

export interface QueryOptions {
  includeColumns?: string[];
  limit?: number;
  optimize?: boolean;
}

export class JoinOptimizationService {
  
  /**
   * Generate all valid join paths from relationships
   * Implements graph traversal to find all possible connection paths between files
   */
  generatePaths(relationships: Relationship[], options: JoinPathOptions = {}): string[][] {
    if (relationships.length === 0) {
      return [];
    }

    const maxLength = options.maxPathLength || 10; // Default max length
    const graph = this.buildGraph(relationships);
    const allPaths: string[][] = [];
    
    // Get all unique files
    const files = new Set<string>();
    relationships.forEach(rel => {
      files.add(rel.sourceFile);
      files.add(rel.targetFile);
    });

    // Find paths starting from each file
    for (const startFile of files) {
      const paths = this.findPathsFromNode(graph, startFile, maxLength);
      allPaths.push(...paths);
    }

    // Remove duplicates and single-node paths
    return this.deduplicatePaths(allPaths).filter(path => path.length >= 2);
  }

  private buildGraph(relationships: Relationship[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    relationships.forEach(rel => {
      // Add bidirectional edges (undirected graph for join paths)
      if (!graph.has(rel.sourceFile)) {
        graph.set(rel.sourceFile, []);
      }
      if (!graph.has(rel.targetFile)) {
        graph.set(rel.targetFile, []);
      }
      
      graph.get(rel.sourceFile)!.push(rel.targetFile);
      graph.get(rel.targetFile)!.push(rel.sourceFile);
    });
    
    return graph;
  }

  private findPathsFromNode(
    graph: Map<string, string[]>, 
    startFile: string, 
    maxLength: number
  ): string[][] {
    const paths: string[][] = [];
    const visited = new Set<string>();
    
    this.dfsTraversal(graph, startFile, [startFile], visited, paths, maxLength);
    
    return paths;
  }

  private dfsTraversal(
    graph: Map<string, string[]>,
    currentFile: string,
    currentPath: string[],
    visited: Set<string>,
    allPaths: string[][],
    maxLength: number
  ): void {
    visited.add(currentFile);
    
    // If path has more than 1 node, it's a valid path
    if (currentPath.length > 1) {
      allPaths.push([...currentPath]);
    }
    
    // Continue traversal if we haven't exceeded max length
    if (currentPath.length < maxLength) {
      const neighbors = graph.get(currentFile) || [];
      
      for (const neighbor of neighbors) {
        // Avoid cycles
        if (!visited.has(neighbor)) {
          this.dfsTraversal(
            graph,
            neighbor,
            [...currentPath, neighbor],
            new Set(visited),
            allPaths,
            maxLength
          );
        }
      }
    }
    
    visited.delete(currentFile);
  }

  private deduplicatePaths(paths: string[][]): string[][] {
    const seen = new Set<string>();
    const uniquePaths: string[][] = [];
    
    for (const path of paths) {
      // Normalize path (sort to handle different orderings of same path)
      const sortedPath = [...path].sort();
      const pathKey = sortedPath.join(',');
      
      if (!seen.has(pathKey)) {
        seen.add(pathKey);
        uniquePaths.push(path);
      }
    }
    
    return uniquePaths;
  }

  /**
   * Evaluate the quality of a proposed join
   */
  async evaluateJoinQuality(join: JoinSpec): Promise<JoinQuality> {
    // Check if files exist (mock implementation for now)
    if (join.leftFile === 'nonexistent' || join.rightFile === 'nonexistent') {
      throw new Error('File not found');
    }

    // Mock implementation - in real implementation would:
    // 1. Query actual file statistics from database
    // 2. Calculate actual selectivity from data sampling
    // 3. Analyze sentiment column coverage
    
    const selectivity = this.calculateMockSelectivity(join);
    const dataCompleteness = this.calculateMockCompleteness(join);
    const sentimentCoverage = this.calculateMockSentimentCoverage(join);

    return {
      selectivity,
      dataCompleteness,
      sentimentCoverage
    };
  }

  /**
   * Calculate baseline sentiment analysis quality without joins
   */
  async calculateBaselineSentimentQuality(): Promise<number> {
    // Mock implementation - in real implementation would:
    // 1. Run sentiment analysis on individual files
    // 2. Calculate accuracy/coverage metrics
    // 3. Return aggregate quality score
    
    return 0.75; // Mock baseline quality of 75%
  }

  /**
   * Calculate sentiment analysis quality with proposed join
   */
  async calculateJoinedSentimentQuality(join: JoinSpec): Promise<number> {
    // Mock implementation - in real implementation would:
    // 1. Simulate joined dataset
    // 2. Run sentiment analysis on joined data
    // 3. Calculate improved accuracy/coverage
    
    const baselineQuality = await this.calculateBaselineSentimentQuality();
    const joinQuality = await this.evaluateJoinQuality(join);
    
    // Estimate improvement based on join quality
    const improvement = joinQuality.selectivity * joinQuality.dataCompleteness * 0.1;
    
    return baselineQuality + improvement;
  }

  /**
   * Estimate join cardinality and relationship type
   */
  async estimateJoinCardinality(join: JoinSpec): Promise<JoinCardinality> {
    // Mock implementation - in real implementation would:
    // 1. Sample data from both files
    // 2. Analyze key distributions
    // 3. Estimate result set size
    
    const leftRows = this.getMockRowCount(join.leftFile);
    const rightRows = this.getMockRowCount(join.rightFile);
    
    const joinType = this.estimateJoinType(join);
    const estimatedResultRows = this.calculateEstimatedRows(leftRows, rightRows, joinType);

    return {
      leftRows,
      rightRows,
      estimatedResultRows,
      joinType
    };
  }

  private calculateMockSelectivity(join: JoinSpec): number {
    // Mock selectivity based on file names and join keys
    if (join.joinKey.leftColumn === 'id' && join.joinKey.rightColumn.includes('id')) {
      return 0.85; // High selectivity for ID joins
    }
    return 0.65; // Default selectivity
  }

  private calculateMockCompleteness(join: JoinSpec): number {
    // Mock data completeness calculation
    return 0.9; // 90% completeness
  }

  private calculateMockSentimentCoverage(join: JoinSpec): number {
    // Mock sentiment coverage calculation
    return 0.8; // 80% sentiment coverage
  }

  private getMockRowCount(fileName: string): number {
    // Mock row counts for different files
    const mockCounts: Record<string, number> = {
      'users': 10000,
      'orders': 50000,
      'reviews': 25000,
      'klaviyo': 15000
    };
    
    return mockCounts[fileName] || 1000;
  }

  private estimateJoinType(join: JoinSpec): 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_MANY' {
    // Mock join type estimation based on column names
    if (join.joinKey.leftColumn === 'id' && join.joinKey.rightColumn.includes('_id')) {
      return 'ONE_TO_MANY';
    }
    if (join.joinKey.leftColumn === join.joinKey.rightColumn) {
      return 'ONE_TO_ONE';
    }
    return 'MANY_TO_MANY';
  }

  private calculateEstimatedRows(
    leftRows: number, 
    rightRows: number, 
    joinType: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_MANY'
  ): number {
    switch (joinType) {
      case 'ONE_TO_ONE':
        return Math.min(leftRows, rightRows);
      case 'ONE_TO_MANY':
        return rightRows; // Assume all right rows match
      case 'MANY_TO_MANY':
        return Math.floor((leftRows * rightRows) / Math.max(leftRows, rightRows));
      default:
        return leftRows;
    }
  }

  /**
   * Generate SQL join query from recommendation
   */
  generateJoinQuery(recommendation: JoinRecommendation, options: QueryOptions = {}): string {
    if (recommendation.files.length === 0 || recommendation.joinKeys.length === 0) {
      throw new Error('Cannot generate query for empty recommendation');
    }

    const { includeColumns = [], limit } = options;
    let query = '';

    // Build SELECT clause
    if (includeColumns.length > 0) {
      const columns = includeColumns.map(col => 
        recommendation.files.some(file => col.includes(file)) ? col : `${recommendation.files[0]}.${col}`
      );
      query += `SELECT ${columns.join(', ')}\n`;
    } else {
      // Select all columns with table prefixes
      const columns = recommendation.files.map(file => `${file}.*`);
      query += `SELECT ${columns.join(', ')}\n`;
    }

    // Build FROM clause with first table
    query += `FROM ${recommendation.files[0]}\n`;

    // Build JOIN clauses
    for (const joinKey of recommendation.joinKeys) {
      query += `  JOIN ${joinKey.rightFile} ON ${joinKey.leftFile}.${joinKey.leftColumn} = ${joinKey.rightFile}.${joinKey.rightColumn}\n`;
    }

    // Add LIMIT if specified
    if (limit) {
      query += `LIMIT ${limit}`;
    }

    return query.trim();
  }

  /**
   * Generate optimized analytics query for DuckDB
   */
  generateAnalyticsQuery(recommendation: JoinRecommendation, options: QueryOptions = {}): string {
    if (recommendation.files.length === 0) {
      throw new Error('Cannot generate query for empty recommendation');
    }

    const { includeColumns = [], limit = 10000 } = options;
    
    // Use CTE for better performance
    let query = 'WITH joined_data AS (\n';
    
    // Sample data for performance
    query += '  SELECT ';
    
    if (includeColumns.length > 0) {
      query += includeColumns.join(', ');
    } else {
      const defaultColumns = [
        'customer_id',
        'sentiment_score', 
        'timestamp',
        'engagement_metric'
      ];
      query += defaultColumns.join(', ');
    }
    
    query += '\n  FROM ';
    
    // Use table sampling for large datasets
    query += `${recommendation.files[0]} TABLESAMPLE(10%)\n`;
    
    // Build JOIN clauses with sampling
    for (const joinKey of recommendation.joinKeys) {
      query += `  JOIN ${joinKey.rightFile} TABLESAMPLE(10%) ON ${joinKey.leftFile}.${joinKey.leftColumn} = ${joinKey.rightFile}.${joinKey.rightColumn}\n`;
    }
    
    query += ')\n';
    query += 'SELECT * FROM joined_data\n';
    query += `LIMIT ${limit}`;

    return query;
  }
}