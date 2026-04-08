const BASE_URL = "https://almifuvxnujzmsgdegpi.supabase.co/functions/v1/illusion-ai-router/ai";

const state = {
  mode: "ask",
  repo: null,
  filePath: null,
  pendingPatch: null,
  checkpointId: null,
};

const api = {
  repos: "/github/repos",
  files: "/github/files",
  readFile: "/github/file",
  writeFile: "/github/file",
  createPr: "/github/pr",
};

const el = {
  statusPill: document.getElementById("statusPill"),
  authState: document.getElementById("authState"),
  userState: document.getElementById("userState"),
  repoList: document.getElementById("repoList"),
  fileTree: document.getElementById("fileTree"),
  activeRepoLabel: document.getElementById("activeRepoLabel"),
  activeFileLabel: document.getElementById("activeFileLabel"),
  modeSelect: document.getElementById("modeSelect"),
  modeBadge: document.getElementById("modeBadge"),
  thread: document.getElementById("thread"),
  prompt: document.getElementById("prompt"),
  editor: document.getElementById("editor"),
  output: document.getElementById("output"),
  changePreview: document.getElementById("changePreview"),
  checkpointId: document.getElementById("checkpointId"),
  monacoRoot: document.getElementById("monacoRoot"),
};

let monacoEditor = null;

// ---------- init ----------
document.getElementById("btnGithubLogin").addEventListener("click", githubLogin);
document.getElementById("btnRefreshRepos").addEventListener("click", loadRepos);
document.getElementById("btnRun").addEventListener("click", runAgent);
document.getElementById("btnCheckpoint").addEventListener("click", createCheckpoint);
document.getElementById("btnRollback").addEventListener("click", rollback);
document.getElementById("btnApplyPatch").addEventListener("click", applyAiEdit);
document.getElementById("btnCreatePr").addEventListener("click", createPr);
document.getElementById("themeToggle").addEventListener("click", toggleTheme);

el.modeSelect.addEventListener("change", () => {
  state.mode = el.modeSelect.value;
  el.modeBadge.textContent = state.mode;
});

state.mode = el.modeSelect.value;
el.modeBadge.textContent = state.mode;
initEditor();
hydrateSessionUI();
addMessage("assistant", "Connect GitHub, pick a repository, and tell the agent what to edit.");
loadRepos();

// ---------- session/auth ----------
function getSession() {
  if (window.__SESSION__) return window.__SESSION__;

  if (window.supabase?.auth?.session) {
    try {
      return window.supabase.auth.session();
    } catch {
      // ignore
    }
  }

  return null;
}

function getToken() {
  const session = getSession();
  return session?.access_token || session?.accessToken || null;
}

function hydrateSessionUI() {
  const session = getSession();
  const user = session?.user;

  if (!session) {
    el.authState.textContent = "Not authenticated. Click GitHub Login.";
    el.userState.textContent = "No active session";
    return;
  }

  el.authState.textContent = "Authenticated via session";
  el.userState.textContent = user?.email || user?.id || "Session user";
}

function githubLogin() {
  if (window.__GITHUB_OAUTH_URL__) {
    window.location.href = window.__GITHUB_OAUTH_URL__;
    return;
  }

  addMessage("error", "No OAuth URL configured. Set window.__GITHUB_OAUTH_URL__ in host app.");
}

// ---------- UI helpers ----------
function setStatus(text, kind = "idle") {
  el.statusPill.textContent = text;
  el.statusPill.className = `pill ${kind}`;
}

function setOutput(data) {
  el.output.textContent = JSON.stringify(data, null, 2);
}

function addMessage(role, text) {
  const row = document.createElement("div");
  row.className = `msg ${role}`;

  const r = document.createElement("div");
  r.className = "role";
  r.textContent = role;

  const b = document.createElement("div");
  b.className = "bubble";
  b.textContent = text;

  row.append(r, b);
  el.thread.prepend(row);
}

function getEditorValue() {
  return monacoEditor ? monacoEditor.getValue() : el.editor.value;
}

