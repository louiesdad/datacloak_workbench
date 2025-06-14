export class TokenCounter {
  private static readonly AVERAGE_CHARS_PER_TOKEN = 4;
  private static readonly WHITESPACE_WEIGHT = 0.5;

  static estimateTokens(text: string): number {
    if (!text || text.length === 0) return 0;

    const words = text.trim().split(/\s+/);
    const totalChars = text.length;
    const whitespaceChars = (text.match(/\s/g) || []).length;
    const nonWhitespaceChars = totalChars - whitespaceChars;

    const effectiveChars = nonWhitespaceChars + (whitespaceChars * this.WHITESPACE_WEIGHT);
    const baseTokens = Math.ceil(effectiveChars / this.AVERAGE_CHARS_PER_TOKEN);

    const wordBasedTokens = Math.ceil(words.length * 1.3);

    return Math.max(baseTokens, wordBasedTokens);
  }

  static estimateTokensForJson(obj: any): number {
    const jsonString = JSON.stringify(obj);
    return this.estimateTokens(jsonString);
  }

  static estimateTokensForArray(items: any[]): number {
    let totalTokens = 0;
    
    for (const item of items) {
      if (typeof item === 'string') {
        totalTokens += this.estimateTokens(item);
      } else if (typeof item === 'object') {
        totalTokens += this.estimateTokensForJson(item);
      } else {
        totalTokens += this.estimateTokens(String(item));
      }
    }

    return totalTokens;
  }

  static estimatePromptTokens(systemPrompt: string, userPrompt: string, context?: string): number {
    let total = 0;
    
    total += this.estimateTokens(systemPrompt);
    total += this.estimateTokens(userPrompt);
    
    if (context) {
      total += this.estimateTokens(context);
    }

    total += 50;

    return total;
  }

  static estimateCompletionTokens(expectedResponseLength: number): number {
    if (expectedResponseLength <= 0) {
      return 100;
    }

    return Math.ceil(expectedResponseLength / this.AVERAGE_CHARS_PER_TOKEN);
  }
}