"use client";

import type { FlowNode } from "@flowos/types";
import { Field, TextInput, TextAreaInput, SelectInput, KeyValueEditor, RowList } from "./fields";
import { GenericForm } from "./GenericForm";

type Patch = (partial: Record<string, any>) => void;

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  return (
    <TextInput
      value={(value ?? []).join(", ")}
      onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
      placeholder={placeholder ?? "comma, separated, values"}
    />
  );
}

function SourceForm({ config, patch }: { config: any; patch: Patch }) {
  return (
    <Field label="Connector ID">
      <TextInput value={config.connectorId ?? ""} onChange={(e) => patch({ connectorId: e.target.value })} placeholder="connector id" />
    </Field>
  );
}

function SelectForm({ config, patch }: { config: any; patch: Patch }) {
  return (
    <>
      <Field label="Source"><TextInput value={config.source ?? ""} onChange={(e) => patch({ source: e.target.value })} /></Field>
      <Field label="Query (optional)"><TextAreaInput value={config.query ?? ""} onChange={(e) => patch({ query: e.target.value })} /></Field>
      <Field label="Filter (optional)"><TextInput value={config.filter ?? ""} onChange={(e) => patch({ filter: e.target.value })} /></Field>
      <Field label="Output variable"><TextInput value={config.outputVar ?? ""} onChange={(e) => patch({ outputVar: e.target.value })} /></Field>
    </>
  );
}

function CreateForm({ config, patch }: { config: any; patch: Patch }) {
  return (
    <>
      <Field label="Target"><TextInput value={config.target ?? ""} onChange={(e) => patch({ target: e.target.value })} /></Field>
      <Field label="Fields"><KeyValueEditor value={config.fields ?? {}} onChange={(fields) => patch({ fields })} /></Field>
      <Field label="Output variable"><TextInput value={config.outputVar ?? ""} onChange={(e) => patch({ outputVar: e.target.value })} /></Field>
    </>
  );
}

function UpdateForm({ config, patch }: { config: any; patch: Patch }) {
  return (
    <>
      <Field label="Target"><TextInput value={config.target ?? ""} onChange={(e) => patch({ target: e.target.value })} /></Field>
      <Field label="Where"><TextInput value={config.where ?? ""} onChange={(e) => patch({ where: e.target.value })} /></Field>
      <Field label="Fields"><KeyValueEditor value={config.fields ?? {}} onChange={(fields) => patch({ fields })} /></Field>
    </>
  );
}

function DeleteForm({ config, patch }: { config: any; patch: Patch }) {
  return (
    <>
      <Field label="Target"><TextInput value={config.target ?? ""} onChange={(e) => patch({ target: e.target.value })} /></Field>
      <Field label="Where"><TextInput value={config.where ?? ""} onChange={(e) => patch({ where: e.target.value })} /></Field>
    </>
  );
}

// JOIN's shape is pinned down in generate-flow.prompt.ts ({left, right, on, type}) even
// though node-reference.md just says "unchanged from Sprint 1" - typed fields for it.
function JoinForm({ config, patch }: { config: any; patch: Patch }) {
  return (
    <>
      <Field label="Left"><TextInput value={config.left ?? ""} onChange={(e) => patch({ left: e.target.value })} /></Field>
      <Field label="Right"><TextInput value={config.right ?? ""} onChange={(e) => patch({ right: e.target.value })} /></Field>
      <Field label="On"><TextInput value={config.on ?? ""} onChange={(e) => patch({ on: e.target.value })} /></Field>
      <Field label="Join type">
        <SelectInput value={config.type ?? "inner"} onChange={(v) => patch({ type: v })} options={["inner", "left", "right"]} />
      </Field>
    </>
  );
}

function ForForm({ config, patch }: { config: any; patch: Patch }) {
  return (
    <>
      <Field label="Iterate variable"><TextInput value={config.iterateVar ?? ""} onChange={(e) => patch({ iterateVar: e.target.value })} /></Field>
      <Field label="Item variable"><TextInput value={config.itemVar ?? ""} onChange={(e) => patch({ itemVar: e.target.value })} /></Field>
    </>
  );
}

const ASSIGN_OPERATORS = ["Equals", "Add", "Subtract", "AddItemToList", "RemoveItemFromList"];

