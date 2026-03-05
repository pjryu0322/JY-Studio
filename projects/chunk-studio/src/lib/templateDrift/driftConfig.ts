export interface DriftWeights {
  sections: number;
  fields: number;
  tables: number;
  repeats: number;
}

export interface DriftConfig {
  scoreThresholdHigh: number;
  scoreThresholdMedium: number;
  weights: DriftWeights;
  titleSimilarityThreshold: number;
}

export const driftConfig: DriftConfig = {
  scoreThresholdHigh: 0.7,
  scoreThresholdMedium: 0.4,
  weights: {
    sections: 0.35,
    fields: 0.25,
    tables: 0.25,
    repeats: 0.15,
  },
  titleSimilarityThreshold: 0.85,
};