function setEditorValue(value) {
  if (monacoEditor) {
    monacoEditor.setValue(value);
    return;
  }
  el.editor.value = value;
}

function initEditor() {
  if (!window.monaco?.editor) return;

  el.monacoRoot.style.display = "block";
  el.editor.style.display = "none";

  monacoEditor = window.monaco.editor.create(el.monacoRoot, {
    value: el.editor.value,
    language: "python",
    theme: document.documentElement.getAttribute("data-theme") === "light" ? "vs" : "vs-dark",
    automaticLayout: true,
    minimap: { enabled: true },
    fontSize: 13,
  });
}

// ---------- API ----------
async function authedFetch(path, opts = {}) {
  const token = getToken();
  if (!token) throw new Error("No authenticated session token.");

  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({ error: "Invalid JSON" }));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function getMockRepos() {
  return [
    { id: "1", owner: "taremwastudios", name: "illusionhost-agentic-IDE", branch: "main" },
    { id: "2", owner: "taremwastudios", name: "illusionhost-web", branch: "main" },
  ];
}

function getMockFiles() {
  return ["frontend/index.html", "frontend/styles.css", "frontend/app.js", "controller.py"];
}

async function loadRepos() {
  hydrateSessionUI();
  setStatus("Loading", "running");

  try {
    let repos = [];
    try {
      const data = await authedFetch(api.repos);
      repos = data.repos || [];
    } catch {
      repos = getMockRepos();
      addMessage("assistant", "Using mock repos (configure /github/repos endpoint to use live data).");
    }

    renderRepoList(repos);
    setStatus("Idle", "idle");
  } catch (err) {
    addMessage("error", err.message);
    setStatus("Error", "error");
  }
}

function renderRepoList(repos) {
  el.repoList.innerHTML = "";

  if (!repos.length) {
    el.repoList.innerHTML = '<div class="muted">No repositories found.</div>';
    return;
  }

  repos.forEach((repo) => {
    const item = document.createElement("button");
    item.className = "item";
    item.textContent = `${repo.owner}/${repo.name}`;
    item.onclick = () => selectRepo(repo, item);
    el.repoList.appendChild(item);
  });
}

async function selectRepo(repo, element) {
  state.repo = repo;
  document.querySelectorAll("#repoList .item").forEach((x) => x.classList.remove("active"));
  element.classList.add("active");
  el.activeRepoLabel.textContent = `${repo.owner}/${repo.name}@${repo.branch || "main"}`;

  try {
    let files;
    try {
      const data = await authedFetch(api.files, {
        method: "POST",
        body: JSON.stringify({ owner: repo.owner, repo: repo.name, branch: repo.branch || "main", path: "" }),
      });
      files = data.files || [];
    } catch {
      files = getMockFiles();
    }

    renderFiles(files);
    addMessage("assistant", `Repository loaded: ${repo.owner}/${repo.name}`);
  } catch (err) {
    addMessage("error", err.message);
  }
}

function renderFiles(files) {
  el.fileTree.innerHTML = "";

  files.forEach((path) => {
    const item = document.createElement("button");
    item.className = "item";
    item.textContent = path;
    item.onclick = () => openFile(path, item);
    el.fileTree.appendChild(item);
  });
}

async function openFile(path, element) {
  if (!state.repo) return;

  state.filePath = path;
  document.querySelectorAll("#fileTree .item").forEach((x) => x.classList.remove("active"));
  element.classList.add("active");
  el.activeFileLabel.textContent = path;

  try {
    let content;

    try {
      const data = await authedFetch(api.readFile, {
        method: "POST",
        body: JSON.stringify({
          owner: state.repo.owner,
          repo: state.repo.name,
          branch: state.repo.branch || "main",
          path,
        }),
      });
      content = data.content || "";
    } catch {
      content = `# Mock content\n# ${path}\n`;
    }

    setEditorValue(content);
  } catch (err) {
    addMessage("error", err.message);
  }
}

