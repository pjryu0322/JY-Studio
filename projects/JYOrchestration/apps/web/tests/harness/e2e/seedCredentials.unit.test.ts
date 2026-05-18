import { describe, expect, it } from "vitest";

import {
  SEED_OWNER_EMAIL,
  SEED_OWNER_PASSWORD,
  SEED_PROJECT_NAME,
} from "../../api/helpers";
import {
  E2E_SEED_OWNER_EMAIL,
  E2E_SEED_PASSWORD,
  E2E_SEED_PROJECT_NAME,
} from "../../e2e/seedCredentials";

describe("e2e seedCredentials", () => {
  it("re-exports API helper seed fixtures", () => {
    expect(E2E_SEED_OWNER_EMAIL).toBe(SEED_OWNER_EMAIL);
    expect(E2E_SEED_PASSWORD).toBe(SEED_OWNER_PASSWORD);
    expect(E2E_SEED_PROJECT_NAME).toBe(SEED_PROJECT_NAME);
  });
});
