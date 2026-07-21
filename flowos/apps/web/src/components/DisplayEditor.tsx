"use client";
/* eslint-disable react-hooks/set-state-in-effect -- artifact loading synchronizes remote draft state */

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DisplayBundle } from "@/components/DisplayBundle";
import { createDefaultDisplayBundle, joinDisplayBundle, splitDisplayBundle, type DisplayConfig, type DisplayField } from "@/lib/displayBundleTemplate";
import { useFlowStore } from "@/store/flowStore";
import type { FlowNode } from "@flowos/types";

type Tab = "Design" | "Preview" | "HTML" | "CSS" | "JavaScript" | "Versions";
const TABS: Tab[] = ["Design", "Preview", "HTML", "CSS", "JavaScript", "Versions"];
const blankField = (): DisplayField => ({ variable: "", label: "", inputType: "text", placeholder: "", required: false, defaultValue: "", validation: "", options: [] });

export function DisplayEditor({ node }: { node: FlowNode }) {
  const flow = useFlowStore((state) => state.flow);
  const updateNodeConfig = useFlowStore((state) => state.updateNodeConfig);
  const [design, setDesign] = useState<DisplayConfig>(() => ({ fields: [], ...(node.config as Partial<DisplayConfig>) }));
  const [tab, setTab] = useState<Tab>("Design");
  const [parts, setParts] = useState(() => splitDisplayBundle(createDefaultDisplayBundle({ fields: (node.config as DisplayConfig).fields ?? [] })));
  const [versions, setVersions] = useState<Array<{ id: string; version: number; sourceCode: string; isPublished: boolean; createdAt: string }>>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState<string>();

  const sourceCode = useMemo(() => joinDisplayBundle(parts), [parts]);
  const persistFlow = async (nextDesign = design) => {
    if (!flow) return;
    const nextConfig = { ...node.config, ...nextDesign };
    updateNodeConfig(node.id, nextConfig);
    await api.saveFlow({ ...flow, nodes: flow.nodes.map((item) => item.id === node.id ? { ...item, config: nextConfig } : item) });
  };
  const refreshVersions = useCallback(async () => {
    if (!flow) return;
    const artifacts = await api.listArtifacts(flow.id);
    const displayVersions = artifacts.filter((artifact) => artifact.nodeId === node.id && artifact.kind === "display");
    setVersions(displayVersions);
    setSelectedVersion((current) => current ?? displayVersions[0]?.id);
  }, [flow, node.id]);
  useEffect(() => { void refreshVersions(); }, [refreshVersions]);
  useEffect(() => {
    const current = versions.find((version) => version.id === selectedVersion) ?? versions[0];
    if (current) setParts(splitDisplayBundle(current.sourceCode));
  }, [selectedVersion, versions]);

  const patchDesign = (partial: Partial<DisplayConfig>) => setDesign((current) => ({ ...current, ...partial }));
  const patchField = (index: number, partial: Partial<DisplayField>) => patchDesign({ fields: design.fields.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...partial } : field) });
  const saveDraft = async () => {
    if (!flow) return;
    setBusy("draft"); setMessage(undefined);
    try {
      await persistFlow();
      const artifact = await api.createArtifactDraft(flow.id, node.id, sourceCode);
      const nextDesign = { ...design, bundleId: artifact.id };
      setDesign(nextDesign);
      await persistFlow(nextDesign);
      await refreshVersions();
      setSelectedVersion(artifact.id);
      setMessage(`Draft version ${artifact.version} saved.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save draft."); }
    finally { setBusy(undefined); }
  };
  const generateWithAi = async () => {
    if (!flow) return;
    setBusy("ai"); setMessage(undefined);
    try {
      await persistFlow();
      const fields = design.fields.map((field) => `${field.label || field.variable} (${field.variable}, ${field.inputType ?? "text"})`).join(", ");
      const artifact = await api.generateDisplayDraft(flow.id, node.id, `Build a polished, responsive form for ${flow.name}. Fields: ${fields || "a single text value"}. Submit button: ${design.submit?.label || "Submit"}.`);
      setParts(splitDisplayBundle(artifact.sourceCode));
      await refreshVersions(); setSelectedVersion(artifact.id);
      setMessage(`AI created draft version ${artifact.version}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not generate a draft."); }
    finally { setBusy(undefined); }
  };
  const publish = async () => {
    if (!flow || !selectedVersion) return;
    setBusy("publish"); setMessage(undefined);
    try { const artifact = await api.publishArtifact(flow.id, selectedVersion); await refreshVersions(); setMessage(`Version ${artifact.version} is now live.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not publish version."); }
    finally { setBusy(undefined); }
  };

  return <main className="min-h-full bg-[#0a0a0f] p-6 text-slate-100">
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
        <div><p className="text-xs text-slate-500">Display editor</p><h1 className="text-xl font-bold">{node.label}</h1><p className="mt-1 text-sm text-slate-400">Fields define the only values the run may accept. Bundle code is versioned separately.</p></div>
        <div className="flex flex-wrap gap-2"><button onClick={generateWithAi} disabled={!!busy} className="rounded bg-violet-600 px-3 py-2 text-sm font-semibold hover:bg-violet-500">{busy === "ai" ? "Generating…" : "Generate with AI"}</button><button onClick={saveDraft} disabled={!!busy} className="rounded border border-slate-700 px-3 py-2 text-sm hover:border-slate-500">{busy === "draft" ? "Saving…" : "Save Draft"}</button><button onClick={publish} disabled={!selectedVersion || !!busy} className="rounded bg-emerald-700 px-3 py-2 text-sm font-semibold hover:bg-emerald-600">{busy === "publish" ? "Publishing…" : "Publish Version"}</button></div>
      </div>
      {message && <p className="mt-3 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300">{message}</p>}
      <div className="mt-5 flex flex-wrap gap-1 border-b border-slate-800">{TABS.map((item) => <button key={item} onClick={() => setTab(item)} className={`px-3 py-2 text-sm ${tab === item ? "border-b-2 border-violet-400 text-white" : "text-slate-400 hover:text-slate-200"}`}>{item}</button>)}</div>
      {tab === "Design" && <section className="mt-5 grid gap-6 lg:grid-cols-[1fr_280px]"><div className="space-y-3">{design.fields.map((field, index) => <div key={index} className="rounded border border-slate-800 bg-[#13131a] p-4"><div className="mb-3 flex justify-between"><span className="text-sm font-semibold">Field {index + 1}</span><button onClick={() => patchDesign({ fields: design.fields.filter((_, fieldIndex) => fieldIndex !== index) })} className="text-xs text-red-400">Remove</button></div><div className="grid gap-2 sm:grid-cols-2"><EditorInput label="Variable" value={field.variable} onChange={(value) => patchField(index, { variable: value })} /><EditorInput label="Label" value={field.label} onChange={(value) => patchField(index, { label: value })} /><EditorSelect label="Input type" value={field.inputType ?? "text"} options={["text", "email", "number", "tel", "date", "textarea", "select"]} onChange={(value) => patchField(index, { inputType: value as DisplayField["inputType"] })} /><EditorInput label="Placeholder" value={field.placeholder ?? ""} onChange={(value) => patchField(index, { placeholder: value })} /><EditorInput label="Default value" value={field.defaultValue ?? ""} onChange={(value) => patchField(index, { defaultValue: value })} /><EditorInput label="Validation pattern" value={field.validation ?? ""} onChange={(value) => patchField(index, { validation: value })} />{field.inputType === "select" && <EditorInput label="Options (comma-separated)" value={(field.options ?? []).join(", ")} onChange={(value) => patchField(index, { options: value.split(",").map((option) => option.trim()).filter(Boolean) })} />}</div><label className="mt-3 flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={field.required ?? false} onChange={(event) => patchField(index, { required: event.target.checked })} /> Required</label></div>)}<button onClick={() => patchDesign({ fields: [...design.fields, blankField()] })} className="rounded border border-dashed border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-violet-500">+ Add field</button></div><aside className="h-fit rounded border border-slate-800 bg-[#13131a] p-4"><h2 className="font-semibold">Submit button</h2><div className="mt-3 space-y-3"><EditorInput label="Label" value={design.submit?.label ?? "Submit"} onChange={(value) => patchDesign({ submit: { ...design.submit, label: value } })} /><EditorSelect label="Style" value={design.submit?.style ?? "primary"} options={["primary", "secondary", "success"]} onChange={(value) => patchDesign({ submit: { ...design.submit, style: value as "primary" | "secondary" | "success" } })} /><EditorSelect label="Success behavior" value={design.submit?.successBehavior ?? "message"} options={["message", "reset"]} onChange={(value) => patchDesign({ submit: { ...design.submit, successBehavior: value as "message" | "reset" } })} /><button onClick={() => { setParts(splitDisplayBundle(createDefaultDisplayBundle(design))); setTab("Preview"); }} className="w-full rounded bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700">Generate default form</button></div></aside></section>}
      {tab === "Preview" && <section className="mt-5 h-[620px] overflow-hidden rounded border border-slate-700 bg-white"><DisplayBundle flowId={flow?.id ?? ""} nodeId={node.id} sourceCode={sourceCode} onSubmit={() => undefined} /></section>}
      {(["HTML", "CSS", "JavaScript"] as Tab[]).includes(tab) && <section className="mt-5"><textarea aria-label={`${tab} source`} value={tab === "HTML" ? parts.html : tab === "CSS" ? parts.css : parts.javascript} onChange={(event) => setParts((current) => tab === "HTML" ? { ...current, html: event.target.value } : tab === "CSS" ? { ...current, css: event.target.value } : { ...current, javascript: event.target.value })} className="h-[620px] w-full rounded border border-slate-700 bg-[#13131a] p-4 font-mono text-sm text-slate-200 outline-none focus:border-violet-500" spellCheck={false} /></section>}
      {tab === "Versions" && <section className="mt-5 space-y-2">{versions.map((version) => <button key={version.id} onClick={() => setSelectedVersion(version.id)} className={`flex w-full items-center justify-between rounded border p-4 text-left ${selectedVersion === version.id ? "border-violet-500 bg-violet-950/30" : "border-slate-800 bg-[#13131a]"}`}><span><span className="font-semibold">Version {version.version}</span><span className="ml-2 text-xs text-slate-500">{new Date(version.createdAt).toLocaleString()}</span></span>{version.isPublished && <span className="rounded bg-emerald-950 px-2 py-1 text-xs text-emerald-300">Live</span>}</button>)}{versions.length === 0 && <p className="text-sm text-slate-500">No saved versions yet. Generate a form or save a draft to create one.</p>}</section>}
    </div>
  </main>;
}

function EditorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="grid gap-1 text-xs text-slate-400">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white outline-none focus:border-violet-500" /></label>; }
function EditorSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <label className="grid gap-1 text-xs text-slate-400">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white outline-none focus:border-violet-500">{options.map((option) => <option key={option}>{option}</option>)}</select></label>; }
