// Types for relationship analysis
export type RelationshipType = 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_MANY' | 'NONE';
export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
export type JoinComplexity = 'SIMPLE' | 'MODERATE' | 'COMPLEX';
export type IndexType = 'BTREE' | 'HASH';

export interface JoinRelationship {
  sourceFile: string;
  sourceColumn: string;
  targetFile: string;
  targetColumn: string;
  confidence: number;
  relationshipType: RelationshipType;
  sourceCardinality?: number;
  targetCardinality?: number;
  avgMatchesPerKey?: number;
  requireBothSides?: boolean;
  hasIndex?: boolean;
  dataTypeMatch?: boolean;
}

export interface JoinPath {
  from: string;
  to: string;
  on: {
    left: string;
    right: string;
  };
}

export interface JoinMetadata {
  joinKey: string;
  estimatedRows: number;
  joinComplexity: JoinComplexity;
  performanceScore: number;
  dataQuality: DataQualityMetrics;
}

export interface DataQualityMetrics {
  nullKeys: number;
  unmatchedKeys: number;
  duplicateKeys: number;
}

export interface IndexRecommendation {
  table: string;
  column: string;
  type: IndexType;
  reason: string;
}

export interface SizeEstimate {
  minRows: number;
  maxRows: number;
  expectedRows: number;
}

export class VirtualJoin {
  private files: string[] = [];
  private columns: string[] = [];
  private joinType: JoinType = 'LEFT';
  private joinPath: JoinPath[] = [];
  private metadata: JoinMetadata | null = null;
  private joinOrder: string[] = [];

  constructor(
    protected relationship: JoinRelationship,
    protected options?: { optimize?: boolean }
  ) {
    this.initialize();
  }

  private initialize(): void {
    this.setupFiles();
    this.setupColumns();
    this.determineJoinType();
    this.optimizeJoinOrder();
    this.buildMetadata();
  }

  private setupFiles(): void {
    this.files = [this.relationship.sourceFile, this.relationship.targetFile];
  }

  private setupColumns(): void {
    const sourceTable = this.getTableName(this.relationship.sourceFile);
    const targetTable = this.getTableName(this.relationship.targetFile);
    
    this.columns = [
      `${sourceTable}.${this.relationship.sourceColumn}`,
      `${targetTable}.${this.relationship.targetColumn}`
    ];
  }

  private determineJoinType(): void {
    this.joinType = this.relationship.requireBothSides ? 'INNER' : 'LEFT';
  }

  private optimizeJoinOrder(): void {
    if (this.shouldOptimizeOrder()) {
      const sourceSize = this.relationship.sourceCardinality!;
      const targetSize = this.relationship.targetCardinality!;
      
      if (targetSize < sourceSize) {
        this.joinOrder = [this.relationship.targetFile, this.relationship.sourceFile];
        this.joinType = 'RIGHT';
      } else {
        this.joinOrder = [...this.files];
      }
    } else {
      this.joinOrder = [...this.files];
    }
  }

  private shouldOptimizeOrder(): boolean {
    return !!(
      this.options?.optimize && 
      this.relationship.sourceCardinality && 
      this.relationship.targetCardinality
    );
  }

  private buildMetadata(): void {
    const sourceTable = this.getTableName(this.relationship.sourceFile);
    const targetTable = this.getTableName(this.relationship.targetFile);
    
    this.metadata = {
      joinKey: `${sourceTable}.${this.relationship.sourceColumn} = ${targetTable}.${this.relationship.targetColumn}`,
      estimatedRows: this.calculateEstimatedRows(),
      joinComplexity: this.determineComplexity(),
      performanceScore: this.calculatePerformanceScore(),
      dataQuality: this.initializeDataQuality()
    };
  }

  private determineComplexity(): JoinComplexity {
    // Simple implementation - can be enhanced based on actual metrics
    return 'SIMPLE';
  }

  private calculatePerformanceScore(): number {
    // Base score on confidence and other factors
    return this.relationship.confidence;
  }

  private initializeDataQuality(): DataQualityMetrics {
    return {
      nullKeys: 0,
      unmatchedKeys: 0,
      duplicateKeys: 0
    };
  }

  private getTableName(filename: string): string {
    return filename.replace('.csv', '');
  }

