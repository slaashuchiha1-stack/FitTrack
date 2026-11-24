import { getData } from "../storage.js";
import { formatDateBR, greeting, currentMonthISO, todayISO, escapeHtml } from "../utils.js";

let chart = null;

function averageCargasPorTreino() {
  const { treinos } = getData();
  const sorted = [...treinos].sort((a, b) => a.data.localeCompare(b.data));
  return sorted.map((t) => {
    const cargas = t.itens.map((i) => i.carga);
    const media = cargas.reduce((s, c) => s + c, 0) / cargas.length;
    return { data: t.data, media: Number(media.toFixed(1)) };
  });
}

export function renderDashboard() {
  const data = getData();

  document.getElementById("dashGreeting").textContent = `${greeting()}! Pronto para treinar?`;
  document.getElementById("dashDateLabel").textContent = `Hoje é ${formatDateBR(todayISO())}`;

  document.getElementById("statFichas").textContent = data.fichas.length;

  const mes = currentMonthISO();
  const treinosMes = data.treinos.filter((t) => t.data.startsWith(mes)).length;
  document.getElementById("statTreinosMes").textContent = treinosMes;

  const ultimo = [...data.treinos].sort((a, b) => b.data.localeCompare(a.data))[0];
  document.getElementById("statUltimoTreino").textContent = ultimo
    ? formatDateBR(ultimo.data)
    : "—";

  renderChart();
  renderRecent(data);
}

function renderChart() {
  const ctx = document.getElementById("dashChart");
  if (!ctx) return;
  const pontos = averageCargasPorTreino();
  const labels = pontos.map((p) => formatDateBR(p.data).slice(0, 5));
  const valores = pontos.map((p) => p.media);

  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Carga média (kg)",
          data: valores,
          borderColor: "#3d7a5f",
          backgroundColor: "rgba(61, 122, 95, 0.12)",
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: false, ticks: { color: "#6b7570" }, grid: { color: "#eef0ee" } },
        x: { ticks: { color: "#6b7570" }, grid: { display: false } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => `${c.parsed.y} kg` } },
      },
    },
  });
}

function renderRecent(data) {
  const list = document.getElementById("dashRecent");
  list.innerHTML = "";
  const recentes = [...data.treinos]
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 5);

  if (!recentes.length) {
    list.innerHTML = `<li class="list-group-item text-body-secondary">Nenhum treino registrado ainda.</li>`;
    return;
  }

  for (const treino of recentes) {
    const ficha = data.fichas.find((f) => f.id === treino.fichaId);
    const cargas = treino.itens.map((i) => i.carga);
    const media = cargas.length
      ? (cargas.reduce((s, c) => s + c, 0) / cargas.length).toFixed(1)
      : "—";
    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between align-items-center";
    li.innerHTML = `
      <div>
        <div class="fw-medium">${ficha ? escapeHtml(ficha.nome) : "Ficha removida"}</div>
        <small class="text-body-secondary">${treino.itens.length} exercícios · ${formatDateBR(treino.data)}</small>
      </div>
      <span class="badge badge-grupo">${media} kg</span>`;
    list.appendChild(li);
  }
}
