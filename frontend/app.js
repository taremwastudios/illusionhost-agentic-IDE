const BASE_URL = "https://almifuvxnujzmsgdegpi.supabase.co/functions/v1/illusion-ai-router/ai";

const modeSelect = document.getElementById("modeSelect");
const modeBadge = document.getElementById("modeBadge");
const promptEl = document.getElementById("prompt");
const outputEl = document.getElementById("output");
const checkpointInput = document.getElementById("checkpointId");
const statusPill = document.getElementById("statusPill");
const threadEl = document.getElementById("thread");
const themeToggle = document.getElementById("themeToggle");

const sessionUserEl = document.getElementById("sessionUser");
const projectLabelEl = document.getElementById("projectLabel");
const repoLabelEl = document.getElementById("repoLabel");
const branchLabelEl = document.getElementById("branchLabel");
const authHintEl = document.getElementById("authHint");

const editorFallback = document.getElementById("editorFallback");
const monacoRoot = document.getElementById("monacoRoot");

const context = {
  project_id: null,
  owner: null,
  repo: null,
  branch: null,
  filePath: "controller.py",
};

let monacoEditor = null;

// Events
modeSelect.addEventListener("change", () => {
  modeBadge.textContent = modeSelect.value;
});

document.getElementById("btnRun").addEventListener("click", runAI);
document.getElementById("btnCheckpoint").addEventListener("click", createCheckpoint);
document.getElementById("btnRollback").addEventListener("click", rollbackState);
document.getElementById("themeToggle").addEventListener("click", toggleTheme);

modeBadge.textContent = modeSelect.value;
hydrateWorkspaceContext();
initEditor();
addMessage("assistant", "Session-based UI loaded. Ready for AI tasks.");

function setStatus(text, type = "idle") {
  statusPill.textContent = text;
  statusPill.className = `pill ${type}`;
}

function setOutput(payload) {
  outputEl.textContent = JSON.stringify(payload, null, 2);
}

function addMessage(role, text) {
  const msg = document.createElement("div");
  msg.className = `msg ${role}`;

  const roleEl = document.createElement("div");
  roleEl.className = "role";
  roleEl.textContent = role;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  msg.append(roleEl, bubble);
  threadEl.prepend(msg);
}

function getEditorValue() {
  if (monacoEditor) return monacoEditor.getValue();
  return editorFallback.value;
}

function setEditorValue(content) {
  if (monacoEditor) {
    monacoEditor.setValue(content);
    return;
  }
  editorFallback.value = content;
}

function initEditor() {
  if (window.monaco?.editor) {
    monacoRoot.style.display = "block";
    editorFallback.style.display = "none";

    monacoEditor = window.monaco.editor.create(monacoRoot, {
      value: editorFallback.value,
      language: "python",
      theme: document.documentElement.getAttribute("data-theme") === "light" ? "vs" : "vs-dark",
      automaticLayout: true,
      minimap: { enabled: true },
      fontSize: 13,
      lineNumbersMinChars: 3,
    });
  }
}

function hydrateWorkspaceContext() {
  const runtimeCtx = window.__IDE_CONTEXT__ || {};

  context.project_id = runtimeCtx.project_id || runtimeCtx.projectId || null;
  context.owner = runtimeCtx.owner || null;
  context.repo = runtimeCtx.repo || null;
  context.branch = runtimeCtx.branch || null;
  context.filePath = runtimeCtx.filePath || context.filePath;

  projectLabelEl.textContent = context.project_id || "No project context";
  repoLabelEl.textContent = context.repo ? `${context.owner || "?"}/${context.repo}` : "No repo context";
  branchLabelEl.textContent = context.branch || "No branch context";

  const session = getSession();
  sessionUserEl.textContent = session?.user?.email || session?.user?.id || "Not detected";

  authHintEl.textContent = session?.access_token
    ? "Authenticated session detected."
    : "No auth token found. Ensure app sets window.__SESSION__ or Supabase session.";
}

function getSession() {
  if (window.__SESSION__) return window.__SESSION__;

  try {
    const raw = localStorage.getItem("sb-session");
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }

  if (window.supabase?.auth?.session) {
    try {
      return window.supabase.auth.session();
    } catch {
      // ignore
    }
  }

  return null;
}

function getAccessToken() {
  const session = getSession();
  return session?.access_token || session?.accessToken || null;
}

function requireContextAndAuth() {
  const missing = [];
  if (!context.project_id) missing.push("project_id (window.__IDE_CONTEXT__.project_id)");
  if (!context.owner) missing.push("owner (window.__IDE_CONTEXT__.owner)");
  if (!context.repo) missing.push("repo (window.__IDE_CONTEXT__.repo)");
  if (!context.branch) missing.push("branch (window.__IDE_CONTEXT__.branch)");

  const token = getAccessToken();
  if (!token) missing.push("session access token (window.__SESSION__.access_token)");

  if (missing.length) {
    throw new Error(`Missing runtime context: ${missing.join(", ")}`);
  }

  return token;
}

async function apiPost(path, body) {
  const token = requireContextAndAuth();

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = { error: "Invalid JSON response" };
  }

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

async function createCheckpoint() {
  try {
    setStatus("Working", "running");

    const data = await apiPost("/checkpoints", {
      project_id: context.project_id,
      owner: context.owner,
      repo: context.repo,
      branch: context.branch,
    });

    checkpointInput.value = data.checkpoint_id || "";
    setOutput(data);
    addMessage("assistant", `Checkpoint created: ${data.checkpoint_id || "unknown"}`);
    setStatus("Idle", "idle");
  } catch (err) {
    setOutput({ error: err.message });
    addMessage("error", err.message);
    setStatus("Error", "error");
  }
}

async function runAI() {
  try {
    const prompt = promptEl.value.trim();
    if (!prompt) throw new Error("Prompt is required.");

    addMessage("user", prompt);
    setStatus("Running", "running");

    const data = await apiPost("/run", {
      project_id: context.project_id,
      mode: modeSelect.value,
      userPrompt: prompt,
      fileContext: getEditorValue(),
      owner: context.owner,
      repo: context.repo,
      branch: context.branch,
      filePath: context.filePath,
    });

    if (data.applied_code) {
      setEditorValue(data.applied_code);
    }

    if (data.checkpoint_id) {
      checkpointInput.value = data.checkpoint_id;
    }

    setOutput(data);
    addMessage("assistant", data.message || "Run complete.");
    setStatus("Idle", "idle");
  } catch (err) {
    setOutput({ error: err.message });
    addMessage("error", err.message);
    setStatus("Error", "error");
  }
}

async function rollbackState() {
  try {
    const checkpoint_id = checkpointInput.value.trim();
    if (!checkpoint_id) throw new Error("checkpoint_id is required");

    setStatus("Rolling Back", "running");

    const data = await apiPost("/return-state", {
      project_id: context.project_id,
      owner: context.owner,
      repo: context.repo,
      branch: context.branch,
      checkpoint_id,
      reason: "Manual rollback from UI",
    });

    setOutput(data);
    addMessage("assistant", `Rollback complete for ${checkpoint_id}`);
    setStatus("Idle", "idle");
  } catch (err) {
    setOutput({ error: err.message });
    addMessage("error", err.message);
    setStatus("Error", "error");
  }
}

function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  html.setAttribute("data-theme", next);

  if (monacoEditor && window.monaco?.editor) {
    window.monaco.editor.setTheme(next === "light" ? "vs" : "vs-dark");
  }
}