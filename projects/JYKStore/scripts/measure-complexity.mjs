/**
 * Approximate cyclomatic-complexity measurement for TS source files.
 *
 * AST-based (via the TypeScript compiler API) rather than regex/brace-slicing,
 * so it:
 *  - correctly finds each function's body even when parameters or return
 *    types contain object-literal braces (e.g. `fn(x: { a: string }): { b: number } { ... }`),
 *  - scopes each function-like node (function/arrow/method) independently,
 *    so extracting a nested callback into its own function actually reduces
 *    the enclosing function's score (encourages decomposition),
 *  - only counts real decision points (if/else-if, loops, switch cases,
 *    catch, ternary, &&, ||, ??) instead of every literal `?` character
 *    (which previously double-counted `??`/`?.`/optional params as branches).
 *
 * Usage: node scripts/measure-complexity.mjs [dir ...]
 * Exits 1 if any measured function has approx CC > 30.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const roots = process.argv.slice(2);
const targets = roots.length > 0 ? roots : ["src/lib/distribution", "src/lib/provider-pack"];

function walk(dirOrFile, acc = []) {
  const stat = statSync(dirOrFile);
  if (stat.isFile()) {
    if (dirOrFile.endsWith(".ts") && !dirOrFile.endsWith(".d.ts")) acc.push(dirOrFile);
    return acc;
  }
  for (const name of readdirSync(dirOrFile)) {
    const p = join(dirOrFile, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (p.endsWith(".ts") && !p.endsWith(".d.ts")) acc.push(p);
  }
  return acc;
}

function isFunctionLike(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessor(node) ||
    ts.isSetAccessor(node) ||
    ts.isConstructorDeclaration(node)
  );
}

function nameForFunctionLike(node, sourceFile) {
  if (node.name && (ts.isIdentifier(node.name) || ts.isPrivateIdentifier(node.name))) {
    return node.name.text;
  }
  if (ts.isConstructorDeclaration(node)) return "constructor";
  const parent = node.parent;
  if (parent) {
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text;
    }
    if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text;
    }
    if (ts.isPropertyDeclaration(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text;
    }
    if (ts.isCallExpression(parent)) {
      // e.g. `.map((x) => ...)`, `.then((x) => ...)`
      const callee = parent.expression;
      const calleeName = ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : ts.isIdentifier(callee)
          ? callee.text
          : "call";
      return `<${calleeName}-callback>`;
    }
  }
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `<anonymous:${line + 1}>`;
}

/**
 * Count decision points within `node`, NOT descending into nested
 * function-like nodes (those are measured independently).
 */
function countDecisionPoints(node) {
  let count = 0;
  const visit = (n) => {
    if (n !== node && isFunctionLike(n)) return; // measured separately
    if (ts.isIfStatement(n)) count += 1;
    else if (ts.isConditionalExpression(n)) count += 1;
    else if (
      ts.isForStatement(n) ||
      ts.isForInStatement(n) ||
      ts.isForOfStatement(n) ||
      ts.isWhileStatement(n) ||
      ts.isDoStatement(n)
    ) {
      count += 1;
    } else if (ts.isCatchClause(n)) count += 1;
    else if (ts.isCaseClause(n)) count += 1;
    else if (
      ts.isBinaryExpression(n) &&
      (n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        n.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
        n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
    ) {
      count += 1;
    }
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(node, visit);
  return count;
}

function extractFns(filePath, src) {
  const sourceFile = ts.createSourceFile(filePath, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const fns = [];
  const visit = (node) => {
    if (isFunctionLike(node) && node.body) {
      const name = nameForFunctionLike(node, sourceFile);
      const cc = 1 + countDecisionPoints(node.body);
      const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      const endLine = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
      fns.push({ name, cc, loc: endLine - startLine + 1, line: startLine });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return fns;
}

const all = [];
for (const root of targets) {
  for (const f of walk(root)) {
    const src = readFileSync(f, "utf8");
    for (const fn of extractFns(f, src)) {
      all.push({ file: f.replace(/\\/g, "/"), ...fn });
    }
  }
}
all.sort((a, b) => b.cc - a.cc);
const over30 = all.filter((x) => x.cc > 30);
console.log("Top 25:");
for (const x of all.slice(0, 25)) {
  console.log(String(x.cc).padStart(3), `${x.file}:${x.name} (L${x.line}, ${x.loc} lines)`);
}
console.log(`CC>30 count: ${over30.length}`);
for (const x of over30) {
  console.log(" ", x.cc, `${x.file}:${x.name} (L${x.line})`);
}
process.exit(over30.length > 0 ? 1 : 0);
