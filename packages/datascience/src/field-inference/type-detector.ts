import { FieldType } from '../types';

export class TypeDetector {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private static readonly URL_REGEX = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
  private static readonly PHONE_REGEX = /^(\+?[0-9]{1,4}[-\s\.]?)?(\([0-9]{3}\)|[0-9]{3})[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
  private static readonly DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;

  static detectType(value: any): FieldType {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';

    const type = typeof value;

    if (type === 'string') {
      return this.detectStringSubtype(value);
    }

    if (type === 'number') return 'number';
    if (type === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (type === 'object') return 'object';

    return 'mixed';
  }

  private static detectStringSubtype(value: string): FieldType {
    const trimmed = value.trim();

    if (trimmed === '') return 'string';
    if (this.EMAIL_REGEX.test(trimmed)) return 'email';
    if (this.URL_REGEX.test(trimmed)) return 'url';
    if (this.PHONE_REGEX.test(trimmed)) return 'phone';
    if (this.DATE_REGEX.test(trimmed) || !isNaN(Date.parse(trimmed))) return 'date';

    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      return 'string';
    }
  }

  static detectFieldType(values: any[]): { type: FieldType; confidence: number } {
    const typeCounts = new Map<FieldType, number>();
    const nonNullValues: any[] = [];

    for (const value of values) {
      const type = this.detectType(value);
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
      
      if (type !== 'null' && type !== 'undefined') {
        nonNullValues.push(value);
      }
    }

    if (nonNullValues.length === 0) {
      return { type: 'null', confidence: 1.0 };
    }

    const dominantType = this.getDominantType(typeCounts, values.length);
    const confidence = (typeCounts.get(dominantType) || 0) / values.length;

    return { type: dominantType, confidence };
  }

  private static getDominantType(typeCounts: Map<FieldType, number>, totalCount: number): FieldType {
    let maxCount = 0;
    let dominantType: FieldType = 'mixed';

    for (const [type, count] of typeCounts) {
      if (type !== 'null' && type !== 'undefined' && count > maxCount) {
        maxCount = count;
        dominantType = type;
      }
    }

    return dominantType;
  }
}