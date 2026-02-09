import { create, all } from "mathjs";

const math = create(all, {});

export type RowDef = {
  id: string;
  label: string;
  section: string;
  kind: "input" | "output";
  displayUnit?: string | null;
  baseUnit?: string | null;
  toBaseFactor?: number | null;
  defaultDisplayValue?: number | null;
  excel: { cell: string; formula?: string | null };
};

export type Config = {
  rows: RowDef[];
  directDeps: Record<string, string[]>;
  inputDeps: Record<string, string[]>;
};

type ValueState = {
  displayValue: number; // in currently selected display unit
  unitLabel: string | null; // selected label (can differ from spreadsheet default)
  toBase: number | null; // conversion factor from selected unit -> base
};

export function buildInitialState(rows: RowDef[]) {
  const state: Record<string, ValueState> = {};
  for (const r of rows) {
    const unitLabel = r.displayUnit ?? null;
    const toBase = r.toBaseFactor ?? null;
    const dv = r.kind === "input" ? (r.defaultDisplayValue ?? 0) : 0;
    state[r.id] = { displayValue: dv, unitLabel, toBase };
  }
  return state;
}

export function toBaseValue(v: ValueState): number {
  if (v.toBase == null) return v.displayValue;
  return v.displayValue * v.toBase;
}

function sanitizeExcelFormula(excel: string): string {
  // Strip leading '='
  let s = excel.trim();
  if (s.startsWith("=")) s = s.slice(1);

  // Replace PI() with pi
  s = s.replace(/\bPI\(\)/gi, "pi");

  // Replace Excel power notation like 10^-6 with 10^(-6)
  s = s.replace(/(\d+)\^-(\d+)/g, "$1^(-$2)");

  // Excel uses '^' which mathjs supports.
  // CEILING(x,1) -> ceiling(x,1) (we implement ceiling)
  s = s.replace(/\bCEILING\(/gi, "ceiling(");

  return s;
}

function excelCellToId(cell: string, cellToId: Record<string, string>): string | null {
  const c = cell.replace(/\$/g, "");
  return cellToId[c] ?? null;
}

function canonicalToBaseFactor(row: RowDef | undefined) {
  return row?.toBaseFactor ?? 1;
}

function replaceCellRefs(expr: string, cellToId: Record<string, string>, byId: Record<string, RowDef>) {
  // Spreadsheet formulas are authored against display values (B) and conversion factors (D).
  // We evaluate in base units by rewriting:
  // Bn -> (v_n / d_n), Dn -> d_n, and multiply each row result by its own d_row.
  return expr.replace(/\b([A-Z])(\d{1,3})\b/g, (_m, col: string, n: string) => {
    const id = excelCellToId(`B${n}`, cellToId);
    const factor = id ? canonicalToBaseFactor(byId[id]) : 1;

    if (col === "B") {
      return id ? `(v_${id}/${factor})` : "0";
    }
    if (col === "D") {
      return `(${factor})`;
    }

    // Unmodeled sheet columns are treated like blank cells.
    return "0";
  });
}

export function computeAll(rows: RowDef[], state: Record<string, ValueState>) {
  const byId: Record<string, RowDef> = Object.fromEntries(rows.map(r => [r.id, r]));
  const cellToId: Record<string, string> = Object.fromEntries(rows.map(r => [r.excel.cell, r.id]));

  // Variables: base-unit values for every row
  const scope: Record<string, number | ((x: number, sig: number) => number)> = {};
  for (const r of rows) {
    scope[`v_${r.id}`] = toBaseValue(state[r.id]);
  }

  // Custom ceiling(x, sig)
  scope["ceiling"] = (x: number, sig: number) => {
    if (!isFinite(x) || !isFinite(sig) || sig === 0) return NaN;
    return Math.ceil(x / sig) * sig;
  };
  scope["pi"] = Math.PI;

  // Topologically compute outputs by repeated relaxation (small graph, fast)
  const outputs = rows.filter(r => r.kind === "output");
  for (let pass = 0; pass < 10; pass++) {
    let changed = false;
    for (const r of outputs) {
      const formula = r.excel.formula;
      if (!formula) continue;

      const displayExpr = replaceCellRefs(sanitizeExcelFormula(formula), cellToId, byId);
      const expr = `(${displayExpr})*(${canonicalToBaseFactor(r)})`;
      let baseVal: number;
      try {
        baseVal = math.evaluate(expr, scope);
      } catch {
        baseVal = NaN;
      }
      const prevVal = scope[`v_${r.id}`] as number;
      if (prevVal !== baseVal) {
        scope[`v_${r.id}`] = baseVal;
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Return base values
  const baseValues: Record<string, number> = {};
  for (const r of rows) baseValues[r.id] = scope[`v_${r.id}`] as number;
  return { baseValues, cellToId };
}

export function fromBase(base: number, toBase: number | null) {
  if (toBase == null) return base;
  return base / toBase;
}

export function readableFormula(excel: string, rows: RowDef[]) {
  const cellToLabel: Record<string, string> = Object.fromEntries(rows.map(r => [r.excel.cell, r.label]));
  const hasWrappingParens = (expr: string) => {
    if (!(expr.startsWith("(") && expr.endsWith(")"))) return false;
    let depth = 0;
    for (let i = 0; i < expr.length; i++) {
      const ch = expr[i];
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (depth === 0 && i < expr.length - 1) return false;
    }
    return depth === 0;
  };

  let s = excel.trim();
  if (s.startsWith("=")) s = s.slice(1);

  // Hide spreadsheet unit-conversion helper cells (D column) in the UI formula text.
  // The engine still uses them for computation; this is display-only.
  s = s.replace(/\*\s*D\d{1,3}\b/g, "");
  s = s.replace(/\/\s*D\d{1,3}\b/g, "");

  // Replace B12 etc with row labels
  s = s.replace(/\bB(\d{1,3})\b/g, (_m, n) => {
    const label = cellToLabel[`B${n}`];
    return label ?? `B${n}`;
  });

  // Any remaining D refs are shown as 1 for readability.
  s = s.replace(/\bD(\d{1,3})\b/g, "1");
  s = s.replace(/\*\s*1\b/g, "");
  s = s.replace(/\/\s*1\b/g, "");
  s = s.replace(/\bPI\(\)/gi, "π");
  s = s.replace(/\bCEILING\(/gi, "ceiling(");

  // Remove redundant parens around single labels/numbers for cleaner display.
  let prev = "";
  while (prev !== s) {
    prev = s;
    s = s.replace(/\(\s*([A-Za-z0-9#.%µ²³\s-]+)\s*\)/g, "$1");
  }

  while (hasWrappingParens(s)) {
    s = s.slice(1, -1).trim();
  }

  s = s.replace(/\s*([+*/^=])\s*/g, " $1 ");
  s = s.replace(/\s*-\s*/g, " - ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}
