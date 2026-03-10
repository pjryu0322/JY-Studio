"use client";

import { useState } from "react";
import { CSS } from "@dnd-kit/utilities";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import InlineFormContainer from "./InlineFormContainer";
import InlineNameForm from "./InlineNameForm";
import TreeLeafRow from "./TreeLeafRow";

interface SectionNode {
  id: string;
  title: string;
  level: number;
  parentId?: string;
  orderHint?: number;
  bboxHint?: { page: number; x: number; y: number; w: number; h: number };
}

interface FieldNode {
  key: string;
  label: string;
  sectionId?: string;
  bboxHint?: { page: number; x: number; y: number; w: number; h: number };
}

interface TemplateTreeProps {
  templateName: string;
  sections: SectionNode[];
  fields: FieldNode[];
  tables: Array<{
    id: string;
    name: string;
    sectionId?: string;
    bboxHint?: { page: number; x: number; y: number; w: number; h: number };
  }>;
  repeatBlocks: Array<{
    id: string;
    name: string;
    sectionId?: string;
    bboxHint?: { page: number; x: number; y: number; w: number; h: number };
  }>;
  onUpdateSection: (
    id: string,
    patch: Partial<{
      title: string;
      level: number;
      parentId?: string;
    }>
  ) => void;
  onDeleteSection: (id: string) => void;
  onUpdateField: (key: string, patch: Partial<{ label: string; sectionId?: string }>) => void;
  onDeleteField: (key: string) => void;
  onUpdateTable: (id: string, patch: Partial<{ name: string; sectionId?: string }>) => void;
  onDeleteTable: (id: string) => void;
  onUpdateRepeatBlock: (
    id: string,
    patch: Partial<{ name: string; sectionId?: string }>
  ) => void;
  onDeleteRepeatBlock: (id: string) => void;
  onMoveSection: (from: number, to: number) => void;
  onQuickAddChild: (
    sectionId: string,
    type: "field" | "table" | "repeat",
    name: string
  ) => void;
  onFocusNode: (nodeId: string) => void;
  focusedNodeId?: string | null;
}

function SortableSection({
  id,
  title,
  orderHint,
  focused,
  onFocus,
}: {
  id: string;
  title: string;
  orderHint?: number;
  focused?: boolean;
  onFocus: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    border: focused ? "2px solid #0d47a1" : "1px solid #ddd",
    borderRadius: 8,
    background: "#fff",
    padding: 8,
    fontSize: 12,
    marginBottom: 6,
    cursor: "grab",
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onFocus(id)}
    >
      {`#${orderHint ?? "-"} ${title}`}
    </div>
  );
}

const smallBtnStyle = { fontSize: 11 } as const;
const menuItemStyle = {
  width: "100%",
  textAlign: "left",
  border: 0,
  background: "transparent",
  padding: "8px 10px",
  fontSize: 12,
  cursor: "pointer",
} as const;

