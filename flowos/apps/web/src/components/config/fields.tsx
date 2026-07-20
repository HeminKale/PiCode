"use client";

import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

const inputClass =
  "w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      {children}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClass} />;
}

export function TextAreaInput(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} rows={props.rows ?? 2} className={`${inputClass} resize-y`} />;
}

export function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export function RemoveButton({ onClick, title = "Remove" }: { onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="text-slate-600 hover:text-red-400 text-xs px-1 shrink-0"
    >
      ✕
    </button>
  );
}

export function AddRowButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] text-violet-400 hover:text-violet-300 text-left mt-0.5"
    >
      {children}
    </button>
  );
}

// Generic repeatable-row editor. `items` is the full array; `renderRow` gets a per-row
// patch function that merges into that row and pushes the whole array back via onChange.
export function RowList<T>({
  items,
  onChange,
  newRow,
  renderRow,
  addLabel = "+ Add row",
}: {
  items: T[];
  onChange: (items: T[]) => void;
  newRow: () => T;
  renderRow: (item: T, index: number, patch: (partial: Partial<T>) => void) => ReactNode;
  addLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className="flex-1 flex items-center gap-1 min-w-0">
            {renderRow(item, i, (partial) =>
              onChange(items.map((it, idx) => (idx === i ? { ...it, ...partial } : it))),
            )}
          </div>
          <RemoveButton onClick={() => onChange(items.filter((_, idx) => idx !== i))} />
        </div>
      ))}
      <AddRowButton onClick={() => onChange([...items, newRow()])}>{addLabel}</AddRowButton>
    </div>
  );
}

// Record<string,string> editor (key/value rows) used by CREATE/UPDATE `fields`.
export function KeyValueEditor({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
}) {
  const rows = Object.entries(value ?? {}).map(([key, val]) => ({ key, val: String(val ?? "") }));

  function commit(rows: { key: string; val: string }[]) {
    onChange(Object.fromEntries(rows.map((r) => [r.key, r.val])));
  }

  return (
    <RowList
      items={rows}
      onChange={commit}
      newRow={() => ({ key: "", val: "" })}
      addLabel="+ Add field"
      renderRow={(row, _i, patch) => (
        <>
          <input
            value={row.key}
            onChange={(e) => patch({ key: e.target.value })}
            placeholder="field"
            className={`${inputClass} w-1/2`}
          />
          <input
            value={row.val}
            onChange={(e) => patch({ val: e.target.value })}
            placeholder="value"
            className={`${inputClass} w-1/2`}
          />
        </>
      )}
    />
  );
}
