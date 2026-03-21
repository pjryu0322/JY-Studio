/** Mock session: replace with real auth when available. */
export const MOCK_CURRENT_USER_ID = "demo-user-1";

/**
 * User id recorded as OWNER when a project is created (mock creator).
 * Aligns with {@link MOCK_CURRENT_USER_ID} until real auth supplies creator id.
 */
export const MOCK_PROJECT_CREATOR_USER_ID = MOCK_CURRENT_USER_ID;
