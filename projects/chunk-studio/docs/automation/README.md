# GPT x Cursor Review Loop

This package gives you a repeatable review loop between Cursor changes and GPT feedback.

## What is included

- `GPT_REVIEW_PROMPT.md`: fixed review instruction for Chunk Studio
- `gpt-pr-review.workflow.yml`: GitHub Actions workflow template
- `pr-comment-template.md`: optional PR template body for review context

## Why this is a template

GitHub Actions only runs workflows under repository root:

- `.github/workflows/*.yml`

This repository task is scoped to `projects/chunk-studio`, so the workflow is stored here as a template.  
Copy it to repository root when ready.

## Setup steps

1. Copy workflow template:
   - from `projects/chunk-studio/docs/automation/gpt-pr-review.workflow.yml`
   - to `<repo-root>/.github/workflows/gpt-pr-review.yml`
2. Add repository secret:
   - `OPENAI_API_KEY`
3. Ensure PRs target Chunk Studio paths:
   - `projects/chunk-studio/**`
4. Open or update a PR
5. Action posts GPT review comment automatically

## Optional improvements

- Add branch protection requiring review job success
- Add a second GPT pass when files change after fixes
- Route final summary to Slack/Teams with webhook
