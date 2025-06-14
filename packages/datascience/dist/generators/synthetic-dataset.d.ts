import { Dataset, FieldType } from '../types';
import { FieldGenerationOptions } from './field-generator';
export interface DatasetSchema {
    [fieldName: string]: {
        type: FieldType;
        options?: Partial<FieldGenerationOptions>;
    };
}
export interface SyntheticDatasetOptions {
    recordCount: number;
    schema: DatasetSchema;
    name?: string;
    seed?: number;
}
export declare class SyntheticDataset {
    static generate(options: SyntheticDatasetOptions): Dataset;
    static generateUserDataset(recordCount?: number): Dataset;
    static generateSalesDataset(recordCount?: number): Dataset;
    static generateLogDataset(recordCount?: number): Dataset;
    static generateMixedTypesDataset(recordCount?: number): Dataset;
    private static setSeed;
}
//# sourceMappingURL=synthetic-dataset.d.ts.map