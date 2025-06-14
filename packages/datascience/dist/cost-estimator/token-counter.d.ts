export declare class TokenCounter {
    private static readonly AVERAGE_CHARS_PER_TOKEN;
    private static readonly WHITESPACE_WEIGHT;
    static estimateTokens(text: string): number;
    static estimateTokensForJson(obj: any): number;
    static estimateTokensForArray(items: any[]): number;
    static estimatePromptTokens(systemPrompt: string, userPrompt: string, context?: string): number;
    static estimateCompletionTokens(expectedResponseLength: number): number;
}
//# sourceMappingURL=token-counter.d.ts.map