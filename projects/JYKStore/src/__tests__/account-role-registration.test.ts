import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearConsumerProfile,
  isConsumerRegistered,
  loadConsumerProfile,
  saveConsumerProfile,
} from "../lib/account-role-storage.ts";

function memoryStorage(): {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
} {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

describe("account role storage", () => {
  it("saves and loads consumer profile", () => {
    const storage = memoryStorage();
    assert.equal(isConsumerRegistered(storage), false);
    const saved = saveConsumerProfile(storage, {
      displayName: "JYK 테스트 사용자",
      purpose: "API 연결 테스트",
    });
    assert.ok(saved.registeredAt);
    assert.deepEqual(loadConsumerProfile(storage), saved);
    assert.equal(isConsumerRegistered(storage), true);
    clearConsumerProfile(storage);
    assert.equal(loadConsumerProfile(storage), null);
  });
});
