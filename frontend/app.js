const BASE_URL = "https://almifuvxnujzmsgdegpi.supabase.co/functions/v1/illusion-ai-router/ai";

// Fill these once for now (later from auth/session + project picker)
const PROJECT_ID = "PUT_PROJECT_UUID_HERE";
const OWNER = "taremwastudios";
const REPO = "illusionhost-agentic-IDE";
const BRANCH = "main";
const FILE_PATH = "controller.py";

// Use a real Supabase access token from login session
let ACCESS_TOKEN = "PUT_SUPABASE_ACCESS_TOKEN_HERE";

const modeSelect = document.getElementById("modeSelect");
const promptEl = document.getElementById("prompt");
const editorEl = document.getElementById("editor");
const outputEl = document.getElementById("output");
const checkpointInput = document.getElementById("checkpointId");
const themeToggle = document.getElementById("themeToggle");

document.getElementById("btnCheckpoint").addEventListener("click", createCheckpoint);
document.getElementById("btnRun").addEventListener("click", runAI);
document.getElementById("btnRollback").addEventListener("click", rollbackState);
themeToggle.addEventListener("click", toggleTheme);

function setOutput(obj) {
  outputEl.textContent = JSON.stringify(obj, null, 2);
}

async function apiPost(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

async function createCheckpoint() {
  try {
    const data = await apiPost("/checkpoints", {
      project_id: PROJECT_ID,
      owner: OWNER,
      repo: REPO,
      branch: BRANCH,
    });
    checkpointInput.value = data.checkpoint_id || "";
    setOutput(data);
  } catch (e) {
    setOutput(e);
  }
}

async function runAI() {
  try {
    const mode = modeSelect.value;
    const data = await apiPost("/run", {
      project_id: PROJECT_ID,
      mode,
      userPrompt: promptEl.value,
      fileContext: editorEl.value,
      owner: OWNER,
      repo: REPO,
      branch: BRANCH,
      filePath: FILE_PATH,
    });

    if (data.applied_code) editorEl.value = data.applied_code;
    if (data.checkpoint_id) checkpointInput.value = data.checkpoint_id;
    setOutput(data);
  } catch (e) {
    setOutput(e);
  }
}

async function rollbackState() {
  try {
    const checkpoint_id = checkpointInput.value.trim();
    if (!checkpoint_id) {
      setOutput({ error: "checkpoint_id is required" });
      return;
    }

    const data = await apiPost("/return-state", {
      project_id: PROJECT_ID,
      owner: OWNER,
      repo: REPO,
      branch: BRANCH,
      checkpoint_id,
      reason: "Manual rollback from UI",
    });
    setOutput(data);
  } catch (e) {
    setOutput(e);
  }
}

function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute("data-theme") || "dark";
  html.setAttribute("data-theme", current === "dark" ? "light" : "dark");
}