function AssignForm({ config, patch }: { config: any; patch: Patch }) {
  const assignments = config.assignments ?? [];
  return (
    <Field label="Assignments">
      <RowList
        items={assignments}
        onChange={(assignments) => patch({ assignments })}
        newRow={() => ({ variable: "", operator: "Equals", value: "" })}
        addLabel="+ Add assignment"
        renderRow={(row, _i, rowPatch) => (
          <>
            <input
              value={row.variable}
              onChange={(e) => rowPatch({ variable: e.target.value })}
              placeholder="variable"
              className="w-[34%] rounded border border-slate-800 bg-slate-950 px-1.5 py-1 text-[11px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
            />
            <select
              value={row.operator}
              onChange={(e) => rowPatch({ operator: e.target.value })}
              className="w-[36%] rounded border border-slate-800 bg-slate-950 px-1 py-1 text-[11px] text-slate-100 focus:outline-none focus:border-violet-500"
            >
              {ASSIGN_OPERATORS.map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
            <input
              value={row.value ?? ""}
              onChange={(e) => rowPatch({ value: e.target.value })}
              placeholder="value"
              className="w-[30%] rounded border border-slate-800 bg-slate-950 px-1.5 py-1 text-[11px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
            />
          </>
        )}
      />
    </Field>
  );
}

function CallJavaForm({ config, patch }: { config: any; patch: Patch }) {
  return (
    <>
      <Field label="Class name"><TextInput value={config.className ?? ""} onChange={(e) => patch({ className: e.target.value })} /></Field>
      <Field label="Method"><TextInput value={config.method ?? ""} onChange={(e) => patch({ method: e.target.value })} /></Field>
      <Field label="Input variables"><TagInput value={config.inputVars ?? []} onChange={(inputVars) => patch({ inputVars })} /></Field>
      <Field label="Output variable"><TextInput value={config.outputVar ?? ""} onChange={(e) => patch({ outputVar: e.target.value })} /></Field>
    </>
  );
}

function NotifyForm({ config, patch }: { config: any; patch: Patch }) {
  return (
    <>
      <Field label="Channel">
        <SelectInput value={config.channel ?? "slack"} onChange={(v) => patch({ channel: v })} options={["slack", "email", "teams"]} />
      </Field>
      <Field label="Target"><TextInput value={config.target ?? ""} onChange={(e) => patch({ target: e.target.value })} /></Field>
      <Field label="Message template"><TextAreaInput value={config.messageTemplate ?? ""} onChange={(e) => patch({ messageTemplate: e.target.value })} /></Field>
    </>
  );
}

function ReturnForm({ config, patch }: { config: any; patch: Patch }) {
  return (
    <Field label="Value"><TextInput value={config.value ?? ""} onChange={(e) => patch({ value: e.target.value })} /></Field>
  );
}

const RULE_OPERATORS = ["=", "!=", ">", "<", "Contains"];

// RULE's shape ({conditions: [{field, op, value}], logic}) comes from generate-flow.prompt.ts -
// node-reference.md just lumps it into "D1, unchanged from Sprint 1" without a shape.
function RuleForm({ config, patch }: { config: any; patch: Patch }) {
  const conditions = config.conditions ?? [];
  return (
    <>
      <Field label="Logic">
        <SelectInput value={config.logic ?? "AND"} onChange={(v) => patch({ logic: v })} options={["AND", "OR"]} />
      </Field>
      <Field label="Conditions">
        <RowList
          items={conditions}
          onChange={(conditions) => patch({ conditions })}
          newRow={() => ({ field: "", op: "=", value: "" })}
          addLabel="+ Add condition"
          renderRow={(row, _i, rowPatch) => (
            <>
              <input
                value={row.field}
                onChange={(e) => rowPatch({ field: e.target.value })}
                placeholder="field"
                className="w-[38%] rounded border border-slate-800 bg-slate-950 px-1.5 py-1 text-[11px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
              />
              <select
                value={row.op}
                onChange={(e) => rowPatch({ op: e.target.value })}
                className="w-[30%] rounded border border-slate-800 bg-slate-950 px-1 py-1 text-[11px] text-slate-100 focus:outline-none focus:border-violet-500"
              >
                {RULE_OPERATORS.map((op) => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
              <input
                value={row.value ?? ""}
                onChange={(e) => rowPatch({ value: e.target.value })}
                placeholder="value"
                className="w-[32%] rounded border border-slate-800 bg-slate-950 px-1.5 py-1 text-[11px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
              />
            </>
          )}
        />
      </Field>
    </>
  );
}

// AUDIT_LOG's shape ({event, dataVars}) comes from generate-flow.prompt.ts.
function AuditLogForm({ config, patch }: { config: any; patch: Patch }) {
  return (
    <>
      <Field label="Event"><TextInput value={config.event ?? ""} onChange={(e) => patch({ event: e.target.value })} /></Field>
      <Field label="Data variables"><TagInput value={config.dataVars ?? []} onChange={(dataVars) => patch({ dataVars })} /></Field>
    </>
  );
}

function DisplayForm({ config, patch }: { config: any; patch: Patch }) {
  const fields = config.fields ?? [];
  return (
    <>
      <Field label="Bundle ID"><TextInput value={config.bundleId ?? ""} onChange={(e) => patch({ bundleId: e.target.value })} /></Field>
      <Field label="Fields">
        <RowList
          items={fields}
          onChange={(fields) => patch({ fields })}
          newRow={() => ({ variable: "", label: "" })}
          addLabel="+ Add field"
          renderRow={(row, _i, rowPatch) => (
            <>
              <input
                value={row.variable}
                onChange={(e) => rowPatch({ variable: e.target.value })}
                placeholder="variable"
                className="w-1/2 rounded border border-slate-800 bg-slate-950 px-1.5 py-1 text-[11px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
              />
              <input
                value={row.label}
                onChange={(e) => rowPatch({ label: e.target.value })}
                placeholder="label"
                className="w-1/2 rounded border border-slate-800 bg-slate-950 px-1.5 py-1 text-[11px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
              />
            </>
          )}
        />
      </Field>
    </>
  );
}

function ComponentForm({ config, patch }: { config: any; patch: Patch }) {
  const position = config.position ?? { x: 0, y: 0, width: 0, height: 0 };
  function patchPosition(partial: Record<string, number>) {
    patch({ position: { ...position, ...partial } });
  }
  return (
    <>
      <Field label="Embedded flow ID">
        <TextInput value={config.embeddedFlowId ?? ""} onChange={(e) => patch({ embeddedFlowId: e.target.value })} />
      </Field>
      <Field label="Position">
        <div className="grid grid-cols-2 gap-1.5">
          {(["x", "y", "width", "height"] as const).map((key) => (
            <input
              key={key}
              type="number"
              value={position[key] ?? 0}
              onChange={(e) => patchPosition({ [key]: Number(e.target.value) })}
              placeholder={key}
              className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
            />
          ))}
        </div>
      </Field>
    </>
  );
}

export function NodeConfigForm({ node, updateNodeConfig }: { node: FlowNode; updateNodeConfig: (nodeId: string, config: Record<string, any>) => void }) {
  const config = node.config ?? {};
  const patch: Patch = (partial) => updateNodeConfig(node.id, { ...config, ...partial });

  switch (node.type) {
    case "SOURCE": return <SourceForm config={config} patch={patch} />;
    case "SELECT": return <SelectForm config={config} patch={patch} />;
    case "CREATE": return <CreateForm config={config} patch={patch} />;
    case "UPDATE": return <UpdateForm config={config} patch={patch} />;
    case "DELETE": return <DeleteForm config={config} patch={patch} />;
    case "JOIN": return <JoinForm config={config} patch={patch} />;
    case "FOR": return <ForForm config={config} patch={patch} />;
    case "ASSIGN": return <AssignForm config={config} patch={patch} />;
    case "CALL_JAVA": return <CallJavaForm config={config} patch={patch} />;
    case "NOTIFY": return <NotifyForm config={config} patch={patch} />;
    case "RETURN": return <ReturnForm config={config} patch={patch} />;
    case "RULE": return <RuleForm config={config} patch={patch} />;
    case "AUDIT_LOG": return <AuditLogForm config={config} patch={patch} />;
    case "DISPLAY": return <DisplayForm config={config} patch={patch} />;
    case "COMPONENT": return <ComponentForm config={config} patch={patch} />;
    // FILTER, TRANSFORM, AGGREGATE, OUTPUT, EVALUATE, APPROVE, REJECT, EXCEPTION: no pinned
    // shape anywhere - generic key/value editing.
    default: return <GenericForm key={node.id} config={config} onChange={(c) => updateNodeConfig(node.id, c)} />;
  }
}
