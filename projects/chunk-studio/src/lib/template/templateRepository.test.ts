import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { listTemplates, saveTemplate } from "./templateRepository";
import type { TemplateSchema } from "./schema";

const cleanupFamilies: string[] = [];

function createSchema(family: string, templateId: string): TemplateSchema {
  const now = new Date().toISOString();
  return {
    templateId,
    name: "Versioning Test Template",
    family,
    docType: "form",
    version: "v0.1",
    anchors: [],
    sections: [
      {
        id: "sec_1",
        title: "인적사항",
        level: 1,
        required: true,
      },
    ],
    fields: [],
    tables: [],
    repeatBlocks: [],
    createdAt: now,
    updatedAt: now,
  };
}

describe("templateRepository versioning", () => {
  it("increments version when saving existing templateId", async () => {
    const family = `test/versioning-${Date.now()}`;
    cleanupFamilies.push(family);
    const templateId = "tpl_version_test";

    const first = await saveTemplate(createSchema(family, templateId));
    const second = await saveTemplate(createSchema(family, templateId));

    expect(first.version).toBe("v0.1");
    expect(second.version).toBe("v0.2");

    const list = await listTemplates(family);
    expect(list).toHaveLength(1);
    expect(list[0]?.latestVersion).toBe("v0.2");
    expect(typeof list[0]?.updatedAt).toBe("string");

    const secondPath = path.join(
      process.cwd(),
      "data",
      "templates",
      family,
      templateId,
      "v0.2",
      "template.json"
    );
    const raw = await readFile(secondPath, "utf-8");
    const saved = JSON.parse(raw) as TemplateSchema;
    expect(saved.version).toBe("v0.2");
  });
});

afterAll(async () => {
  await Promise.all(
    cleanupFamilies.map((family) =>
      rm(path.join(process.cwd(), "data", "templates", family), {
        recursive: true,
        force: true,
      })
    )
  );
});