  private calculateEstimatedRows(): number {
    if (this.relationship.avgMatchesPerKey && this.relationship.sourceCardinality) {
      return this.relationship.sourceCardinality * this.relationship.avgMatchesPerKey;
    }
    return this.relationship.targetCardinality || 0;
  }

  getColumns(): string[] {
    return this.columns;
  }

  getFiles(): string[] {
    return this.files;
  }

  getJoinType(): string {
    return this.joinType;
  }

  getJoinPath(): JoinPath[] {
    return this.joinPath;
  }

  getMetadata(): JoinMetadata | null {
    return this.metadata;
  }

  getJoinOrder(): string[] {
    return this.joinOrder;
  }

  toSQL(): string {
    const sourceTable = this.getTableName(this.relationship.sourceFile);
    const targetTable = this.getTableName(this.relationship.targetFile);
    
    const joinClause = `${sourceTable}.${this.relationship.sourceColumn} = ${targetTable}.${this.relationship.targetColumn}`;
    
    return `SELECT * FROM ${sourceTable} ${this.joinType} JOIN ${targetTable} ON ${joinClause}`;
  }

  estimateResultSize(): SizeEstimate {
    const sourceSize = this.relationship.sourceCardinality || 0;
    const targetSize = this.relationship.targetCardinality || 0;
    
    let minRows = sourceSize;
    let maxRows = targetSize;
    let expectedRows = targetSize;

    if (this.relationship.relationshipType === 'ONE_TO_MANY' && this.relationship.avgMatchesPerKey) {
      expectedRows = sourceSize * this.relationship.avgMatchesPerKey;
    }

    return {
      minRows,
      maxRows,
      expectedRows
    };
  }

  getIndexRecommendations(): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];

    if (!this.relationship.hasIndex) {
      recommendations.push({
        table: this.getTableName(this.relationship.targetFile),
        column: this.relationship.targetColumn,
        type: 'BTREE',
        reason: 'Join key without index'
      });
    }

    return recommendations;
  }
}

export class MultiJoin extends VirtualJoin {
  private allFiles: string[] = [];
  private allJoinPaths: JoinPath[] = [];

  constructor(relationships: JoinRelationship[]) {
    super(relationships[0]);
    this.buildMultiJoin(relationships);
  }

  private buildMultiJoin(relationships: JoinRelationship[]) {
    const fileSet = new Set<string>();
    const joinPaths: JoinPath[] = [];

    for (const rel of relationships) {
      fileSet.add(rel.sourceFile);
      fileSet.add(rel.targetFile);
      
      joinPaths.push({
        from: rel.sourceFile,
        to: rel.targetFile,
        on: {
          left: rel.sourceColumn,
          right: rel.targetColumn
        }
      });
    }

    this.allFiles = Array.from(fileSet);
    this.allJoinPaths = joinPaths;

    // Check for circular joins
    if (this.hasCircularJoin()) {
      throw new Error('Circular join detected');
    }
  }

  private hasCircularJoin(): boolean {
    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (file: string): boolean => {
      visited.add(file);
      stack.add(file);

      const neighbors = this.allJoinPaths
        .filter(path => path.from === file)
        .map(path => path.to);

      for (const neighbor of neighbors) {
        if (stack.has(neighbor)) {
          return true;
        }
        if (!visited.has(neighbor) && dfs(neighbor)) {
          return true;
        }
      }

      stack.delete(file);
      return false;
    };

    for (const file of this.allFiles) {
      if (!visited.has(file) && dfs(file)) {
        return true;
      }
    }

    return false;
  }

  getFiles(): string[] {
    return this.allFiles;
  }

  getJoinPath(): JoinPath[] {
    return this.allJoinPaths;
  }
}

export class VirtualJoiner {
  async createJoin(relationship: JoinRelationship, options?: { optimize?: boolean }): Promise<VirtualJoin> {
    // Validate compatibility
    if (relationship.dataTypeMatch === false) {
      throw new Error('Incompatible data types for join');
    }

    return new VirtualJoin(relationship, options);
  }

  async createMultiJoin(relationships: JoinRelationship[]): Promise<MultiJoin> {
    return new MultiJoin(relationships);
  }
}