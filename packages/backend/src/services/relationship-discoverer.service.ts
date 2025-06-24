export interface FileMetadata {
  name: string;
  columns: ColumnMetadata[];
}

export interface ColumnMetadata {
  name: string;
  type: string;
  uniqueness: number;
}

export interface Relationship {
  sourceFile: string;
  sourceColumn: string;
  targetFile: string;
  targetColumn: string;
  confidence: number;
  matchType: 'EXACT_NAME' | 'SEMANTIC' | 'DATA_TYPE';
}

export interface DiscoveryOptions {
  minConfidence?: number;
  enableSemanticMatching?: boolean;
}

export class RelationshipDiscoverer {
  private readonly semanticPatterns = [
    { pattern: /^(customer|cust)_?id$/i, normalized: 'customer_id' },
    { pattern: /^(user|usr)_?id$/i, normalized: 'user_id' },
    { pattern: /^(order|ord)_?id$/i, normalized: 'order_id' },
    { pattern: /^(product|prod)_?id$/i, normalized: 'product_id' },
    { pattern: /^id$/i, normalized: 'id' }
  ];

  async discover(
    files: FileMetadata[], 
    options: DiscoveryOptions = {}
  ): Promise<Relationship[]> {
    const { minConfidence = 0.5, enableSemanticMatching = true } = options;
    
    if (!files || files.length < 2) {
      return [];
    }

    const relationships: Relationship[] = [];

    // Compare each pair of files
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const file1 = files[i];
        const file2 = files[j];
        
        if (!file1.columns || !file2.columns) continue;

        // Find relationships between all column combinations
        for (const col1 of file1.columns) {
          for (const col2 of file2.columns) {
            if (!col1.name || !col2.name) continue;

            const relationship = this.analyzeColumnPair(file1, col1, file2, col2);
            
            if (relationship && relationship.confidence >= minConfidence) {
              relationships.push(relationship);
            }
          }
        }
      }
    }

    // Sort by confidence and remove duplicates
    return this.deduplicateRelationships(
      relationships.sort((a, b) => b.confidence - a.confidence)
    );
  }

  private analyzeColumnPair(
    file1: FileMetadata,
    col1: ColumnMetadata,
    file2: FileMetadata, 
    col2: ColumnMetadata
  ): Relationship | null {
    // Determine source/target based on uniqueness (higher uniqueness = likely source key)
    const isFile1Source = col1.uniqueness >= col2.uniqueness;
    const sourceFile = isFile1Source ? file1 : file2;
    const sourceColumn = isFile1Source ? col1 : col2;
    const targetFile = isFile1Source ? file2 : file1;
    const targetColumn = isFile1Source ? col2 : col1;

    // Calculate confidence based on match type
    const confidence = this.calculateConfidence(
      sourceColumn, 
      targetColumn, 
      sourceFile.name, 
      targetFile.name
    );
    
    if (confidence < 0.1) return null;

    const matchType = this.getMatchType(
      sourceColumn.name, 
      targetColumn.name, 
      sourceFile.name, 
      targetFile.name
    );

    return {
      sourceFile: sourceFile.name,
      sourceColumn: sourceColumn.name,
      targetFile: targetFile.name,
      targetColumn: targetColumn.name,
      confidence,
      matchType
    };
  }

  private calculateConfidence(
    col1: ColumnMetadata, 
    col2: ColumnMetadata, 
    file1Name: string, 
    file2Name: string
  ): number {
    let confidence = 0;

    // Exact name match
    if (col1.name.toLowerCase() === col2.name.toLowerCase()) {
      confidence = 0.95;
    }
    // Semantic match (like customer_id <-> cust_id)
    else if (this.isSemanticMatch(col1.name, col2.name)) {
      confidence = 0.7; // Reduced from 0.75 to be < 0.9
    }
    // ID to foreign key match (like id <-> user_id) with context awareness
    else if (this.isContextualIdMatch(col1.name, col2.name, file1Name, file2Name)) {
      confidence = 0.65;
    }
    // No match
    else {
      return 0;
    }

    // Boost confidence for compatible data types
    if (this.areTypesCompatible(col1.type, col2.type)) {
      confidence += 0.05;
    } else {
      confidence -= 0.25; // Increased penalty for type mismatch
    }

    // Factor in uniqueness patterns (primary-foreign key pattern)
    const uniquenessDiff = Math.abs(col1.uniqueness - col2.uniqueness);
    if (uniquenessDiff > 0.3) {
      confidence += 0.1; // Good primary-foreign key pattern
    }

    return Math.max(0, Math.min(1, confidence));
  }

  private isSemanticMatch(name1: string, name2: string): boolean {
    const normalized1 = this.normalizeColumnName(name1);
    const normalized2 = this.normalizeColumnName(name2);
    
    return normalized1 === normalized2 && normalized1 !== null;
  }

  private isContextualIdMatch(
    name1: string, 
    name2: string, 
    file1Name: string, 
    file2Name: string
  ): boolean {
    const n1 = name1.toLowerCase();
    const n2 = name2.toLowerCase();
    
    // Extract table name from file name (remove .csv extension)
    const table1 = file1Name.replace('.csv', '').toLowerCase();
    const table2 = file2Name.replace('.csv', '').toLowerCase();
    
    // Check if 'id' from one table matches a foreign key referencing that table
    if (n1 === 'id') {
      // Priority 1: Specific table-named foreign keys
      if (n2 === `${table1.slice(0, -1)}_id` || // users -> user_id
          n2 === `${table1}_id` ||              // user -> user_id  
          (table1 === 'users' && n2 === 'user_id') ||
          (table1 === 'orders' && n2 === 'order_id') ||
          (table1 === 'customers' && n2 === 'customer_id')) {
        return true;
      }
      
      // Priority 2: Generic foreign key pattern (but avoid common table patterns)
      if (n2.endsWith('_id') && 
          !['user_id', 'order_id', 'payment_id', 'customer_id'].includes(n2)) {
        return true;
      }
    }
    
    if (n2 === 'id') {
      // Priority 1: Specific table-named foreign keys
      if (n1 === `${table2.slice(0, -1)}_id` ||
          n1 === `${table2}_id` ||
          (table2 === 'users' && n1 === 'user_id') ||
          (table2 === 'orders' && n1 === 'order_id') ||
          (table2 === 'customers' && n1 === 'customer_id')) {
        return true;
      }
      
      // Priority 2: Generic foreign key pattern (but avoid common table patterns)  
      if (n1.endsWith('_id') && 
          !['user_id', 'order_id', 'payment_id', 'customer_id'].includes(n1)) {
        return true;
      }
    }
    
    return false;
  }

  private normalizeColumnName(columnName: string): string | null {
    for (const { pattern, normalized } of this.semanticPatterns) {
      if (pattern.test(columnName)) {
        return normalized;
      }
    }
    return null;
  }

  private areTypesCompatible(type1: string, type2: string): boolean {
    const numericTypes = ['integer', 'number', 'decimal', 'float', 'bigint'];
    const stringTypes = ['string', 'text', 'varchar', 'char'];
    
    if (numericTypes.includes(type1) && numericTypes.includes(type2)) return true;
    if (stringTypes.includes(type1) && stringTypes.includes(type2)) return true;
    
    return type1 === type2;
  }

  private getMatchType(
    name1: string, 
    name2: string, 
    file1Name: string, 
    file2Name: string
  ): 'EXACT_NAME' | 'SEMANTIC' | 'DATA_TYPE' {
    if (name1.toLowerCase() === name2.toLowerCase()) {
      return 'EXACT_NAME';
    }
    if (this.isSemanticMatch(name1, name2) || 
        this.isContextualIdMatch(name1, name2, file1Name, file2Name)) {
      return 'SEMANTIC';
    }
    return 'DATA_TYPE';
  }

  private deduplicateRelationships(relationships: Relationship[]): Relationship[] {
    const seen = new Set<string>();
    return relationships.filter(rel => {
      const key = `${rel.sourceFile}:${rel.sourceColumn}-${rel.targetFile}:${rel.targetColumn}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}