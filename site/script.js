/* script.js (SEM TOKEN)
   Front chama seu backend no Render:
   - GET {API_BASE}/api/tasks  -> { tasks: [...] }
   - GET {API_BASE}/api/diary  -> { tasks: [...] }
*/

//////////////////////////////
// CONFIG
//////////////////////////////

console.log("✅ script.js carregou (sem token)");

// ✅ Troque pela URL do seu serviço no Render (sem barra no final)
const API_BASE = "https://dashboardclickup-jspu.onrender.com";

// Atualização automática
const REFRESH_MS = 2 * 60 * 1000;

// ✅ NOVO: separe por NOME do status (mais estável que id sc...)
const TODO_NAMES = [
  "to do",
  "todo",
  "a fazer",
  "afazer",
  "pendente",
  "pendências",
  "pendencias"
];

const INPROGRESS_NAMES = [
  "in progress",
  "inprogress",
  "em andamento",
  "andamento",
  "fazendo",
  "doing"
];

//////////////////////////////
// HELPERS
//////////////////////////////

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatDDMMYYYY(date) {
  const d = new Date(date);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function previousRelevantDiaryString() {
  const d = new Date();
  const dayOfWeek = d.getDay(); // 0=domingo, 1=segunda, ..., 6=sábado

  // Segunda-feira -> mostrar sexta-feira
  if (dayOfWeek === 1) {
    d.setDate(d.getDate() - 3);
  } else {
    d.setDate(d.getDate() - 1);
  }

  return formatDDMMYYYY(d);
}

function safeText(s) {
  return (s ?? "").toString();
}

function escapeHtml(str) {
  return safeText(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function splitLinesToLis(text) {
  const lines = safeText(text).split("\n").map(l => l.trim()).filter(Boolean);
  if (!lines.length) return "";
  return `<ul class="items">${lines.map(l => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`;
}

function priorityLabel(priorityId) {
  switch (String(priorityId)) {
    case "1": return "Urgente";
    case "2": return "Alta";
    case "3": return "Normal";
    case "4": return "Baixa";
    default: return "Sem prioridade";
  }
}

function $(id) {
  return document.getElementById(id);
}

async function apiFetch(path) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, { cache: "no-store" });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`API ${res.status} em ${url}\n${text || res.statusText}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Resposta não-JSON da API em ${url}\n${text}`);
  }
}

function sortByPriorityAsc(a, b) {
  const pa = Number(a?.priority?.id ?? 999);
  const pb = Number(b?.priority?.id ?? 999);
  return pa - pb;
}

function normalizeStatusName(s) {
  return safeText(s)
    .trim()
    .toLowerCase()
    .normalize("NFD")                 // remove acentos
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");            // espaços extras
}

