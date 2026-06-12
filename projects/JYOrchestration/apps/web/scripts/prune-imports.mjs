import fs from "fs";

const path = process.argv[2];
const bodyMarker = process.argv[3];
if (!path || !bodyMarker) {
  console.error("usage: node prune-imports.mjs <file> <bodyMarker>");
  process.exit(1);
}

const text = fs.readFileSync(path, "utf8");
const markerIdx = text.indexOf(bodyMarker);
if (markerIdx < 0) throw new Error(`marker not found: ${bodyMarker}`);
const importSection = text.slice(0, markerIdx);
const rest = text.slice(markerIdx);

function isUsed(name) {
  const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
  return re.test(rest);
}

const lines = importSection.split(/\r?\n/);
const out = [];
let i = 0;
while (i < lines.length) {
  const line = lines[i];
  if (!line.startsWith("import ") && !line.startsWith("import type")) {
    out.push(line);
    i++;
    continue;
  }
  const block = [line];
  i++;
  while (i < lines.length && !block[block.length - 1].includes(";")) {
    block.push(lines[i]);
    i++;
  }
  const blockText = block.join("\n");
  const sideEffect = /import\s+["']/.test(blockText) && !blockText.includes("{");
  if (sideEffect) {
    out.push(...block);
    continue;
  }
  const braceMatch = blockText.match(/\{([\s\S]*?)\}\s*from\s+["']([^"']+)["']/);
  if (!braceMatch) {
    out.push(...block);
    continue;
  }
  const from = braceMatch[2];
  const specs = braceMatch[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const kept = specs.filter((spec) => {
    const cleaned = spec.replace(/^type\s+/, "").trim();
    const m = cleaned.match(/^(\w+)(?:\s+as\s+(\w+))?$/);
    if (!m) return true;
    const local = m[2] ?? m[1];
    return isUsed(local);
  });
  if (!kept.length) continue;
  const blockIsTypeOnly = blockText.startsWith("import type");
  const formatted = kept.map((spec) => {
    const trimmed = spec.trim();
    const inlineType = trimmed.startsWith("type ");
    const name = inlineType ? trimmed.slice(5).trim() : trimmed;
    if (blockIsTypeOnly) return name;
    return inlineType ? `type ${name}` : name;
  });
  const prefix = blockIsTypeOnly ? "import type" : "import";
  const inner = formatted.join(",\n  ");
  out.push(`${prefix} {\n  ${inner},\n} from "${from}";`);
}

fs.writeFileSync(path, out.join("\n") + rest);
console.log("Pruned", path);
