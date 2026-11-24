import { getData, saveData, uid } from "../storage.js";
import { showToast, isValidISODate, todayISO, formatDateBR, escapeHtml } from "../utils.js";

let selectedFichaId = null;

export function initTreino() {
  document.getElementById("selectFichaTreino").addEventListener("change", (e) => {
    selectedFichaId = e.target.value || null;
    renderTreinoExercicios();
  });
  document.getElementById("btnSalvarTreino").addEventListener("click", salvarTreino);
}

export function renderTreino() {
  const { fichas } = getData();
  const select = document.getElementById("selectFichaTreino");

  select.innerHTML = '<option value="">Selecione uma ficha...</option>';
  for (const f of fichas) {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = f.nome;
    select.appendChild(opt);
  }

  if (selectedFichaId && fichas.some((f) => f.id === selectedFichaId)) {
    select.value = selectedFichaId;
  } else {
    selectedFichaId = fichas.length ? fichas[0].id : null;
    if (selectedFichaId) select.value = selectedFichaId;
  }

  const dataInput = document.getElementById("inputDataTreino");
  if (!dataInput.value) dataInput.value = todayISO();

  renderTreinoExercicios();
}

function renderTreinoExercicios() {
  const container = document.getElementById("treinoExercicios");
  container.innerHTML = "";

  if (!selectedFichaId) {
    container.innerHTML = `
      <div class="col-12">
        <div class="card"><div class="card-body text-center text-body-secondary py-5">
          <i class="bi bi-dumbbell fs-1 d-block mb-2"></i>
          Selecione uma ficha para registrar o treino.
        </div></div>
      </div>`;
    return;
  }

  const { fichas } = getData();
  const ficha = fichas.find((f) => f.id === selectedFichaId);
  if (!ficha || !ficha.exercicios.length) {
    container.innerHTML = `
      <div class="col-12">
        <div class="card"><div class="card-body text-center text-body-secondary py-5">
          Esta ficha não possui exercícios cadastrados.
        </div></div>
      </div>`;
    return;
  }

  ficha.exercicios.forEach((ex) => {
    container.appendChild(renderExercicioForm(ex));
  });
}

function renderExercicioForm(ex) {
  const col = document.createElement("div");
  col.className = "col-12 col-md-6";
  col.innerHTML = `
    <div class="card h-100">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div>
            <span class="fw-semibold">${escapeHtml(ex.nome)}</span>
            <span class="badge badge-grupo ms-2">${escapeHtml(ex.grupo)}</span>
          </div>
          <small class="text-body-secondary">${ex.series} séries</small>
        </div>
        <div class="row g-2">
          <div class="col-6">
            <label class="form-label small mb-1">Carga (kg)</label>
            <input type="number" class="form-control" step="0.5" min="0"
              data-carga="${ex.id}" placeholder="0" />
          </div>
          <div class="col-6">
            <label class="form-label small mb-1">Repetições</label>
            <input type="number" class="form-control" min="1"
              data-reps="${ex.id}" placeholder="${ex.repeticoes}" />
          </div>
        </div>
        <small class="text-body-secondary">Planejado: ${ex.series} × ${ex.repeticoes}</small>
      </div>
    </div>`;
  return col;
}

function salvarTreino() {
  const dataStr = document.getElementById("inputDataTreino").value;
  if (!isValidISODate(dataStr)) {
    showToast("Informe uma data válida para o treino.", "danger");
    return;
  }

  const { fichas, treinos } = getData();
  const ficha = fichas.find((f) => f.id === selectedFichaId);
  if (!ficha) {
    showToast("Selecione uma ficha para salvar o treino.", "danger");
    return;
  }

  const itens = [];
  for (const ex of ficha.exercicios) {
    const cargaRaw = document.querySelector(`[data-carga="${ex.id}"]`).value;
    const repsRaw = document.querySelector(`[data-reps="${ex.id}"]`).value;
    if (cargaRaw === "" && repsRaw === "") continue; // exercício não realizado

    const carga = Number(cargaRaw);
    const repeticoes = repsRaw === "" ? ex.repeticoes : Number(repsRaw);
    if (!Number.isFinite(carga) || carga <= 0) {
      showToast(`Informe uma carga válida para "${ex.nome}".`, "danger");
      return;
    }
    if (!Number.isInteger(repeticoes) || repeticoes < 1 || repeticoes > 100) {
      showToast(`Informe repetições válidas para "${ex.nome}".`, "danger");
      return;
    }
    itens.push({ exercicioId: ex.id, exercicioNome: ex.nome, carga, repeticoes });
  }

  if (!itens.length) {
    showToast("Preencha pelo menos um exercício para salvar o treino.", "danger");
    return;
  }

  treinos.push({ id: uid(), fichaId: ficha.id, data: dataStr, itens });
  saveData({ fichas, treinos });
  showToast(`Treino da ${ficha.nome} salvo (${formatDateBR(dataStr)}).`);
  renderTreinoExercicios();
}
