import {
  DEFAULT_EMBEDDING_DIMENSION,
  type EmbeddingInput,
  type EmbeddingProvider,
  type EmbeddingResult,
} from "@/lib/embedding-dto";
import { localEmbeddingProvider } from "@/lib/local-embedding-provider";

// P14 foundation에서는 local-hash provider만 등록한다.
// 향후 external provider는 여기서 provider registry에 추가하는 방식으로 확장한다.
const PROVIDERS: Record<string, EmbeddingProvider> = {
  [localEmbeddingProvider.id]: localEmbeddingProvider,
};

export function getEmbeddingProvider(provider?: string): EmbeddingProvider {
  if (provider && PROVIDERS[provider]) return PROVIDERS[provider]!;
  return localEmbeddingProvider;
}

export function embedText(input: EmbeddingInput): EmbeddingResult {
  const provider = getEmbeddingProvider(input.provider);
  return provider.embed({
    text: input.text,
    provider: provider.id,
    model: provider.model,
    dimension: input.dimension ?? provider.dimension ?? DEFAULT_EMBEDDING_DIMENSION,
  });
}
