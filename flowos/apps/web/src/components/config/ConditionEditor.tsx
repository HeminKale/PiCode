"use client";

import type { FlowEdge, FlowNode } from "@flowos/types";
import { Field, RowList, SelectInput, TextInput, AddRowButton, RemoveButton } from "./fields";

interface Condition {
  resource: string;
  operator: string;
  value: any;
}
interface Outcome {
  name: string;
  logic: "AND" | "OR";
  conditions: Condition[];
}

const OPERATORS = ["Equals", "NotEquals", "GreaterThan", "LessThan", "Contains"];

// The dedicated multi-outcome editor for CONDITION nodes (node-reference.md: "REDESIGNED",
// Salesforce Decision-element style). Each outcome maps 1:1 to an outgoing edge whose `label`
// equals the outcome's `name` - renaming an outcome renames its edge, removing an outcome
// removes its edge. Adding an outcome does NOT auto-create a stub edge: the edge only appears
// once the user drags a real connection from this node's handle on the canvas, matching how
// every other new-edge-needing action already works here (drag to connect).
export function ConditionEditor({
  node,
  edges,
  updateNodeConfig,
  updateEdgeLabel,
  removeEdge,
}: {
  node: FlowNode;
  edges: FlowEdge[];
  updateNodeConfig: (nodeId: string, config: Record<string, any>) => void;
  updateEdgeLabel: (edgeId: string, label: string | undefined) => void;
  removeEdge: (edgeId: string) => void;
}) {
  const outcomes: Outcome[] = node.config.outcomes ?? [];
  const defaultOutcomeName: string = node.config.defaultOutcomeName ?? "";

  function setOutcomes(next: Outcome[]) {
    updateNodeConfig(node.id, { ...node.config, outcomes: next });
  }

  function edgeForOutcome(name: string): FlowEdge | undefined {
    return edges.find((e) => e.source === node.id && e.label === name);
  }

  function renameOutcome(index: number, name: string) {
    const prevName = outcomes[index].name;
    const edge = edgeForOutcome(prevName);
    if (edge) updateEdgeLabel(edge.id, name);
    const nextOutcomes = outcomes.map((o, i) => (i === index ? { ...o, name } : o));
    const nextDefault = defaultOutcomeName === prevName ? name : defaultOutcomeName;
    updateNodeConfig(node.id, { ...node.config, outcomes: nextOutcomes, defaultOutcomeName: nextDefault });
  }

  function removeOutcome(index: number) {
    const edge = edgeForOutcome(outcomes[index].name);
    if (edge) removeEdge(edge.id);
    setOutcomes(outcomes.filter((_, i) => i !== index));
  }

  function addOutcome() {
    setOutcomes([...outcomes, { name: `Outcome ${outcomes.length + 1}`, logic: "AND", conditions: [] }]);
  }

  function moveOutcome(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= outcomes.length) return;
    const next = [...outcomes];
    [next[index], next[target]] = [next[target], next[index]];
    setOutcomes(next);
  }

  function patchOutcome(index: number, partial: Partial<Outcome>) {
    setOutcomes(outcomes.map((o, i) => (i === index ? { ...o, ...partial } : o)));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Outcomes</div>
        <span className="text-[10px] text-slate-600">evaluated in order</span>
      </div>
      <div className="flex flex-col gap-2 mb-2">
        {outcomes.map((outcome, i) => {
          const edge = edgeForOutcome(outcome.name);
          return (
            <div key={i} className="rounded border border-slate-800 bg-slate-900/60 p-2">
              <div className="flex items-center gap-1 mb-1.5">
                <div className="flex flex-col shrink-0">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => moveOutcome(i, -1)}
                    className="text-[10px] text-slate-500 hover:text-slate-200 disabled:opacity-20 leading-none"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={i === outcomes.length - 1}
                    onClick={() => moveOutcome(i, 1)}
                    className="text-[10px] text-slate-500 hover:text-slate-200 disabled:opacity-20 leading-none"
                  >
                    ▼
                  </button>
                </div>
                <TextInput value={outcome.name} onChange={(e) => renameOutcome(i, e.target.value)} placeholder="Outcome name" />
                <RemoveButton onClick={() => removeOutcome(i)} title="Remove outcome" />
              </div>

              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] text-slate-500">Match</span>
                <div className="w-20">
                  <SelectInput value={outcome.logic} onChange={(v) => patchOutcome(i, { logic: v as "AND" | "OR" })} options={["AND", "OR"]} />
                </div>
                <span className="text-[10px] text-slate-500">of the conditions</span>
                <span className={`ml-auto text-[10px] ${edge ? "text-emerald-400" : "text-amber-400"}`}>
                  {edge ? "✓ wired" : "no edge yet"}
                </span>
              </div>

              <RowList
                items={outcome.conditions}
                onChange={(conditions) => patchOutcome(i, { conditions })}
                newRow={() => ({ resource: "", operator: "Equals", value: "" })}
                addLabel="+ Add condition"
                renderRow={(cond, _j, patch) => (
                  <>
                    <input
                      value={cond.resource}
                      onChange={(e) => patch({ resource: e.target.value })}
                      placeholder="resource"
                      className="w-[38%] rounded border border-slate-800 bg-slate-950 px-1.5 py-1 text-[11px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
                    />
                    <select
                      value={cond.operator}
                      onChange={(e) => patch({ operator: e.target.value })}
                      className="w-[30%] rounded border border-slate-800 bg-slate-950 px-1 py-1 text-[11px] text-slate-100 focus:outline-none focus:border-violet-500"
                    >
                      {OPERATORS.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>
                    <input
                      value={cond.value ?? ""}
                      onChange={(e) => patch({ value: e.target.value })}
                      placeholder="value"
                      className="w-[32%] rounded border border-slate-800 bg-slate-950 px-1.5 py-1 text-[11px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
                    />
                  </>
                )}
              />
            </div>
          );
        })}
      </div>
      <AddRowButton onClick={addOutcome}>+ Add outcome</AddRowButton>

      <Field label="Default outcome (catch-all)">
        <TextInput
          value={defaultOutcomeName}
          onChange={(e) => updateNodeConfig(node.id, { ...node.config, defaultOutcomeName: e.target.value })}
          placeholder="Default"
        />
      </Field>
    </div>
  );
}
