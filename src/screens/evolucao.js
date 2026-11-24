import { getData } from "../storage.js";
import { showToast, formatDateBR } from "../utils.js";

let chart = null;
let selectedExercicioNome = null;

export function initEvolucao() {
  document.getElementById("selectExercicioEvo").addEventListener("change", (e) => {
    selectedExercicioNome = e.target.value || null;
    renderEvolucao();
  });
  document.getElementById("compareModal").addEventListener("show.bs.modal", handleCompareModal);
}

export function renderEvolucao() {
  const { treinos } = getData();
  const nomes = [...new Set(treinos.flatMap((t) => t.itens.map((i) => i.exercicioNome)))].sort();

  const select = document.getElementById("selectExercicioEvo");
  const atual = selectedExercicioNome && nomes.includes(selectedExercicioNome)
    ? selectedExercicioNome
    : nomes[0] || null;
  selectedExercicioNome = atual;

  select.innerHTML = '<option value="">Selecione um exercício...</option>';
  for (const nome of nomes) {
    const opt = document.createElement("option");
    opt.value = nome;
    opt.textContent = nome;
    select.appendChild(opt);
  }
  if (atual) select.value = atual;

  renderEvolucaoContent();
}

function getRegistros(nome) {
  if (!nome) return [];
  const { treinos } = getData();
  const registros = [];
  for (const t of treinos) {
    for (const item of t.itens) {
      if (item.exercicioNome === nome) {
        registros.push({ data: t.data, carga: item.carga, repeticoes: item.repeticoes });
      }
    }
  }
  return registros.sort((a, b) => a.data.localeCompare(b.data));
}

function renderEvolucaoContent() {
  const registros = getRegistros(selectedExercicioNome);

  /* Gráfico */
  const chartBody = document.getElementById("evoChart")?.parentElement
    ?? document.querySelector("[data-chart-body]");
  if (chart) {
    chart.destroy();
    chart = null;
  }
  if (!registros.length) {
    chartBody.innerHTML =
      `<div class="text-center text-body-secondary py-5" data-chart-placeholder>
         <i class="bi bi-graph-up-arrow fs-1 d-block mb-2"></i>
         Nenhum registro para este exercício ainda.
       </div>`;
  } else if (!document.getElementById("evoChart")) {
    chartBody.innerHTML = '<canvas id="evoChart" height="240"></canvas>';
  }
  const canvas = document.getElementById("evoChart");
  if (registros.length && canvas) {
    chart = new Chart(canvas, {
      type: "line",
      data: {
        labels: registros.map((r) => formatDateBR(r.data).slice(0, 5)),
        datasets: [
          {
            label: "Carga (kg)",
            data: registros.map((r) => r.carga),
            borderColor: "#3d7a5f",
            backgroundColor: "rgba(61, 122, 95, 0.12)",
            fill: true,
            tension: 0.3,
            pointRadius: 4,
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

  /* Maior carga */
  const maxEl = document.getElementById("evoMaxCarga");
  const maxDataEl = document.getElementById("evoMaxCargaData");
  if (registros.length) {
    const max = registros.reduce((a, b) => (b.carga > a.carga ? b : a));
    maxEl.textContent = `${max.carga} kg`;
    maxDataEl.textContent = `Registrada em ${formatDateBR(max.data)}`;
  } else {
    maxEl.textContent = "—";
    maxDataEl.textContent = "Sem registros ainda.";
  }

  /* Tabela */
  const tbody = document.getElementById("evoRegistrosBody");
  tbody.innerHTML = "";
  if (!registros.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-body-secondary py-4">Nenhum registro encontrado.</td></tr>`;
    return;
  }
  const ordenados = [...registros].reverse();
  for (const r of ordenados) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDateBR(r.data)}</td>
      <td class="fw-semibold">${r.carga} kg</td>
      <td>${r.repeticoes}</td>
      <td><button class="btn btn-sm btn-outline-success" data-action="compare">Comparar</button></td>`;
    tr.querySelector('[data-action="compare"]').addEventListener("click", () => openCompare(r));
    tbody.appendChild(tr);
  }
}

/* ---------- Comparação ---------- */

function openCompare(registro) {
  const modalEl = document.getElementById("compareModal");
  modalEl.dataset.compareData = registro.data;
  modalEl.dataset.compareCarga = String(registro.carga);
  bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function handleCompareModal(event) {
  const modalEl = event.target;
  const dataA = modalEl.dataset.compareData;
  const cargaA = Number(modalEl.dataset.compareCarga);
  if (!dataA || !Number.isFinite(cargaA)) return;

  const registros = getRegistros(selectedExercicioNome).filter((r) => r.data !== dataA);
  const body = document.getElementById("compareModalBody");

  if (!registros.length) {
    body.innerHTML = `<p class="text-body-secondary mb-0">Não há outros registros para comparar com ${formatDateBR(dataA)}.</p>`;
    return;
  }

  const selectId = "compareSelectData";
  body.innerHTML = `
    <p class="mb-2">Comparar o registro de <strong>${formatDateBR(dataA)}</strong> (${cargaA} kg) com:</p>
    <select class="form-select" id="${selectId}">
      ${registros.map((r) => `<option value="${r.data}|${r.carga}">${formatDateBR(r.data)} — ${r.carga} kg</option>`).join("")}
    </select>
    <div class="mt-3" id="compareResult"></div>`;

  const update = () => {
    const [dataB, cargaB] = document.getElementById(selectId).value.split("|");
    const diff = cargaA - Number(cargaB);
    const pct = ((diff / Number(cargaB)) * 100).toFixed(1);
    const sinal = diff > 0 ? "+" : "";
    const cor = diff > 0 ? "text-success" : diff < 0 ? "text-danger" : "text-body-secondary";
    document.getElementById("compareResult").innerHTML = `
      <div class="alert alert-light border mb-0">
        <div class="d-flex justify-content-between"><span>${formatDateBR(dataA)}</span><span class="fw-semibold">${cargaA} kg</span></div>
        <div class="d-flex justify-content-between"><span>${formatDateBR(dataB)}</span><span class="fw-semibold">${cargaB} kg</span></div>
        <hr class="my-2">
        <div class="text-center ${cor} fw-semibold fs-5">${sinal}${diff} kg (${sinal}${pct}%)</div>
      </div>`;
  };

  document.getElementById(selectId).addEventListener("change", update);
  update();
}
