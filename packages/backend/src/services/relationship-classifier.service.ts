export type RelationshipType = 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_MANY';

export interface RelationshipSamples {
  left: (string | number | null)[];
  right: (string | number | null)[];
}

export interface RelationshipAnalysis {
  type: RelationshipType;
  quality: number;
  completeness: number;
  selectivity: number;
}

export class RelationshipClassifier {
  async classify(samples: RelationshipSamples): Promise<RelationshipType> {
    const analysis = await this.analyzeRelationship(samples);
    return analysis.type;
  }

  async analyzeRelationship(samples: RelationshipSamples): Promise<RelationshipAnalysis> {
    if (!samples.left || !samples.right || samples.left.length !== samples.right.length) {
      throw new Error('Invalid samples: left and right arrays must have the same length');
    }

    const { leftCardinality, rightCardinality, completeness } = this.calculateCardinalities(samples);
    
    // Determine relationship type based on cardinalities
    const type = this.determineRelationshipType(leftCardinality, rightCardinality);
    
    // Calculate quality metrics
    const quality = this.calculateQuality(leftCardinality, rightCardinality, completeness);
    const selectivity = this.calculateSelectivity(samples);

    return {
      type,
      quality,
      completeness,
      selectivity
    };
  }

  private calculateCardinalities(samples: RelationshipSamples) {
    const leftMap = new Map<string, Set<string>>();
    const rightMap = new Map<string, Set<string>>();
    let totalPairs = 0;
    let nullPairs = 0;

    // Build mapping of left -> right values and vice versa
    for (let i = 0; i < samples.left.length; i++) {
      const leftVal = samples.left[i];
      const rightVal = samples.right[i];
      
      totalPairs++;
      
      if (leftVal === null || rightVal === null) {
        nullPairs++;
        continue;
      }

      const leftKey = String(leftVal);
      const rightKey = String(rightVal);

      // Left -> Right mapping
      if (!leftMap.has(leftKey)) {
        leftMap.set(leftKey, new Set());
      }
      leftMap.get(leftKey)!.add(rightKey);

      // Right -> Left mapping  
      if (!rightMap.has(rightKey)) {
        rightMap.set(rightKey, new Set());
      }
      rightMap.get(rightKey)!.add(leftKey);
    }

    // Calculate cardinalities
    const leftCardinality = this.getAverageCardinality(leftMap);
    const rightCardinality = this.getAverageCardinality(rightMap);
    const completeness = (totalPairs - nullPairs) / totalPairs;

    return { leftCardinality, rightCardinality, completeness };
  }

  private getAverageCardinality(mapping: Map<string, Set<string>>): number {
    if (mapping.size === 0) return 0;
    
    let totalMappings = 0;
    for (const valueSet of mapping.values()) {
      totalMappings += valueSet.size;
    }
    
    return totalMappings / mapping.size;
  }

  private determineRelationshipType(leftCardinality: number, rightCardinality: number): RelationshipType {
    const threshold = 1.1; // Small threshold for floating point comparison
    
    if (leftCardinality <= threshold && rightCardinality <= threshold) {
      return 'ONE_TO_ONE';
    }
    
    if (leftCardinality <= threshold && rightCardinality > threshold) {
      return 'ONE_TO_MANY';
    }
    
    if (leftCardinality > threshold && rightCardinality <= threshold) {
      return 'ONE_TO_MANY'; // Many-to-one, but we'll call it one-to-many for consistency
    }
    
    return 'MANY_TO_MANY';
  }

  private calculateQuality(leftCard: number, rightCard: number, completeness: number): number {
    // Quality decreases with higher cardinality (more complex relationships)
    const cardinalityPenalty = Math.min(leftCard + rightCard, 10) / 10;
    
    // Base quality starts high and is reduced by cardinality complexity
    let quality = 1.0 - (cardinalityPenalty * 0.3);
    
    // Factor in completeness (null values reduce quality)
    quality *= completeness;
    
    return Math.max(0, Math.min(1, quality));
  }

  private calculateSelectivity(samples: RelationshipSamples): number {
    const uniqueLeftValues = new Set(samples.left.filter(v => v !== null));
    const uniqueRightValues = new Set(samples.right.filter(v => v !== null));
    
    const totalValues = samples.left.length;
    
    // Average selectivity of both sides
    const leftSelectivity = uniqueLeftValues.size / totalValues;
    const rightSelectivity = uniqueRightValues.size / totalValues;
    
    return (leftSelectivity + rightSelectivity) / 2;
  }
}