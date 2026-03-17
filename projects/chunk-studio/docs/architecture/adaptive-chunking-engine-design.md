# Adaptive Chunking Engine Design
Project: Chunk Studio  
Phase: 5 (Adaptive Intelligence Layer)

---

## 1. Purpose

Adaptive Chunking Engine is designed to dynamically adjust chunking strategies based on:

- Document Family
- Page Type
- Layout Features

Goal:
> Move from static chunking → document-aware semantic chunking

---

## 2. System Position

PDF Upload
→ Layout Extraction
→ Page Analyzer
→ Page Type Classifier
→ Document Family Resolver
→ Adaptive Strategy Resolver
→ Semantic Chunk Engine
→ Chunk Quality Engine
→ Overlay / Inspector
→ Admin Tools

---

## 3. Core Components

### 3.1 Document Family Resolver

Determines the document type.

#### Input
- Page type distribution
- Heading patterns
- Table density
- Form-like structures
- Text density

#### Output
{
  documentFamilyId,
  confidence,
  reasoning
}

---

### 3.2 Adaptive Chunk Strategy Resolver

Selects chunking strategy based on:

- documentFamilyId
- pageType
- layout profile

#### Output
{
  strategyId,
  config
}

---

### 3.3 Strategy-aware Chunk Engine

Existing chunk engine enhanced with strategy injection.

---

## 4. Document Families (MVP)

| ID | Name | Strategy |
|----|------|--------|
| DF-01 | Public RFP | section_requirement_hybrid |
| DF-02 | Report | heading_paragraph_hybrid |
| DF-03 | Contract / Regulation | clause_preserving |
| DF-04 | Standard / Guide | heading_bullet_table_hybrid |
| DF-05 | Manual | procedure_step |
| DF-06 | Form | form_block |
| DF-07 | Slide / PPT PDF | page_block |

---

## 5. Strategy Types

### heading_paragraph_hybrid
- Preserve heading
- Merge short paragraphs
- Split long text

### section_requirement_hybrid
- Preserve requirement sections
- Keep bullet structures

### clause_preserving
- Preserve article / clause boundaries
- No mid-sentence split

### form_block
- Field-group based chunking
- Maintain structure

### page_block
- Page-level chunking
- No cross-page merge

### heading_bullet_table_hybrid
- Preserve heading
- Keep bullet/list
- Separate tables

---

## 6. Strategy Config Schema

{
  "strategyId": "heading_paragraph_hybrid",
  "preserveHeading": true,
  "mergeShortParagraphs": true,
  "splitLongBlocks": true,
  "separateTables": true,
  "minTokens": 60,
  "maxTokens": 450
}

---

## 7. Execution Flow

1. Document Family Detection  
2. Page Type Detection  
3. Strategy Selection  
4. Chunk Generation  
5. Quality Evaluation  
6. Overlay Feedback  

---

## 8. Quality Integration

Quality score must consider strategy context.

---

## 9. Decision Trace

{
  "page": 12,
  "documentFamily": "DF-04",
  "pageType": "body",
  "strategy": "heading_bullet_table_hybrid",
  "reason": ["heading_detected", "bullet_density_high"]
}

---

## 10. Admin Integration

- Strategy usage distribution
- Avg quality per strategy
- Override logs

---

## 11. Implementation Priority

- Phase 5-1: Document Family Resolver
- Phase 5-2: Strategy Resolver
- Phase 5-3: Engine Integration

---

## 12. MVP Scope

Start with:
- DF-01
- DF-04
- DF-06
- DF-07

---

## 13. Success Criteria

- Different document types → different chunk outputs
- Strategy-aware chunking visible

---

## 14. Principle

Adaptive Chunking = Intelligence Layer
