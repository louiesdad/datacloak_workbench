import { InferenceResult, Dataset } from '../types';
import { TypeDetector } from './type-detector';
import { StatisticsCalculator } from './statistics-calculator';

export class FieldInferenceEngine {
  async inferField(fieldName: string, values: any[]): Promise<InferenceResult> {
    const typeResult = TypeDetector.detectFieldType(values);
    const statistics = StatisticsCalculator.calculate(values, typeResult.type);

    const result: InferenceResult = {
      fieldName,
      inferredType: typeResult.type,
      confidence: typeResult.confidence,
      statistics,
    };

    const format = this.detectFormat(values, typeResult.type);
    if (format) {
      result.format = format;
    }

    return result;
  }

  async inferDataset(dataset: Dataset): Promise<InferenceResult[]> {
    const results: InferenceResult[] = [];

    for (const [fieldName, values] of Object.entries(dataset.fields)) {
      const result = await this.inferField(fieldName, values);
      results.push(result);
    }

    return results;
  }

  async inferFromSample(data: Record<string, any>[]): Promise<InferenceResult[]> {
    if (data.length === 0) {
      return [];
    }

    const fieldNames = Object.keys(data[0]);
    const results: InferenceResult[] = [];

    for (const fieldName of fieldNames) {
      const values = data.map(row => row[fieldName]);
      const result = await this.inferField(fieldName, values);
      results.push(result);
    }

    return results;
  }

  private detectFormat(values: any[], type: string): string | undefined {
    const nonNullValues = values.filter(v => v !== null && v !== undefined);
    
    if (nonNullValues.length === 0) return undefined;

    switch (type) {
      case 'date':
        return this.detectDateFormat(nonNullValues);
      case 'number':
        return this.detectNumberFormat(nonNullValues);
      default:
        return undefined;
    }
  }

  private detectDateFormat(values: any[]): string | undefined {
    const stringValues = values.map(v => String(v));
    
    const formats = [
      { pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, format: 'ISO 8601' },
      { pattern: /^\d{4}-\d{2}-\d{2}$/, format: 'YYYY-MM-DD' },
      { pattern: /^\d{2}\/\d{2}\/\d{4}$/, format: 'MM/DD/YYYY' },
      { pattern: /^\d{2}-\d{2}-\d{4}$/, format: 'MM-DD-YYYY' },
    ];

    for (const { pattern, format } of formats) {
      if (stringValues.some(v => pattern.test(v))) {
        return format;
      }
    }

    return undefined;
  }

  private detectNumberFormat(values: any[]): string | undefined {
    const hasDecimals = values.some(v => Number(v) % 1 !== 0);
    const hasNegatives = values.some(v => Number(v) < 0);

    if (hasDecimals && hasNegatives) return 'decimal';
    if (hasDecimals) return 'positive decimal';
    if (hasNegatives) return 'integer';
    return 'positive integer';
  }
}