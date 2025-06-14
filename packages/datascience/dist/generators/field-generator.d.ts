import { FieldType } from '../types';
export interface FieldGenerationOptions {
    count: number;
    nullRate?: number;
    uniqueRate?: number;
    minLength?: number;
    maxLength?: number;
    minValue?: number;
    maxValue?: number;
    patterns?: string[];
    customGenerator?: () => any;
}
export declare class FieldGenerator {
    private static readonly SAMPLE_NAMES;
    private static readonly SAMPLE_EMAILS;
    private static readonly SAMPLE_URLS;
    private static readonly SAMPLE_PHONES;
    static generate(type: FieldType, options: FieldGenerationOptions): any[];
    private static generateValue;
    private static generateString;
    private static generateNumber;
    private static generateDate;
    private static generateEmail;
    private static generateUrl;
    private static generatePhone;
    private static generateJson;
    private static generateArray;
    private static generateObject;
    private static randomDigits;
}
//# sourceMappingURL=field-generator.d.ts.map