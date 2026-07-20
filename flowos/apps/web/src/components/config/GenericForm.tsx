"use client";

import { useState } from "react";
import { Field, RowList } from "./fields";

function stringify(v: unknown): string {
  if (v === undefined) return "";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

// Best-effort: keep numbers/booleans typed, parse JSON-looking values, otherwise plain string.
function parse(raw: string): unknown {
  if (raw.trim() === "") return "";
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (!Number.isNaN(Number(raw)) && raw.trim() !== "") return Number(raw);
  if ((raw.startsWith("{") && raw.endsWith("}")) || (raw.startsWith("[") && raw.endsWith("]"))) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

// Fallback editor for node types whose config shape isn't pinned down anywhere (FILTER,
// TRANSFORM, AGGREGATE, OUTPUT, EVALUATE, APPROVE, REJECT, EXCEPTION) - unchanged from
// Sprint 1, no redesigned form for them. Plain key/value rows over the raw config object.
export function GenericForm({
  config,
  onChange,
}: {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}) {
  const [rows, setRows] = useState(() => Object.entries(config ?? {}).map(([key, val]) => ({ key, val: stringify(val) })));

  function commit(next: { key: string; val: string }[]) {
    setRows(next);
    onChange(Object.fromEntries(next.map((r) => [r.key, parse(r.val)])));
  }

  return (
    <Field label="Config (key / value)">
      <RowList
        items={rows}
        onChange={commit}
        newRow={() => ({ key: "", val: "" })}
        addLabel="+ Add key"
        renderRow={(row, _i, patch) => (
          <>
            <input
              value={row.key}
              onChange={(e) => patch({ key: e.target.value })}
              placeholder="key"
              className="w-1/2 rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
            />
            <input
              value={row.val}
              onChange={(e) => patch({ val: e.target.value })}
              placeholder="value"
              className="w-1/2 rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
            />
          </>
        )}
      />
    </Field>
  );
}
