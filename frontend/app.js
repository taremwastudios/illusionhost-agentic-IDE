const BASE_URL = "https://almifuvxnujzmsgdegpi.supabase.co/functions/v1/illusion-ai-router/ai";
const STORAGE_KEY = "illusion_ui_config_v1";

const state = {
  projectId: "",
  owner: "taremwastudios",
  repo: "illusionhost-agentic-IDE",
  branch: "main",
  filePath: "controller.py",
  accessToken: "",
};

const modeSelect = document.getElementById("modeSelect");
const promptEl = document.getElementById("prompt");
const editorEl = document.getElementById("editor");
const outputEl = document.getElementById("output");
const checkpointInput = document.getElementById("checkpointId");
const themeToggle = document.getElementById("themeToggle");
const statusEl = document.getElementById("agentStatus");
const timelineEl = document.getElementById("timeline");

const projectIdInput = document.getElementById("projectId");
const ownerInput = document.getElementById("ownerInput");
const repoInput = document.getElementById("repoInput");
const branchInput = document.getElementById("branchInput");
const filePathInput = document.getElementById("filePathInput");
const tokenInput = document.getElementById("tokenInput");
const saveConfigBtn = document.getElementById("saveConfig");

document.getElementById("btnCheckpoint").addEventListener("click", createCheckpoint);
document.getElementById("btnRun").addEventListener("click", runAI);
document.getElementById("btnRollback").addEventListener("click", rollbackState);
themeToggle.addEventListener("click", toggleTheme);
saveConfigBtn.addEventListener("click", saveConfig);

hydrateConfig();
renderTimeline("system", "Welcome. Configure your workspace and run an AI task.");

function setOutput(obj) {
  outputEl.textContent = JSON.stringify(obj, null, 2);
}

function setStatus(text, type = "idle") {
  statusEl.textContent = text;
  statusEl.className = `status-badge ${type}`;
}

function renderTimeline(role, message) {
  const entry = document.createElement("div");
  entry.className = "entry";

  const roleEl = document.createElement("div");
  roleEl.className = "role";
  roleEl.textContent = role;

  const msgEl = document.createElement("p");
  msgEl.textContent = message;

  entry.append(roleEl, msgEl);
  timelineEl.prepend(entry);
}

function hydrateConfig() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      Object.assign(state, JSON.parse(raw));
    } catch {
      // ignore malformed cache
    }
  }

  projectIdInput.value = state.projectId;
  ownerInput.value = state.owner;
  repoInput.value = state.repo;
  branchInput.value = state.branch;
  filePathInput.value = state.filePath;
  tokenInput.value = state.accessToken;
}

function saveConfig() {
  state.projectId = projectIdInput.value.trim();
  state.owner = ownerInput.value.trim();
  state.repo = repoInput.value.trim();
  state.branch = branchInput.value.trim();
  state.filePath = filePathInput.value.trim();
  state.accessToken = tokenInput.value.trim();

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  setOutput({ ok: true, message: "Configuration saved locally" });
  renderTimeline("system", "Configuration saved.");
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
    throw { error: `Missing required fields: ${missing.join(", ")}` };
  }
}

async function apiPost(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

async function createCheckpoint() {
  try {
    saveConfig();
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
    renderTimeline("assistant", `Checkpoint created: ${data.checkpoint_id || "unknown"}`);
    setStatus("Idle", "idle");
  } catch (e) {
    setOutput(e);
    renderTimeline("error", e.error || "Unable to create checkpoint.");
    setStatus("Error", "error");
  }
}

async function runAI() {
  try {
    saveConfig();
    validateConfig();
    const mode = modeSelect.value;

    renderTimeline("user", promptEl.value || "(empty prompt)");
    setStatus("Running", "running");

    const data = await apiPost("/run", {
      project_id: state.projectId,
      mode,
      userPrompt: promptEl.value,
      fileContext: editorEl.value,
      owner: state.owner,
      repo: state.repo,
      branch: state.branch,
      filePath: state.filePath,
    });

    if (data.applied_code) editorEl.value = data.applied_code;
    if (data.checkpoint_id) checkpointInput.value = data.checkpoint_id;

    setOutput(data);
    renderTimeline("assistant", data.message || "Run complete.");
    setStatus("Idle", "idle");
  } catch (e) {
    setOutput(e);
    renderTimeline("error", e.error || "AI run failed.");
    setStatus("Error", "error");
  }
}

async function rollbackState() {
  try {
    saveConfig();
    validateConfig();

    const checkpoint_id = checkpointInput.value.trim();
    if (!checkpoint_id) {
      throw { error: "checkpoint_id is required" };
    }

    setStatus("Rolling Back", "running");
    const data = await apiPost("/return-state", {
      project_id: state.projectId,
      owner: state.owner,
      repo: state.repo,
      branch: state.branch,
      checkpoint_id,
      reason: "Manual rollback from UI",
    });

    setOutput(data);
    renderTimeline("assistant", `Rollback complete for checkpoint ${checkpoint_id}.`);
    setStatus("Idle", "idle");
  } catch (e) {
    setOutput(e);
    renderTimeline("error", e.error || "Rollback failed.");
    setStatus("Error", "error");
  }
}

function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute("data-theme") || "dark";
  html.setAttribute("data-theme", current === "dark" ? "light" : "dark");
}
