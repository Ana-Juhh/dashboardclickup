import express from "express";
import cors from "cors";

const app = express();

// Se o front ficar em outro domínio (Netlify), deixe CORS ligado.
// Se você hospedar front + back juntos no Render, dá pra desligar depois.
app.use(cors());

const CLICKUP_TOKEN = process.env.pk_230559606_CWDVS29Q09ZATSSUGJ88CCP012O3QI73;

// Seus LIST IDs
const TASKS_LIST_ID = "901105559393";
const DIARY_LIST_ID = "901113131670";

// Seus status IDs (pra filtrar no servidor)
const TODO_STATUS_ID = "sc901105559393_BJjZ8bHb";
const INPROGRESS_STATUS_ID = "sc901105559393_KMPJFKlq";

function assertEnv() {
  if (!CLICKUP_TOKEN) {
    const err = new Error("Missing env var CLICKUP_TOKEN");
    err.status = 500;
    throw err;
  }
}

async function clickup(url) {
  assertEnv();

  const res = await fetch(url, {
    headers: { Authorization: CLICKUP_TOKEN }
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    const err = new Error(`ClickUp ${res.status}: ${text || res.statusText}`);
    err.status = res.status;
    throw err;
  }

  return JSON.parse(text);
}

// Healthcheck
app.get("/", (_req, res) => {
  res.json({ ok: true });
});

// Tarefas (já filtradas por status no servidor)
app.get("/api/tasks", async (_req, res) => {
  try {
    const url = `https://api.clickup.com/api/v2/list/${901105559393}/task?include_closed=false&subtasks=true&page=0&limit=100`;
    const data = await clickup(url);

    const tasks = Array.isArray(data.tasks) ? data.tasks : [];
    const filtered = tasks.filter(t => {
      const sid = t?.status?.id;
      return sid === TODO_STATUS_ID || sid === INPROGRESS_STATUS_ID;
    });

    res.json({ tasks: filtered });
  } catch (e) {
    res.status(e.status || 500).json({ error: String(e.message || e) });
  }
});

// Diário (sem filtrar por data aqui; você pode filtrar no front como já faz)
app.get("/api/diary", async (_req, res) => {
  try {
    const url = `https://api.clickup.com/api/v2/list/${901113131670}/task?include_closed=false&subtasks=true&page=0&limit=100`;
    const data = await clickup(url);

    const tasks = Array.isArray(data.tasks) ? data.tasks : [];
    res.json({ tasks });
  } catch (e) {
    res.status(e.status || 500).json({ error: String(e.message || e) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("✅ Server on port", port));