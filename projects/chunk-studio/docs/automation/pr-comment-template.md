## GPT Auto-Review Context

### Scope

- Monorepo: `JY-Studio`
- Project scope: `projects/chunk-studio`

### Product Direction Guardrails

- PDF-first only
- Preserve chunk pipeline compatibility
- Keep workspace architecture (analyzer + overlay + inspector)

### Expected Review Focus

- Regression risk
- State-flow integrity
- API contract compatibility
- Missing tests

### Additional Notes

- Please flag any accidental non-PDF path reintroduction.
