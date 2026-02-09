"use client";

import { useEffect, useMemo, useState } from "react";
import cfg from "../calculator/config.json";
import type { Config, RowDef } from "../calculator/engine";
import { buildInitialState, computeAll, fromBase, readableFormula } from "../calculator/engine";
import { unitOptionsForBase, type UnitOption } from "../calculator/units";
import { InfoPopover } from "./InfoPopover";
import { SuggestionsBox } from "./SuggestionsBox";

const config = cfg as unknown as Config;

function formatNumber(n: number) {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs === 0) return "0";
  if (abs >= 1000) {
    return Math.round(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  if (Number.isInteger(n)) {
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function normalizeUnitLabel(label: string | null | undefined) {
  return (label ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/^s$/, "second")
    .replace(/^sec$/, "second")
    .replace(/^secs$/, "second")
    .replace(/^min$/, "minute")
    .replace(/^mins$/, "minute")
    .replace(/seconds?$/, "second")
    .replace(/minutes?$/, "minute")
    .replace(/hours?$/, "hour")
    .replace(/days?$/, "day");
}

function factorsEqual(a: number, b: number) {
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= scale * 1e-12;
}

export function Calculator() {
  const rows = config.rows;
  const keyOutputLabels = useMemo(() => (
    new Set([
      "total cutting and collecting time",
      "total cutting time",
      "total milling time",
      "total scanning time",
      "total time for stage movements",
      "total",
    ])
  ), []);
  const movedToImagingIds = useMemo(() => (
    new Set([
      "time_for_one_imaging_milling_duty_cycle",
      "total_time_for_imaging_milling_duty_cycles",
    ])
  ), []);
  const totalRowIds = useMemo(() => {
    return new Set(
      rows
        .filter(r => r.label.trim().toLowerCase() === "total")
        .map(r => r.id),
    );
  }, [rows]);

  const sections = useMemo(() => {
    const order: string[] = [];
    for (const r of rows) {
      const s = (r.section ?? "").trim();
      if (!s) continue;
      if (!order.includes(s)) order.push(s);
    }

    // Prefer hiding synthetic "Overview", but still render if it's the only section.
    const withoutOverview = order.filter(s => s !== "Overview");
    return withoutOverview.length > 0 ? withoutOverview : order;
  }, [rows]);

  const [state, setState] = useState(() => buildInitialState(rows));
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [hoveredInfoId, setHoveredInfoId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [showCollapsedRowsBySection, setShowCollapsedRowsBySection] = useState<Record<string, boolean>>({});
  const defaultVisibleInputIds = useMemo(
    () =>
      new Set([
        "length_along_cutting_axis",
        "section_thickness",
        "cutting_speed",
        "area_of_one_section",
        "milling_depth",
        "milling_rate",
        "area_to_scan_in_each_section",
        "pixel_size",
        "dwell_time",
        "stage_settling_time",
      ]),
    [],
  );

  function isKeyOutputRow(r: RowDef) {
    return r.kind === "output" && keyOutputLabels.has(r.label.trim().toLowerCase());
  }

  const defaultCollapsedRowIds = useMemo(
    () =>
      new Set(
        rows
          .filter(r => !isKeyOutputRow(r) && !defaultVisibleInputIds.has(r.id))
          .map(r => r.id),
      ),
    [rows, defaultVisibleInputIds, keyOutputLabels],
  );

  useEffect(() => {
    setCollapsedSections((prev) => {
      const next: Record<string, boolean> = {};
      for (const section of sections) next[section] = prev[section] ?? false;
      return next;
    });
    setShowCollapsedRowsBySection((prev) => {
      const next: Record<string, boolean> = {};
      for (const section of sections) next[section] = prev[section] ?? false;
      return next;
    });
  }, [sections]);

  const { baseValues } = useMemo(() => computeAll(rows, state), [rows, state]);
  const inspectedId = hoveredRowId;
  const sourceIds = useMemo(() => {
    if (!inspectedId) return new Set<string>();
    return new Set(config.directDeps[inspectedId] ?? []);
  }, [inspectedId]);

  function setInputValue(id: string, displayValue: number) {
    setState(prev => ({ ...prev, [id]: { ...prev[id], displayValue } }));
  }

  function setUnit(id: string, u: UnitOption) {
    // Keep quantity constant: convert current display -> base -> new display
    setState(prev => {
      const cur = prev[id];
      const base = (cur.toBase == null) ? cur.displayValue : cur.displayValue * cur.toBase;
      const nextDisplay = base / u.toBase;
      return { ...prev, [id]: { displayValue: nextDisplay, unitLabel: u.label, toBase: u.toBase } };
    });
  }

  function selectedUnitOptionFor(id: string, r: RowDef, unitOptions: UnitOption[]) {
    if (unitOptions.length === 0) return null;
    const selectedUnitLabel = state[id].unitLabel ?? r.displayUnit ?? null;
    const normalizedSelected = normalizeUnitLabel(selectedUnitLabel);
    let selectedOption = unitOptions.find(u => normalizeUnitLabel(u.label) === normalizedSelected);

    if (!selectedOption) {
      const desiredFactor = state[id].toBase ?? r.toBaseFactor ?? null;
      if (desiredFactor != null) {
        selectedOption = unitOptions.find(u => factorsEqual(u.toBase, desiredFactor));
      }
    }

    return selectedOption ?? unitOptions[0];
  }

  function renderRow(id: string) {
    const r = rows.find(x => x.id === id);
    if (!r) return null;
    const hasInfo = r.kind === "output" && Boolean(r.excel.formula);
    const isSource = sourceIds.has(id);
    const isTarget = inspectedId === id;
    const isInfoHovered = hoveredInfoId === id;
    const isGrandTotal = totalRowIds.has(id);
    const isEmphasisRow = isKeyOutputRow(r);
    const hasBothEmphasisLines = r.id === "total_cutting_time";

    const unitOptions = unitOptionsForBase(r.baseUnit);
    const hasUnitDropdown = unitOptions.length > 0;
    const selectedOption = selectedUnitOptionFor(id, r, unitOptions);

    const displayVal =
      r.kind === "input"
        ? state[id].displayValue
        : fromBase(baseValues[id], state[id].toBase ?? r.toBaseFactor ?? null);

    return (
      <div
        key={id}
        className={`rowBlock${isSource ? " rowBlockSource" : ""}${isTarget ? " rowBlockTarget" : ""}${isEmphasisRow ? " rowBlockEmphasis" : ""}${hasBothEmphasisLines ? " rowBlockEmphasisBoth" : ""}${r.kind === "input" ? " rowBlockInput" : " rowBlockOutput"}${isGrandTotal ? " rowBlockGrandTotal" : ""}`}
        onMouseEnter={hasInfo ? () => setHoveredRowId(id) : undefined}
        onMouseLeave={hasInfo ? () => {
          setHoveredRowId(prev => (prev === id ? null : prev));
          setHoveredInfoId(prev => (prev === id ? null : prev));
        } : undefined}
      >
        <div className="grid" style={{ position: "relative" }}>
          <div className="rowLabel">
            {hasInfo ? (
              <span
                className="infoAnchor"
                onMouseEnter={() => setHoveredInfoId(id)}
                onMouseLeave={() => setHoveredInfoId(prev => (prev === id ? null : prev))}
              >
                <button
                  type="button"
                  className="infoBtn"
                  aria-label={`Show formula for ${r.label}`}
                  onFocus={() => setHoveredInfoId(id)}
                  onBlur={() => setHoveredInfoId(prev => (prev === id ? null : prev))}
                >
                  ⓘ
                </button>
                {isInfoHovered && r.excel.formula && (
                  <InfoPopover
                    title={r.label}
                    formula={readableFormula(r.excel.formula, rows)}
                  />
                )}
              </span>
            ) : (
              <span style={{ width: 22 }} />
            )}
            <span className="labelText">{r.label}</span>
          </div>

          <div className="valueCell">
            {r.kind === "input" ? (
              <input
                className="input"
                inputMode="decimal"
                value={Number.isFinite(displayVal) ? String(displayVal) : ""}
                onChange={(e) => setInputValue(id, Number(e.target.value))}
              />
            ) : (
              <div
                className={`output ${hasInfo ? "outputInteractive" : ""}`}
                role={hasInfo ? "button" : undefined}
                tabIndex={hasInfo ? 0 : undefined}
                aria-label={hasInfo ? `Output value for ${r.label}` : undefined}
                onFocus={hasInfo ? () => setHoveredRowId(id) : undefined}
                onBlur={hasInfo ? () => setHoveredRowId(prev => (prev === id ? null : prev)) : undefined}
                onKeyDown={hasInfo ? (e) => {
                  if (e.key === "Escape") setHoveredInfoId(null);
                } : undefined}
              >
                {formatNumber(displayVal)}
              </div>
            )}

            {hasUnitDropdown ? (
              <select
                className="select"
                value={selectedOption?.label}
                onChange={(e) => {
                  const opt = unitOptions.find(u => u.label === e.target.value);
                  if (opt) setUnit(id, opt);
                }}
              >
                {unitOptions.map(u => (
                  <option key={u.label} value={u.label}>{u.label}</option>
                ))}
              </select>
            ) : (
              (r.displayUnit ? <span className="note">{r.displayUnit}</span> : <span />)
            )}
          </div>
        </div>
      </div>
    );
  }

  const totalRows = rows.filter(r => totalRowIds.has(r.id));

  return (
    <>
      {sections.map(section => {
        let sectionRows = rows.filter(
          r => (r.section ?? "").trim() === section && !totalRowIds.has(r.id),
        );

        if (section === "Imaging") {
          sectionRows = sectionRows.filter(r => !movedToImagingIds.has(r.id));
          const movedRows = rows.filter(r => movedToImagingIds.has(r.id));
          const insertIndex = sectionRows.findIndex(r => r.id === "total_scanning_time");
          if (insertIndex >= 0) {
            sectionRows = [
              ...sectionRows.slice(0, insertIndex),
              ...movedRows,
              ...sectionRows.slice(insertIndex),
            ];
          } else {
            sectionRows = [...sectionRows, ...movedRows];
          }
        }

        if (section === "Stage movements") {
          sectionRows = sectionRows.filter(r => !movedToImagingIds.has(r.id));
        }

        if (sectionRows.length === 0) return null;

        const inputRows = sectionRows.filter(r => r.kind === "input");
        const outputRows = sectionRows.filter(r => r.kind === "output");
        const isSectionCollapsed = collapsedSections[section] ?? false;
        const orderedRows = [...inputRows, ...outputRows];
        const sectionBaseRows = isSectionCollapsed
          ? orderedRows.filter(isKeyOutputRow)
          : orderedRows;
        const keyOutputRows = sectionBaseRows.filter(isKeyOutputRow);
        const nonKeyRows = sectionBaseRows.filter(r => !isKeyOutputRow(r));
        const hasOptionalRows = nonKeyRows.some(r => defaultCollapsedRowIds.has(r.id));
        const showCollapsedRows = showCollapsedRowsBySection[section] ?? false;
        const visibleNonKeyRows = nonKeyRows.filter(r => showCollapsedRows || !defaultCollapsedRowIds.has(r.id));
        const hasVisibleRows = visibleNonKeyRows.length > 0 || keyOutputRows.length > 0;
        const shouldShowColumnHead = hasVisibleRows;

        return (
          <section key={section} className="card section">
            {section !== "Overview" ? (
              <button
                type="button"
                className="sectionToggle"
                aria-expanded={!isSectionCollapsed}
                onClick={() => {
                  setCollapsedSections(prev => ({ ...prev, [section]: !(prev[section] ?? false) }));
                }}
              >
                <h2>{section}</h2>
                <span className="sectionToggleIcon" aria-hidden>
                  {isSectionCollapsed ? "+" : "−"}
                </span>
              </button>
            ) : null}

            {shouldShowColumnHead ? (
              <div className="sectionColumnsHead" aria-hidden="true">
                <span>Parameter</span>
                <span>Value</span>
              </div>
            ) : null}
            {visibleNonKeyRows.map(r => renderRow(r.id))}
            {!isSectionCollapsed && hasOptionalRows ? (
              <div className="sectionRowsToggleWrap">
                <button
                  type="button"
                  className="sectionRowsToggle"
                  onClick={() => {
                    setShowCollapsedRowsBySection(prev => ({ ...prev, [section]: !(prev[section] ?? false) }));
                  }}
                >
                  {showCollapsedRows ? "hide" : "show"}
                </button>
              </div>
            ) : null}
            {keyOutputRows.map(r => renderRow(r.id))}
          </section>
        );
      })}

      {totalRows.length > 0 && (
        <section className="card section totalSection">
          {totalRows.map(r => renderRow(r.id))}
        </section>
      )}

      <section className="card footer">
        <SuggestionsBox />
      </section>
    </>
  );
}
