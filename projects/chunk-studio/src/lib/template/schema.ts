import { z } from "zod";

export const bboxHintSchema = z.object({
  page: z.number().int().nonnegative(),
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
});

export const templateSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().min(1),
  family: z.string().min(1),
  docType: z.enum([
    "weekly_report",
    "monthly_report",
    "meeting_minutes",
    "form",
    "unknown",
  ]),
  version: z.string().min(1),
  anchors: z.array(
    z.object({
      type: z.enum(["text", "regex"]),
      value: z.string().min(1),
      weight: z.number().min(0).max(1),
    })
  ),
  sections: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        level: z.number().int().min(1).max(6),
        required: z.boolean(),
        parentId: z.string().optional(),
        orderHint: z.number().int().optional(),
        bboxHint: bboxHintSchema.optional(),
      })
    )
    .min(1),
  fields: z.array(
    z.object({
      key: z.string().min(1),
      label: z.string().min(1),
      required: z.boolean(),
      sectionId: z.string().optional(),
      bboxHint: bboxHintSchema.optional(),
    })
  ),
  tables: z.array(
    z.object({
      id: z.string().min(1),
      sectionId: z.string().optional(),
      headerLabels: z.array(z.string()),
      required: z.boolean(),
      bboxHint: bboxHintSchema.optional(),
    })
  ),
  repeatBlocks: z.array(
    z.object({
      id: z.string().min(1),
      sectionId: z.string().optional(),
      pattern: z.string().min(1),
      min: z.number().int().optional(),
      max: z.number().int().optional(),
      bboxHint: bboxHintSchema.optional(),
    })
  ),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const templateListItemSchema = z.object({
  templateId: z.string(),
  name: z.string(),
  docType: templateSchema.shape.docType,
  latestVersion: z.string(),
  updatedAt: z.string(),
});

export type TemplateSchema = z.infer<typeof templateSchema>;
export type TemplateListItem = z.infer<typeof templateListItemSchema>;

