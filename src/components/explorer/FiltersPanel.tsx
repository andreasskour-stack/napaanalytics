"use client";

import React from "react";
import type { Filters, Meta, PuzzleMode } from "@/lib/explorer/types";

function toggleInSet(set: Set<string>, value: string) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function SelectList({
  title,
  values,
  selected,
  onChange,
}: {
  title: string;
  values: string[] | undefined;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const safeValues = Array.isArray(values) ? values : [];

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold">{title}</div>
        <button
          className="text-xs text-white/70 hover:text-white"
          onClick={() => onChange(new Set())}
          title="Clear to ALL"
        >
          ALL
        </button>
      </div>

      <div className="max-h-44 overflow-auto pr-1">
        {safeValues.length === 0 ? (
          <div className="text-xs text-white/60">No values found in meta.</div>
        ) : (
          safeValues.map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
              <input
                type="checkbox"
                checked={selected.has(v)}
                onChange={() => onChange(toggleInSet(selected, v))}
              />
              <span className="truncate">{v}</span>
            </label>
          ))
        )}
      </div>

      <div className="mt-2 text-xs text-white/60">
        {selected.size === 0 ? "ALL selected" : `${selected.size} selected`}
      </div>
    </div>
  );
}

function PuzzleToggle({
  value,
  onChange,
}: {
  value: PuzzleMode;
  onChange: (v: PuzzleMode) => void;
}) {
  const items: PuzzleMode[] = ["ALL", "ONLY", "EXCLUDE"];
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="mb-2 text-sm font-semibold">Puzzle</div>
      <div className="flex gap-2">
        {items.map((it) => (
          <button
            key={it}
            onClick={() => onChange(it)}
            className={[
              "rounded-lg px-3 py-1 text-xs font-semibold",
              value === it ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/15",
            ].join(" ")}
          >
            {it}
          </button>
        ))}
      </div>
      <div className="mt-2 text-xs text-white/60">
        ALL = include everything • ONLY = puzzle rows only • EXCLUDE = non-puzzle only
      </div>
    </div>
  );
}

function RangeField({
  title,
  min,
  max,
  valueMin,
  valueMax,
  onChange,
  type = "text",
}: {
  title: string;
  min: string | number | null;
  max: string | number | null;
  valueMin: string | number | null;
  valueMax: string | number | null;
  onChange: (next: { min: string | number | null; max: string | number | null }) => void;
  type?: "text" | "number";
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold">{title}</div>
        <button
          className="text-xs text-white/70 hover:text-white"
          onClick={() => onChange({ min, max })}
          title="Reset to full range"
        >
          Reset
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-sm"
          type={type}
          value={valueMin ?? ""}
          placeholder={min?.toString() ?? "min"}
          onChange={(e) =>
            onChange({
              min: e.target.value ? (type === "number" ? Number(e.target.value) : e.target.value) : null,
              max: valueMax,
            })
          }
        />
        <input
          className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-sm"
          type={type}
          value={valueMax ?? ""}
          placeholder={max?.toString() ?? "max"}
          onChange={(e) =>
            onChange({
              min: valueMin,
              max: e.target.value ? (type === "number" ? Number(e.target.value) : e.target.value) : null,
            })
          }
        />
      </div>

      <div className="mt-2 text-xs text-white/60">
        Dataset range: {String(min ?? "—")} → {String(max ?? "—")}
      </div>
    </div>
  );
}

export default function FiltersPanel({
  meta,
  filters,
  onChange,
  onResetAll,
}: {
  meta: Meta;
  filters: Filters;
  onChange: (next: Filters) => void;
  onResetAll: () => void;
}) {
  // Backwards/forwards compatibility:
  // - some builds might have meta.values.gamePrize, others meta.values.gamePrice
  const metaValues: any = meta?.values ?? {};
  const propTypeValues = metaValues.propType;
  const targetTypeValues = metaValues.targetType;
  const gamePriceValues = metaValues.gamePrice ?? metaValues.gamePrize;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Filters</div>
        <button
          className="rounded-lg bg-white/10 px-3 py-1 text-xs font-semibold hover:bg-white/15"
          onClick={onResetAll}
        >
          Reset ALL
        </button>
      </div>

      <SelectList
        title="PropType"
        values={propTypeValues}
        selected={filters.propTypes}
        onChange={(s) => onChange({ ...filters, propTypes: s })}
      />

      <SelectList
        title="TargetType"
        values={targetTypeValues}
        selected={filters.targetTypes}
        onChange={(s) => onChange({ ...filters, targetTypes: s })}
      />

      <SelectList
        title="GamePrice"
        values={gamePriceValues}
        selected={(filters as any).gamePrices ?? (filters as any).gamePrizes ?? new Set<string>()}
        onChange={(s) => {
          // write to the correct field name you’re using now (gamePrices)
          onChange({ ...filters, ...( { gamePrices: s } as any ) });
        }}
      />

      <PuzzleToggle
        value={filters.puzzleMode}
        onChange={(v) => onChange({ ...filters, puzzleMode: v })}
      />

      <RangeField
        title="AirDate (YYYY-MM-DD)"
        min={meta?.ranges?.airDate?.min ?? null}
        max={meta?.ranges?.airDate?.max ?? null}
        valueMin={filters.airDateMin}
        valueMax={filters.airDateMax}
        onChange={(rng) => onChange({ ...filters, airDateMin: (rng.min as any) ?? null, airDateMax: (rng.max as any) ?? null })}
        type="text"
      />

      <RangeField
        title="Week"
        min={Number.isFinite(meta?.ranges?.week?.min) ? meta.ranges.week.min : null}
        max={Number.isFinite(meta?.ranges?.week?.max) ? meta.ranges.week.max : null}
        valueMin={filters.weekMin}
        valueMax={filters.weekMax}
        onChange={(rng) => onChange({ ...filters, weekMin: (rng.min as any) ?? null, weekMax: (rng.max as any) ?? null })}
        type="number"
      />
    </div>
  );
}
