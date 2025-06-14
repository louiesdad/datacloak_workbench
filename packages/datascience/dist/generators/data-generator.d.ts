import { Dataset } from '../types';
import { DatasetSchema } from './synthetic-dataset';
export interface DataGeneratorOptions {
    type: 'users' | 'sales' | 'logs' | 'mixed' | 'custom';
    recordCount?: number;
    schema?: DatasetSchema;
    name?: string;
    variations?: DatasetVariation[];
}
export interface DatasetVariation {
    name: string;
    modifySchema: (schema: DatasetSchema) => DatasetSchema;
}
export declare class DataGenerator {
    static generate(options: DataGeneratorOptions): Dataset;
    static generateMultiple(configs: DataGeneratorOptions[]): Dataset[];
    static generateWithVariations(baseOptions: DataGeneratorOptions, variations: DatasetVariation[]): Dataset[];
    static createQualityVariations(): DatasetVariation[];
    static createSizeVariations(baseSizes?: number[]): Array<{
        name: string;
        recordCount: number;
    }>;
    static generateBenchmarkSuite(): Dataset[];
}
//# sourceMappingURL=data-generator.d.ts.map