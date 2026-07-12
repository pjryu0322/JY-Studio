import { doclingPayloadValidator } from "@/lib/distribution/docling-payload-validator";
import { unstructuredPayloadValidator } from "@/lib/distribution/unstructured-payload-validator";
import {
  generatorForProfile,
  isPayloadProfile,
  type PayloadGeneratorType,
  type PayloadProfile,
  type PayloadProfileValidateInput,
  type PayloadProfileValidationResult,
  type PayloadProfileValidator,
} from "@/lib/distribution/payload-types";

const VALIDATORS: Record<PayloadProfile, PayloadProfileValidator> = {
  "docling-chunks-v1": doclingPayloadValidator,
  "unstructured-elements-v1": unstructuredPayloadValidator,
};

export function getPayloadProfileValidator(profile: PayloadProfile): PayloadProfileValidator {
  return VALIDATORS[profile];
}

export async function validatePayloadProfile(
  profile: string,
  input: PayloadProfileValidateInput,
  options?: { generatorType?: PayloadGeneratorType },
): Promise<PayloadProfileValidationResult> {
  if (!isPayloadProfile(profile)) {
    return {
      ok: false,
      warnings: [],
      errors: [`Unsupported payload profile: ${profile}`],
    };
  }

  if (options?.generatorType) {
    const expected = generatorForProfile(profile);
    if (options.generatorType !== expected) {
      return {
        ok: false,
        warnings: [],
        errors: [
          `Generator type ${options.generatorType} does not match profile ${profile} (expected ${expected})`,
        ],
      };
    }
  }

  return VALIDATORS[profile].validate(input);
}
