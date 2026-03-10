export interface Tokenizer {
  countTokens(text: string): number;
}

class LightweightTokenizer implements Tokenizer {
  countTokens(text: string): number {
    const words = text.match(/[A-Za-z0-9가-힣]+/g) ?? [];
    return words.length;
  }
}

let optionalTokenizer: Tokenizer | null = null;
const defaultTokenizer = new LightweightTokenizer();

export function registerTokenizerPlugin(tokenizer: Tokenizer): void {
  optionalTokenizer = tokenizer;
}

export function getTokenizer(): Tokenizer {
  return optionalTokenizer ?? defaultTokenizer;
}

