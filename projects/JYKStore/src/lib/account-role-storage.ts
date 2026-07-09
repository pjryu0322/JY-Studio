/**
 * Client-side consumer role profile (UX only).
 * TODO: persist display name / purpose server-side when account login ships.
 */

export type ConsumerProfile = {
  displayName: string;
  purpose: string;
  registeredAt: string;
};

export const CONSUMER_PROFILE_STORAGE_KEY = "jykstore_consumer_profile";

export type StringStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function loadConsumerProfile(storage: StringStorage): ConsumerProfile | null {
  const raw = storage.getItem(CONSUMER_PROFILE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ConsumerProfile;
    if (!parsed.displayName?.trim() || !parsed.purpose?.trim() || !parsed.registeredAt) {
      return null;
    }
    return {
      displayName: parsed.displayName.trim(),
      purpose: parsed.purpose.trim(),
      registeredAt: parsed.registeredAt,
    };
  } catch {
    return null;
  }
}

export function saveConsumerProfile(storage: StringStorage, profile: Omit<ConsumerProfile, "registeredAt">) {
  const payload: ConsumerProfile = {
    displayName: profile.displayName.trim(),
    purpose: profile.purpose.trim(),
    registeredAt: new Date().toISOString(),
  };
  storage.setItem(CONSUMER_PROFILE_STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

export function clearConsumerProfile(storage: StringStorage) {
  storage.removeItem(CONSUMER_PROFILE_STORAGE_KEY);
}

export function isConsumerRegistered(storage: StringStorage): boolean {
  return loadConsumerProfile(storage) !== null;
}
