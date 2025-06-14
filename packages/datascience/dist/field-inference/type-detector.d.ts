import { FieldType } from '../types';
export declare class TypeDetector {
    private static readonly EMAIL_REGEX;
    private static readonly URL_REGEX;
    private static readonly PHONE_REGEX;
    private static readonly DATE_REGEX;
    static detectType(value: any): FieldType;
    private static detectStringSubtype;
    static detectFieldType(values: any[]): {
        type: FieldType;
        confidence: number;
    };
    private static getDominantType;
}
//# sourceMappingURL=type-detector.d.ts.map