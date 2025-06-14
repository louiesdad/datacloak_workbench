import { InferenceResult, Dataset } from '../types';
import { GPTAssistConfig } from './gpt-assist';
export declare class FieldInferenceEngine {
    private gptAssist;
    constructor(gptConfig?: Partial<GPTAssistConfig>);
    inferField(fieldName: string, values: any[]): Promise<InferenceResult>;
    inferDataset(dataset: Dataset): Promise<InferenceResult[]>;
    inferFromSample(data: Record<string, any>[]): Promise<InferenceResult[]>;
    private detectFormat;
    private detectDateFormat;
    private detectNumberFormat;
}
//# sourceMappingURL=engine.d.ts.map