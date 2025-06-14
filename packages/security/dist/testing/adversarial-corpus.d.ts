import { PIIType } from '../interfaces/datacloak';
export interface AdversarialPIIExample {
    text: string;
    expectedPII: Array<{
        type: PIIType;
        value: string;
        startIndex: number;
        endIndex: number;
        obfuscated?: boolean;
        variant?: string;
    }>;
    difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
    category: string;
}
export interface CorpusStats {
    totalExamples: number;
    byDifficulty: Record<string, number>;
    byPIIType: Record<PIIType, number>;
    byCategory: Record<string, number>;
}
export declare class AdversarialCorpus {
    private corpus;
    private readonly targetSize;
    constructor();
    getCorpus(): AdversarialPIIExample[];
    getStats(): CorpusStats;
    getExamplesByDifficulty(difficulty: string): AdversarialPIIExample[];
    getExamplesByPIIType(piiType: PIIType): AdversarialPIIExample[];
    private generateCorpus;
    private generateEmailVariants;
    private generatePhoneVariants;
    private generateSSNVariants;
    private generateCreditCardVariants;
    private generateAddressVariants;
    private generateNameVariants;
    private generateDateOfBirthVariants;
    private generateMixedPIIExamples;
    private generateObfuscatedExamples;
    private generateContextualExamples;
    private wrapInContext;
}
//# sourceMappingURL=adversarial-corpus.d.ts.map