export default function TemplateTree({
  templateName,
  sections,
  fields,
  tables,
  repeatBlocks,
  onUpdateSection,
  onDeleteSection,
  onUpdateField,
  onDeleteField,
  onUpdateTable,
  onDeleteTable,
  onUpdateRepeatBlock,
  onDeleteRepeatBlock,
  onMoveSection,
  onQuickAddChild,
  onFocusNode,
  focusedNodeId,
}: TemplateTreeProps) {
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<Set<string>>(new Set());
  const [inlineEdit, setInlineEdit] = useState<
    | {
        type: "section";
        id: string;
        title: string;
        level: string;
        parentId: string;
      }
    | {
        type: "field" | "table" | "repeat";
        id: string;
        name: string;
      }
    | null
  >(null);
  const [inlineCreate, setInlineCreate] = useState<{
    sectionId: string;
    type: "field" | "table" | "repeat";
    name: string;
  } | null>(null);
  const [sectionMenu, setSectionMenu] = useState<{
    sectionId: string;
    x: number;
    y: number;
  } | null>(null);
  const sectionMap = new Map(sections.map((section) => [section.id, section]));
  const rootSections = sections.filter((section) => !section.parentId);

  const asTreeDepth = (section: SectionNode): number => {
    let depth = 0;
    let cursor = section;
    const guard = new Set<string>();
    while (cursor.parentId && !guard.has(cursor.parentId)) {
      const parent = sectionMap.get(cursor.parentId);
      if (!parent) break;
      guard.add(cursor.parentId);
      depth += 1;
      cursor = parent;
    }
    return depth;
  };

  const startSectionEdit = (section: SectionNode) => {
    setInlineEdit({
      type: "section",
      id: section.id,
      title: section.title,
      level: String(section.level),
      parentId: section.parentId ?? "",
    });
  };
  const submitSectionEdit = () => {
    if (!inlineEdit || inlineEdit.type !== "section") return;
    const title = inlineEdit.title.trim();
    if (!title) return;
    const levelNum = Number(inlineEdit.level);
    const validLevel = Number.isFinite(levelNum)
      ? Math.max(1, Math.min(6, levelNum))
      : 1;
    onUpdateSection(inlineEdit.id, {
      title,
      level: validLevel,
      parentId: inlineEdit.parentId || undefined,
    });
    setInlineEdit(null);
  };
  const startSimpleEdit = (
    type: "field" | "table" | "repeat",
    id: string,
    name: string
  ) => {
    setInlineEdit({ type, id, name });
  };
  const submitSimpleEdit = () => {
    if (!inlineEdit || inlineEdit.type === "section") return;
    const name = inlineEdit.name.trim();
    if (!name) return;
    if (inlineEdit.type === "field") {
      onUpdateField(inlineEdit.id, { label: name });
    } else if (inlineEdit.type === "table") {
      onUpdateTable(inlineEdit.id, { name });
    } else {
      onUpdateRepeatBlock(inlineEdit.id, { name });
    }
    setInlineEdit(null);
  };
  const toggleSectionCollapsed = (sectionId: string) => {
    setCollapsedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const renderSectionNode = (section: SectionNode) => {
    const depth = asTreeDepth(section);
    const childSections = sections.filter((candidate) => candidate.parentId === section.id);
    const childFields = fields.filter((field) => field.sectionId === section.id);
    const childTables = tables.filter((table) => table.sectionId === section.id);
    const childRepeats = repeatBlocks.filter((block) => block.sectionId === section.id);
    const collapsed = collapsedSectionIds.has(section.id);
    const openInlineCreate = (type: "field" | "table" | "repeat") => {
      setInlineCreate({
        sectionId: section.id,
        type,
        name: type === "field" ? "필드" : type === "table" ? "표" : "반복 블록",
      });
    };
    const submitInlineCreate = () => {
      if (!inlineCreate || inlineCreate.sectionId !== section.id) return;
      const trimmed = inlineCreate.name.trim();
      if (!trimmed) return;
      onQuickAddChild(section.id, inlineCreate.type, trimmed);
      setInlineCreate(null);
    };
    return (
      <div key={section.id} style={{ marginBottom: 6, marginLeft: depth * 12 }}>
        <div
          style={{ display: "flex", gap: 6, alignItems: "center" }}
          onContextMenu={(e) => {
            e.preventDefault();
            setSectionMenu({ sectionId: section.id, x: e.clientX, y: e.clientY });
          }}
        >
          <div style={{ flex: 1 }}>
            <SortableSection
              id={section.id}
              title={section.title}
              orderHint={section.orderHint}
              focused={focusedNodeId === section.id}
              onFocus={onFocusNode}
            />
          </div>
          <button type="button" onClick={() => startSectionEdit(section)} style={smallBtnStyle}>
            수정
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openInlineCreate("field");
            }}
            style={smallBtnStyle}
          >
            +Field
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openInlineCreate("table");
            }}
            style={smallBtnStyle}
          >
            +Table
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openInlineCreate("repeat");
            }}
            style={smallBtnStyle}
          >
            +Repeat
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("섹션을 삭제하면 하위 노드도 같이 삭제됩니다. 계속할까요?")) {
                onDeleteSection(section.id);
              }
            }}
            style={smallBtnStyle}
          >
            삭제
          </button>
          <button
            type="button"
            onClick={() => toggleSectionCollapsed(section.id)}
            style={smallBtnStyle}
          >
            {collapsed ? "펼치기" : "접기"}
          </button>
        </div>
        {inlineEdit?.type === "section" && inlineEdit.id === section.id && (
          <InlineFormContainer
            margin="6px 0 4px 14px"
            onSubmit={submitSectionEdit}
            onCancel={() => setInlineEdit(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitSectionEdit();
              } else if (e.key === "Escape") {
                setInlineEdit(null);
              }
            }}
          >
            <input
              value={inlineEdit.title}
              onChange={(e) =>
                setInlineEdit((prev) =>
                  prev && prev.type === "section"
                    ? { ...prev, title: e.target.value }
                    : prev
                )
              }
              placeholder="섹션명"
              style={{ flex: 1, fontSize: 12, padding: "4px 6px" }}
            />
            <input
              value={inlineEdit.level}
              onChange={(e) =>
                setInlineEdit((prev) =>
                  prev && prev.type === "section"
                    ? { ...prev, level: e.target.value }
                    : prev
                )
              }
              placeholder="레벨"
              style={{ width: 54, fontSize: 12, padding: "4px 6px" }}
            />
            <select
              value={inlineEdit.parentId}
              onChange={(e) =>
                setInlineEdit((prev) =>
                  prev && prev.type === "section"
                    ? { ...prev, parentId: e.target.value }
                    : prev
                )
              }
              style={{ width: 180, fontSize: 12, padding: "4px 6px" }}
            >
              <option value="">상위 없음</option>
              {sections
                .filter((candidate) => candidate.id !== section.id)
                .map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    #{candidate.orderHint ?? "-"} {candidate.title}
                  </option>
                ))}
            </select>
          </InlineFormContainer>
        )}
        {inlineCreate?.sectionId === section.id && (
          <InlineNameForm
            margin="6px 0 4px 14px"
            value={inlineCreate.name}
            onChange={(name) =>
              setInlineCreate((prev) => (prev ? { ...prev, name } : prev))
            }
            onSubmit={submitInlineCreate}
            onCancel={() => setInlineCreate(null)}
            submitLabel="추가"
          />
        )}
        {!collapsed && (
          <div style={{ marginLeft: 14, marginTop: 4 }}>
            {childFields.map((field) => (
            <TreeLeafRow
              key={field.key}
              label={`├ Field: ${field.label}`}
              focused={focusedNodeId === field.key}
              onFocus={() => onFocusNode(field.key)}
              onEdit={() => startSimpleEdit("field", field.key, field.label)}
              onDelete={() => onDeleteField(field.key)}
            />
            ))}
            {inlineEdit?.type === "field" &&
              childFields.some((field) => field.key === inlineEdit.id) && (
              <InlineNameForm
                value={inlineEdit.name}
                onChange={(name) =>
                  setInlineEdit((prev) =>
                    prev && prev.type === "field" ? { ...prev, name } : prev
                  )
                }
                onSubmit={submitSimpleEdit}
                onCancel={() => setInlineEdit(null)}
              />
              )}
            {childTables.map((table) => (
            <TreeLeafRow
              key={table.id}
              label={`├ Table: ${table.name}`}
              focused={focusedNodeId === table.id}
              onFocus={() => onFocusNode(table.id)}
              onEdit={() => startSimpleEdit("table", table.id, table.name)}
              onDelete={() => onDeleteTable(table.id)}
            />
            ))}
            {inlineEdit?.type === "table" &&
              childTables.some((table) => table.id === inlineEdit.id) && (
              <InlineNameForm
                value={inlineEdit.name}
                onChange={(name) =>
                  setInlineEdit((prev) =>
                    prev && prev.type === "table" ? { ...prev, name } : prev
                  )
                }
                onSubmit={submitSimpleEdit}
                onCancel={() => setInlineEdit(null)}
              />
              )}
            {childRepeats.map((block) => (
            <TreeLeafRow
              key={block.id}
              label={`├ Repeat: ${block.name}`}
              focused={focusedNodeId === block.id}
              onFocus={() => onFocusNode(block.id)}
              onEdit={() => startSimpleEdit("repeat", block.id, block.name)}
              onDelete={() => onDeleteRepeatBlock(block.id)}
            />
            ))}
            {inlineEdit?.type === "repeat" &&
              childRepeats.some((block) => block.id === inlineEdit.id) && (
              <InlineNameForm
                value={inlineEdit.name}
                onChange={(name) =>
                  setInlineEdit((prev) =>
                    prev && prev.type === "repeat" ? { ...prev, name } : prev
                  )
                }
                onSubmit={submitSimpleEdit}
                onCancel={() => setInlineEdit(null)}
              />
              )}
            {childSections.map((child) => renderSectionNode(child))}
          </div>
        )}
      </div>
    );
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((s) => s.id === active.id);
    const to = sections.findIndex((s) => s.id === over.id);
    if (from < 0 || to < 0) return;
    onMoveSection(from, to);
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 10 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Template Structure</h3>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <button
          type="button"
          style={smallBtnStyle}
          onClick={() => setCollapsedSectionIds(new Set())}
        >
          Expand All
        </button>
        <button
          type="button"
          style={smallBtnStyle}
          onClick={() => setCollapsedSectionIds(new Set(sections.map((section) => section.id)))}
        >
          Collapse All
        </button>
      </div>
      <div style={{ fontSize: 13, marginBottom: 8 }}>{templateName || "새 템플릿"}</div>
      <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {rootSections.map((section) => renderSectionNode(section))}
        </SortableContext>
      </DndContext>
      {sections.length === 0 && (
        <div style={{ fontSize: 12, color: "#666" }}>아직 구조 요소가 없습니다.</div>
      )}
      {sectionMenu && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 40 }}
            onClick={() => setSectionMenu(null)}
          />
          <div
            style={{
              position: "fixed",
              left: sectionMenu.x,
              top: sectionMenu.y,
              zIndex: 41,
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: 8,
              boxShadow: "0 10px 20px rgba(0,0,0,0.08)",
              minWidth: 180,
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setInlineCreate({
                  sectionId: sectionMenu.sectionId,
                  type: "field",
                  name: "필드",
                });
                setSectionMenu(null);
              }}
              style={menuItemStyle}
            >
              하위 Field 추가
            </button>
            <button
              type="button"
              onClick={() => {
                setInlineCreate({
                  sectionId: sectionMenu.sectionId,
                  type: "table",
                  name: "표",
                });
                setSectionMenu(null);
              }}
              style={menuItemStyle}
            >
              하위 Table 추가
            </button>
            <button
              type="button"
              onClick={() => {
                setInlineCreate({
                  sectionId: sectionMenu.sectionId,
                  type: "repeat",
                  name: "반복 블록",
                });
                setSectionMenu(null);
              }}
              style={menuItemStyle}
            >
              하위 Repeat 추가
            </button>
          </div>
        </>
      )}
    </div>
  );
}

