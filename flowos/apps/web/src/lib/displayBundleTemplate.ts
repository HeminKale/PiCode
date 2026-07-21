export type DisplayField = {
  variable: string;
  label: string;
  inputType?: "text" | "email" | "number" | "tel" | "date" | "textarea" | "select";
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  validation?: string;
  options?: string[];
};

export type DisplayConfig = {
  bundleId?: string;
  fields: DisplayField[];
  submit?: { label?: string; style?: "primary" | "secondary" | "success"; successBehavior?: "message" | "reset" };
};

const escapeHtml = (value = "") => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);

function fieldMarkup(field: DisplayField) {
  const name = escapeHtml(field.variable);
  const label = escapeHtml(field.label || field.variable);
  const required = field.required ? " required" : "";
  const placeholder = field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : "";
  const defaultValue = escapeHtml(field.defaultValue);
  const pattern = field.validation ? ` pattern="${escapeHtml(field.validation)}"` : "";
  if (field.inputType === "textarea") return `<label>${label}<textarea name="${name}"${placeholder}${required}${pattern}>${defaultValue}</textarea></label>`;
  if (field.inputType === "select") {
    const options = (field.options ?? []).map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("");
    return `<label>${label}<select name="${name}"${required}><option value="">Select an option</option>${options}</select></label>`;
  }
  return `<label>${label}<input type="${field.inputType ?? "text"}" name="${name}" value="${defaultValue}"${placeholder}${required}${pattern}></label>`;
}

/** Creates a complete artifact document. The source is intentionally kept out of flowJson. */
export function createDefaultDisplayBundle(config: DisplayConfig) {
  const fields = config.fields.filter((field) => field.variable.trim()).map(fieldMarkup).join("\n");
  const submit = config.submit ?? {};
  const colors = submit.style === "secondary" ? ["#334155", "#1e293b"] : submit.style === "success" ? ["#059669", "#047857"] : ["#6d28d9", "#5b21b6"];
  const success = submit.successBehavior === "reset" ? "form.reset();" : "status.textContent = 'Submitted successfully.';";
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
*{box-sizing:border-box}body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif;background:#fff;color:#0f172a}main{max-width:680px;margin:0 auto;padding:24px}form{display:grid;gap:16px}label{display:grid;gap:6px;font-size:14px;font-weight:600}input,textarea,select{width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:10px 12px;font:inherit;color:#0f172a;background:#fff}textarea{min-height:100px;resize:vertical}button{border:0;border-radius:8px;padding:11px 16px;background:${colors[0]};color:#fff;font:inherit;font-weight:700;cursor:pointer}button:hover{background:${colors[1]}}#status{min-height:20px;color:#047857;font-size:14px}@media(max-width:480px){main{padding:16px}}
</style></head><body><main><form id="flowos-form">${fields}<button type="submit">${escapeHtml(submit.label || "Submit")}</button><div id="status" role="status"></div></form></main>
<script>const form=document.getElementById('flowos-form');const status=document.getElementById('status');form.addEventListener('submit',function(event){event.preventDefault();const values=Object.fromEntries(new FormData(form));parent.postMessage({type:'flowos:display-submit',values},'*');${success}});</script>
</body></html>`;
}

export function splitDisplayBundle(source: string) {
  const style = source.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1] ?? "";
  const script = source.match(/<script[^>]*>([\s\S]*?)<\/script>/i)?.[1] ?? "";
  const html = source.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  return { html, css: style, javascript: script };
}

export function joinDisplayBundle(parts: { html: string; css: string; javascript: string }) {
  const html = parts.html.includes("<html") ? parts.html : `<!doctype html><html><head></head><body>${parts.html}</body></html>`;
  const withStyle = html.replace(/<\/head>/i, `<style>${parts.css}</style></head>`);
  return withStyle.replace(/<\/body>/i, `<script>${parts.javascript}</script></body>`);
}
