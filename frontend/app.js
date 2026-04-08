const BASE_URL = "https://almifuvxnujzmsgdegpi.supabase.co/functions/v1/illusion-ai-router/ai";
const STORAGE_KEY = "illusion_ui_config_v2";

const state = {
  projectId: "",
  owner: "taremwastudios",
  repo: "illusionhost-agentic-IDE",
  branch: "main",
  filePath: "controller.py",
  accessToken: "",
};

const modeSelect = document.getElementById("modeSelect");
const modeBadge = document.getElementById("modeBadge");
const promptEl = document.getElementById("prompt");
const editorEl = document.getElementById("editor");
const outputEl = document.getElementById("output");
const checkpointInput = document.getElementById("checkpointId");
const themeToggle = document.getElementById("themeToggle");
const statusPill = document.getElementById("statusPill");
const threadEl = document.getElementById("thread");

const projectIdInput = document.getElementById("projectId");
const ownerInput = document.getElementById("ownerInput");
const repoInput = document.getElementById("repoInput");
const branchInput = document.getElementById("branchInput");
const filePathInput = document.getElementById("filePathInput");
const tokenInput = document.getElementById("tokenInput");
const saveConfigBtn = document.getElementById("saveConfig");

const btnRun = document.getElementById("btnRun");
const btnCheckpoint = document.getElementById("btnCheckpoint");
const btnRollback = document.getElementById("btnRollback");

// Events
btnRun.addEventListener("click", runAI);
btnCheckpoint.addEventListener("click", createCheckpoint);
btnRollback.addEventListener("click", rollbackState);
saveConfigBtn.addEventListener("click", saveConfig);
themeToggle.addEventListener("click", toggleTheme);
modeSelect.addEventListener("change", () => {
  modeBadge.textContent = modeSelect.value;
});

// Init
hydrateConfig();
modeBadge.textContent = modeSelect.value;
addMessage("assistant", "Workspace ready. Configure credentials and run your first task.");

function setStatus(text, kind = "idle") {
  statusPill.textContent = text;
  statusPill.className = `pill ${kind}`;
}

function setOutput(payload) {
  outputEl.textContent = JSON.stringify(payload, null, 2);
}

function addMessage(role, content) {
  const item = document.createElement("div");
  item.className = `msg ${role}`;

  const roleEl = document.createElement("div");
  roleEl.className = "role";
  roleEl.textContent = role;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = content;

  item.append(roleEl, bubble);
  threadEl.prepend(item);
}

function hydrateConfig() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      Object.assign(state, JSON.parse(saved));
    } catch {
      // ignore malformed local state
    }
  }

  projectIdInput.value = state.projectId;
  ownerInput.value = state.owner;
  repoInput.value = state.repo;
  branchInput.value = state.branch;
  filePathInput.value = state.filePath;
  tokenInput.value = state.accessToken;
}

function saveConfig(announce = true) {
  state.projectId = projectIdInput.value.trim();
  state.owner = ownerInput.value.trim();
  state.repo = repoInput.value.trim();
  state.branch = branchInput.value.trim();
  state.filePath = filePathInput.value.trim();
  state.accessToken = tokenInput.value.trim();

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  if (announce) {
    setOutput({ ok: true, message: "Configuration saved locally" });
    addMessage("assistant", "Configuration saved.");
  }
}

function validateConfig() {
  const missing = [];
  if (!state.projectId) missing.push("project_id");
  if (!state.owner) missing.push("owner");
  if (!state.repo) missing.push("repo");
  if (!state.branch) missing.push("branch");
  if (!state.filePath) missing.push("filePath");
  if (!state.accessToken) missing.push("access token");

  if (missing.length) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }
}

async function apiPost(path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.accessToken}`,
    },
    body: JSON.stringify(body),
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = { error: "Invalid JSON response from API" };
  }

  if (!response.ok) {
    const msg = data?.error || `Request failed (${response.status})`;
    throw new Error(msg);
  }

  return data;
}

async function runAI() {
  try {
    saveConfig(false);
    validateConfig();

    const prompt = promptEl.value.trim();
    if (!prompt) throw new Error("Prompt is required.");

    addMessage("user", prompt);
    setStatus("Running", "running");

    const data = await apiPost("/run", {
      project_id: state.projectId,
      mode: modeSelect.value,
      userPrompt: prompt,
      fileContext: editorEl.value,
      owner: state.owner,
      repo: state.repo,
      branch: state.branch,
      filePath: state.filePath,
    });

    if (data.applied_code) editorEl.value = data.applied_code;
    if (data.checkpoint_id) checkpointInput.value = data.checkpoint_id;

    setOutput(data);
    addMessage("assistant", data.message || "Run complete.");
    setStatus("Idle", "idle");
  } catch (err) {
    const message = err?.message || "Run failed.";
    setOutput({ error: message });
    addMessage("error", message);
    setStatus("Error", "error");
  }
}

async function createCheckpoint() {
  try {
    saveConfig(false);
    validateConfig();
    setStatus("Working", "running");

    const data = await apiPost("/checkpoints", {
      project_id: state.projectId,
      owner: state.owner,
      repo: state.repo,
      branch: state.branch,
    });

    checkpointInput.value = data.checkpoint_id || "";
    setOutput(data);
    addMessage("assistant", `Checkpoint created: ${data.checkpoint_id || "unknown"}`);
    setStatus("Idle", "idle");
  } catch (err) {
    const message = err?.message || "Checkpoint failed.";
    setOutput({ error: message });
    addMessage("error", message);
    setStatus("Error", "error");
  }
}

async function rollbackState() {
  try {
    saveConfig(false);
    validateConfig();

    const checkpointId = checkpointInput.value.trim();
    if (!checkpointId) throw new Error("checkpoint_id is required");

    setStatus("Rolling Back", "running");

    const data = await apiPost("/return-state", {
      project_id: state.projectId,
      owner: state.owner,
      repo: state.repo,
      branch: state.branch,
      checkpoint_id: checkpointId,
      reason: "Manual rollback from UI",
    });

    setOutput(data);
    addMessage("assistant", `Rollback complete: ${checkpointId}`);
    setStatus("Idle", "idle");
  } catch (err) {
    const message = err?.message || "Rollback failed.";
    setOutput({ error: message });
    addMessage("error", message);
    setStatus("Error", "error");
  }
}

function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute("data-theme") || "dark";
  html.setAttribute("data-theme", current === "dark" ? "light" : "dark");
}