// ---------- Agent actions ----------
async function runAgent() {
  try {
    if (!state.repo) throw new Error("Select a repository first.");
    if (!state.filePath) throw new Error("Select a file first.");

    const prompt = el.prompt.value.trim();
    if (!prompt) throw new Error("Prompt is required.");

    addMessage("user", prompt);
    setStatus("Running", "running");

    const data = await authedFetch(`${BASE_URL}/run`, {
      method: "POST",
      body: JSON.stringify({
        project_id: window.__IDE_CONTEXT__?.project_id,
        mode: state.mode,
        userPrompt: prompt,
        fileContext: getEditorValue(),
        owner: state.repo.owner,
        repo: state.repo.name,
        branch: state.repo.branch || "main",
        filePath: state.filePath,
      }),
    });

    if (data.applied_code) {
      state.pendingPatch = data.applied_code;
      el.changePreview.textContent = data.applied_code;
      addMessage("assistant", "I prepared an edit. Click 'Apply AI Edit' to put it in the editor.");
    } else {
      addMessage("assistant", data.message || "Run complete.");
    }

    if (data.checkpoint_id) {
      state.checkpointId = data.checkpoint_id;
      el.checkpointId.value = data.checkpoint_id;
    }

    setOutput(data);
    setStatus("Idle", "idle");
  } catch (err) {
    setOutput({ error: err.message });
    addMessage("error", err.message);
    setStatus("Error", "error");
  }
}

function applyAiEdit() {
  if (!state.pendingPatch) {
    addMessage("error", "No AI edit available. Run the agent first.");
    return;
  }
  setEditorValue(state.pendingPatch);
  addMessage("assistant", "Applied AI edit to editor.");
}

async function createCheckpoint() {
  try {
    if (!state.repo) throw new Error("Select a repository first.");
    setStatus("Working", "running");

    const data = await authedFetch(`${BASE_URL}/checkpoints`, {
      method: "POST",
      body: JSON.stringify({
        project_id: window.__IDE_CONTEXT__?.project_id,
        owner: state.repo.owner,
        repo: state.repo.name,
        branch: state.repo.branch || "main",
      }),
    });

    state.checkpointId = data.checkpoint_id;
    el.checkpointId.value = data.checkpoint_id || "";
    setOutput(data);
    addMessage("assistant", `Checkpoint created: ${data.checkpoint_id || "unknown"}`);
    setStatus("Idle", "idle");
  } catch (err) {
    setOutput({ error: err.message });
    addMessage("error", err.message);
    setStatus("Error", "error");
  }
}

async function rollback() {
  try {
    if (!state.repo) throw new Error("Select a repository first.");

    const checkpoint_id = el.checkpointId.value.trim();
    if (!checkpoint_id) throw new Error("Checkpoint ID required.");

    setStatus("Rolling Back", "running");

    const data = await authedFetch(`${BASE_URL}/return-state`, {
      method: "POST",
      body: JSON.stringify({
        project_id: window.__IDE_CONTEXT__?.project_id,
        owner: state.repo.owner,
        repo: state.repo.name,
        branch: state.repo.branch || "main",
        checkpoint_id,
        reason: "Manual rollback from IDE UI",
      }),
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

async function createPr() {
  try {
    if (!state.repo) throw new Error("Select a repository first.");
    if (!state.filePath) throw new Error("Select a file first.");

    const title = `AI edit: ${state.filePath}`;
    const body = "Generated from Illusionhost Agent Workspace";

    const data = await authedFetch(api.createPr, {
      method: "POST",
      body: JSON.stringify({
        owner: state.repo.owner,
        repo: state.repo.name,
        base_branch: state.repo.branch || "main",
        title,
        body,
        filePath: state.filePath,
        content: getEditorValue(),
      }),
    }).catch(() => ({
      mock: true,
      message: "PR endpoint not wired yet. UI flow is ready.",
      title,
    }));

    setOutput(data);
    addMessage("assistant", data.message || "PR request submitted.");
  } catch (err) {
    setOutput({ error: err.message });
    addMessage("error", err.message);
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