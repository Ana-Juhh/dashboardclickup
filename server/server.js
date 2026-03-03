import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

//////////////////////////////
// CONFIG
//////////////////////////////

// Seus LIST IDs (dos seus links)
const TASKS_LIST_ID = "901113131877";
const DIARY_LIST_ID = "901113131670";

// ✅ Filtrar por NOME do status (mais estável que id sc...)
const TODO_NAMES = [
  "a fazer",
  "diario",
  "mensal",
  "pendente",
  "pendências",
  "pendencias",
];

const INPROGRESS_NAMES = [
  "in progress",
  "inprogress",
  "em andamento",
  "andamento",
  "fazendo",
  "doing",
];

//////////////////////////////
// HELPERS
//////////////////////////////

function getToken() {
  const token = process.env.CLICKUP_TOKEN;
  if (!token) {
    const err = new Error("Missing env var CLICKUP_TOKEN");
    err.status = 500;
    throw err;
  }
  return token;
}

function safeText(s) {
  return (s ?? "").toString();
}

function normalizeStatusName(s) {
  return safeText(s)
    .trim()
    .toLowerCase()
    .normalize("NFD")                 // remove acentos
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function getStatusName(task) {
  // ClickUp geralmente usa task.status.status como nome.
  return normalizeStatusName(task?.status?.status || task?.status?.name || "");
}

function isTodo(task) {
  const n = getStatusName(task);
  return TODO_NAMES.some(x => n === normalizeStatusName(x));
}

function isInProgress(task) {
  const n = getStatusName(task);
  return INPROGRESS_NAMES.some(x => n === normalizeStatusName(x));
}

async function clickup(url) {
  const res = await fetch(url, {
    headers: { Authorization: getToken() },
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    const err = new Error(`ClickUp ${res.status}: ${text || res.statusText}`);
    err.status = res.status;
    throw err;
  }

  try {
    return JSON.parse(text);
  } catch {
    const err = new Error(`ClickUp respondeu não-JSON: ${text}`);
    err.status = 502;
    throw err;
  }
}

//////////////////////////////
// ROUTES
//////////////////////////////

// Healthcheck
app.get("/", (_req, res) => res.json({ ok: true }));

// Tarefas (TODO + INPROGRESS)
app.get("/api/tasks", async (_req, res) => {
  try {
    const url =
      `https://api.clickup.com/api/v2/list/${TASKS_LIST_ID}/task` +
      `?include_closed=true&subtasks=true&page=0&limit=100`; // 👈 true pra testar

    const data = await clickup(url);
    const tasks = Array.isArray(data?.tasks) ? data.tasks : [];

    // Debug: quantas por status
    const counts = {};
    for (const t of tasks) {
      const s = (t?.status?.status || t?.status?.name || "SEM_STATUS").toString();
      counts[s] = (counts[s] || 0) + 1;
    }

    const filtered = tasks.filter(t => isTodo(t) || isInProgress(t));

    res.json({
      total: tasks.length,
      porStatus: counts,
      filtradas: filtered.length,
      tasks: filtered,
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: String(e.message || e) });
  }
});

// Diário (sem filtro)
app.get("/api/diary", async (_req, res) => {
  try {
    const url =
      `https://api.clickup.com/api/v2/list/${DIARY_LIST_ID}/task` +
      `?include_closed=false&subtasks=true&page=0&limit=100`;

    const data = await clickup(url);

    const tasks = Array.isArray(data?.tasks) ? data.tasks : [];
    res.json({ tasks });
  } catch (e) {
    res.status(e.status || 500).json({ error: String(e.message || e) });
  }
});

//////////////////////////////
// START
//////////////////////////////

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("✅ Server on port", port));