function getStatusName(task) {
  // ClickUp costuma usar: task.status.status (nome) e task.status.id (sc...)
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

//////////////////////////////
// RENDER
//////////////////////////////

function setCounts({ todo, inprogress, total }) {
  const todoEl = $("todoCount");
  const progEl = $("progressCount");
  const totalEl = $("totalCount");

  if (todoEl) todoEl.textContent = String(todo);
  if (progEl) progEl.textContent = String(inprogress);
  if (totalEl) totalEl.textContent = String(total);

  // Badges
  const todoBadge = $("badgeTodo");
  const progBadge = $("badgeProgress");

  if (todoBadge) todoBadge.textContent = String(todo);
  if (progBadge) progBadge.textContent = String(inprogress);
}

function renderTaskCard(task) {
  const name = escapeHtml(task.name);
  const description = safeText(task.description);

  const due = task.due_date ? formatDDMMYYYY(Number(task.due_date)) : null;

  const assignees = Array.isArray(task.assignees) ? task.assignees : [];
  const assigneesHtml = assignees.length
    ? `<div class="assignees">
         <p class="bold">Responsáveis:</p>
         <ul class="items">
           ${assignees.map(a => `<li>${escapeHtml(a.username || a.email || a.id)}</li>`).join("")}
         </ul>
       </div>`
    : "";

  const pr = task.priority || {};
  const prText = priorityLabel(pr.id);
  const prColor = pr.color || "#fbbf24";

  const descHtml = description
    ? `<div class="description">
         <p class="bold">Descrição:</p>
         ${splitLinesToLis(description)}
       </div>`
    : "";

  const dueHtml = due
    ? `<p class="duedate"><span class="bold">Data Final: </span>${escapeHtml(due)}</p>`
    : "";

  return `
    <article class="card taskCard">
      <div class="taskHeader">
        <p class="taskTitle">${name}</p>
      </div>

      <div class="taskBody">
        <p class="priority" style="color:${escapeHtml(prColor)}">
          <span class="bold">Prioridade: </span>${escapeHtml(prText)}
        </p>

        ${dueHtml}
        ${assigneesHtml}
        ${descHtml}
      </div>
    </article>
  `;
}

function renderDiaryCard(task) {
  const name = escapeHtml(task.name);
  const description = safeText(task.description);

  return `
    <article class="card diaryCard">
      <div class="diaryHeader">
        <p>${name}</p>
      </div>
      <div class="diaryBody">
        ${splitLinesToLis(description)}
      </div>
    </article>
  `;
}

//////////////////////////////
// TV MODE AUTO SCROLL (suave)
//////////////////////////////

function startAutoScrollTV({
  selectors = [],
  speed = 0.65,
  pauseMsAtEnd = 2200,
  pauseMsAtTop = 900
} = {}) {
  const boxes = selectors.flatMap(sel => Array.from(document.querySelectorAll(sel)));

  boxes.forEach((box) => {
    if (!box) return;

    // evita duplicar
    if (box.dataset.autoscroll === "1") return;
    box.dataset.autoscroll = "1";

    let running = true;
    let last = performance.now();
    let pausedUntil = 0;

    const step = (now) => {
      if (!running) return;

      const dt = now - last;
      last = now;

      if (now < pausedUntil) {
        requestAnimationFrame(step);
        return;
      }

      const max = box.scrollHeight - box.clientHeight;

      // sem scroll
      if (max <= 0) {
        requestAnimationFrame(step);
        return;
      }

      // move
      box.scrollTop += speed * dt;

      // fim -> pausa -> volta pro topo
      if (box.scrollTop >= max - 1) {
        pausedUntil = now + pauseMsAtEnd;
        box.scrollTop = 0;
        pausedUntil += pauseMsAtTop;
      }

      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);

    box.addEventListener("mouseenter", () => { running = false; });
    box.addEventListener("mouseleave", () => {
      if (!running) {
        running = true;
        last = performance.now();
        requestAnimationFrame(step);
      }
    });

    box.addEventListener("scroll", () => {
      pausedUntil = performance.now() + 600;
    }, { passive: true });

    window.addEventListener("resize", () => {
      pausedUntil = performance.now() + 400;
    });
  });
}

//////////////////////////////
// MAIN
//////////////////////////////

async function loadDashboard() {
  const todoList = $("todoList");
  const progressList = $("progressList");
  const diaryList = $("diaryList");

  if (todoList) todoList.innerHTML = `<p class="muted">Carregando...</p>`;
  if (progressList) progressList.innerHTML = `<p class="muted">Carregando...</p>`;
  if (diaryList) diaryList.innerHTML = `<p class="muted">Carregando...</p>`;

  if (!API_BASE) {
    throw new Error("Configure API_BASE com a URL do seu serviço no Render.");
  }

  const [tasksData, diaryData] = await Promise.all([
    apiFetch("/api/tasks"),
    apiFetch("/api/diary")
  ]);

  const tasks = Array.isArray(tasksData.tasks) ? tasksData.tasks : [];
  const diaryTasks = Array.isArray(diaryData.tasks) ? diaryData.tasks : [];

  // ✅ DEBUG opcional (se quiser ver no console os status reais)
  // console.log("Statuses recebidos:", [...new Set(tasks.map(t => `${t?.status?.status} | ${t?.status?.id}`))]);

  // ✅ NOVO: separa por NOME do status
  const todo = tasks.filter(isTodo);
  const inprogress = tasks.filter(isInProgress);

  setCounts({ todo: todo.length, inprogress: inprogress.length, total: tasks.length });

  if (todoList) {
    todoList.innerHTML =
      todo.sort(sortByPriorityAsc).map(renderTaskCard).join("") || `<p class="muted">Sem tarefas.</p>`;
  }

  if (progressList) {
    progressList.innerHTML =
      inprogress.sort(sortByPriorityAsc).map(renderTaskCard).join("") || `<p class="muted">Sem tarefas.</p>`;
  }

  const previousDiaryDate = previousRelevantDiaryString();

const filteredDiary = diaryTasks.filter(t => {
  const name = safeText(t.name);
  return name.includes(previousDiaryDate);
});

if (diaryList) {
  diaryList.innerHTML =
    filteredDiary.map(renderDiaryCard).join("") ||
    `<p class="muted">Nenhum diário encontrado para ${previousDiaryDate}.</p>`;
}

  // ✅ Reset scroll nos containers certos (os que realmente rolam)
  ["#diaryScroll", "#todoScroll", "#progressScroll"].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) el.scrollTop = 0;
  });

  // ✅ Auto-scroll nos containers certos (diário + colunas)
  startAutoScrollTV({
    selectors: ["#diaryScroll", "#todoScroll", "#progressScroll"],
    speed: 0.65,
    pauseMsAtEnd: 2400,
    pauseMsAtTop: 900
  });
}

function showFatalError(err) {
  console.error(err);
  const msg = escapeHtml(err?.message || String(err));

  const errEl = $("err");
  if (errEl) {
    errEl.textContent = `Erro: ${msg}`;
    errEl.style.display = "block";
    return;
  }

  alert(`Erro no dashboard:\n\n${err?.message || err}`);
}

document.addEventListener("DOMContentLoaded", () => {
  loadDashboard().catch(showFatalError);
  setInterval(() => loadDashboard().catch(showFatalError), REFRESH_MS);
});