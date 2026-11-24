import { getData, saveData, uid, GRUPOS_MUSCULARES } from "../storage.js";
import { showToast, confirmDialog, escapeHtml } from "../utils.js";

let fichaModal, exercicioModal;
let editingFichaId = null;
let editingExercicio = null; // { fichaId, exercicioId }
let exercicioMoveContext = null; // { fichaId, exercicioId, direcao }

export function initFichas() {
  fichaModal = bootstrap.Modal.getOrCreateInstance(document.getElementById("fichaModal"));
  exercicioModal = bootstrap.Modal.getOrCreateInstance(document.getElementById("exercicioModal"));

  document.getElementById("btnNovaFicha").addEventListener("click", () => openFichaModal());
  document.getElementById("btnSalvarFicha").addEventListener("click", salvarFicha);
  document.getElementById("btnSalvarExercicio").addEventListener("click", salvarExercicio);

  const grupoSelect = document.getElementById("selectGrupoExercicio");
  for (const g of GRUPOS_MUSCULARES) {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = g;
    grupoSelect.appendChild(opt);
  }
}

export function renderFichas() {
  const { fichas } = getData();
  const list = document.getElementById("fichasList");
  list.innerHTML = "";

  if (!fichas.length) {
    list.innerHTML = `
      <div class="col-12">
        <div class="card"><div class="card-body text-center text-body-secondary py-5">
          <i class="bi bi-journal-text fs-1 d-block mb-2"></i>
          Nenhuma ficha cadastrada. Crie sua primeira ficha para começar.
        </div></div>
      </div>`;
    return;
  }

  for (const ficha of fichas) {
    list.appendChild(renderFichaCard(ficha));
  }
}

function renderFichaCard(ficha) {
  const col = document.createElement("div");
  col.className = "col-12 col-lg-6";
  col.innerHTML = `
    <div class="card ficha-card h-100">
      <div class="card-header">
        <div>
          <span class="fw-semibold">${escapeHtml(ficha.nome)}</span>
          ${ficha.descricao ? `<small class="text-body-secondary d-block">${escapeHtml(ficha.descricao)}</small>` : ""}
        </div>
        <div class="d-flex gap-1">
          <button class="btn btn-sm btn-outline-secondary" data-action="edit-ficha" title="Editar ficha">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" data-action="delete-ficha" title="Excluir ficha">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
      <div class="card-body">
        <div data-exercicio-list></div>
        <button class="btn btn-sm btn-outline-success mt-2" data-action="add-exercicio">
          <i class="bi bi-plus-lg me-1"></i>Adicionar exercício
        </button>
      </div>
    </div>`;

  const listEl = col.querySelector("[data-exercicio-list]");
  if (!ficha.exercicios.length) {
    listEl.innerHTML = `<p class="text-body-secondary small mb-0">Nenhum exercício nesta ficha.</p>`;
  } else {
    ficha.exercicios.forEach((ex, index) => {
      listEl.appendChild(renderExercicioItem(ficha, ex, index));
    });
  }

  col.querySelector('[data-action="edit-ficha"]').addEventListener("click", () => openFichaModal(ficha));
  col.querySelector('[data-action="delete-ficha"]').addEventListener("click", () => excluirFicha(ficha));
  col.querySelector('[data-action="add-exercicio"]').addEventListener("click", () => openExercicioModal(ficha.id));
  return col;
}

function renderExercicioItem(ficha, ex, index) {
  const total = ficha.exercicios.length;
  const item = document.createElement("div");
  item.className = "exercicio-item";
  item.innerHTML = `
    <span class="exercicio-order">${index + 1}</span>
    <div class="flex-grow-1 min-w-0">
      <div class="fw-medium small">${escapeHtml(ex.nome)}</div>
      <small class="text-body-secondary">${ex.series} × ${ex.repeticoes}</small>
      <span class="badge badge-grupo ms-2">${escapeHtml(ex.grupo)}</span>
    </div>
    <div class="d-flex gap-1 align-items-center">
      <div class="btn-group btn-group-sm" role="group">
        <button class="btn btn-outline-secondary" data-action="move-up" ${index === 0 ? "disabled" : ""} title="Mover para cima">
          <i class="bi bi-arrow-up"></i>
        </button>
        <button class="btn btn-outline-secondary" data-action="move-down" ${index === total - 1 ? "disabled" : ""} title="Mover para baixo">
          <i class="bi bi-arrow-down"></i>
        </button>
      </div>
      <button class="btn btn-sm btn-outline-secondary" data-action="edit-exercicio" title="Editar exercício">
        <i class="bi bi-pencil"></i>
      </button>
      <button class="btn btn-sm btn-outline-danger" data-action="delete-exercicio" title="Excluir exercício">
        <i class="bi bi-trash"></i>
      </button>
    </div>`;

  item.querySelector('[data-action="edit-exercicio"]').addEventListener("click", () =>
    openExercicioModal(ficha.id, ex)
  );
  item.querySelector('[data-action="delete-exercicio"]').addEventListener("click", () =>
    excluirExercicio(ficha, ex)
  );
  item.querySelector('[data-action="move-up"]').addEventListener("click", () =>
    moverExercicio(ficha.id, ex.id, "up")
  );
  item.querySelector('[data-action="move-down"]').addEventListener("click", () =>
    moverExercicio(ficha.id, ex.id, "down")
  );
  return item;
}

/* ---------- Ficha ---------- */

function openFichaModal(ficha = null) {
  editingFichaId = ficha ? ficha.id : null;
  document.getElementById("fichaModalTitle").textContent = ficha ? "Editar ficha" : "Nova ficha";
  document.getElementById("inputNomeFicha").value = ficha ? ficha.nome : "";
  document.getElementById("textareaDescFicha").value = ficha ? ficha.descricao || "" : "";
  clearValidation("formFicha");
  fichaModal.show();
}

function salvarFicha() {
  const form = document.getElementById("formFicha");
  const nome = document.getElementById("inputNomeFicha").value.trim();
  const descricao = document.getElementById("textareaDescFicha").value.trim();

  if (!nome) {
    invalidate(form, ["inputNomeFicha"]);
    return;
  }
  const data = getData();
  if (editingFichaId) {
    const ficha = data.fichas.find((f) => f.id === editingFichaId);
    if (ficha) {
      ficha.nome = nome;
      ficha.descricao = descricao;
    }
    showToast("Ficha atualizada.");
  } else {
    data.fichas.push({ id: uid(), nome, descricao, exercicios: [] });
    showToast("Ficha criada.");
  }
  saveData(data);
  fichaModal.hide();
  renderFichas();
}

async function excluirFicha(ficha) {
  const ok = await confirmDialog(`Excluir a ficha "${ficha.nome}"? O histórico de treinos será preservado.`);
  if (!ok) return;
  const data = getData();
  data.fichas = data.fichas.filter((f) => f.id !== ficha.id);
  saveData(data);
  showToast("Ficha excluída.", "info");
  renderFichas();
}

/* ---------- Exercício ---------- */

function openExercicioModal(fichaId, exercicio = null) {
  editingExercicio = { fichaId, exercicioId: exercicio ? exercicio.id : null };
  document.getElementById("exercicioModalTitle").textContent = exercicio ? "Editar exercício" : "Novo exercício";
  document.getElementById("inputNomeExercicio").value = exercicio ? exercicio.nome : "";
  document.getElementById("selectGrupoExercicio").value = exercicio ? exercicio.grupo : "";
  document.getElementById("inputSeriesExercicio").value = exercicio ? exercicio.series : "";
  document.getElementById("inputRepsExercicio").value = exercicio ? exercicio.repeticoes : "";
  clearValidation("formExercicio");
  exercicioModal.show();
}

function salvarExercicio() {
  const nome = document.getElementById("inputNomeExercicio").value.trim();
  const grupo = document.getElementById("selectGrupoExercicio").value;
  const series = Number(document.getElementById("inputSeriesExercicio").value);
  const repeticoes = Number(document.getElementById("inputRepsExercicio").value);

  const invalid = [];
  if (!nome) invalid.push("inputNomeExercicio");
  if (!grupo) invalid.push("selectGrupoExercicio");
  if (!Number.isInteger(series) || series < 1 || series > 20) invalid.push("inputSeriesExercicio");
  if (!Number.isInteger(repeticoes) || repeticoes < 1 || repeticoes > 50) invalid.push("inputRepsExercicio");
  if (invalid.length) {
    invalidate(document.getElementById("formExercicio"), invalid);
    return;
  }

  const data = getData();
  const ficha = data.fichas.find((f) => f.id === editingExercicio.fichaId);
  if (!ficha) return;

  if (editingExercicio.exercicioId) {
    const ex = ficha.exercicios.find((e) => e.id === editingExercicio.exercicioId);
    if (ex) Object.assign(ex, { nome, grupo, series, repeticoes });
    showToast("Exercício atualizado.");
  } else {
    ficha.exercicios.push({ id: uid(), nome, grupo, series, repeticoes });
    showToast("Exercício adicionado.");
  }
  saveData(data);
  exercicioModal.hide();
  renderFichas();
}

async function excluirExercicio(ficha, ex) {
  const ok = await confirmDialog(`Remover o exercício "${ex.nome}" da ficha?`);
  if (!ok) return;
  const data = getData();
  const alvo = data.fichas.find((f) => f.id === ficha.id);
  if (alvo) alvo.exercicios = alvo.exercicios.filter((e) => e.id !== ex.id);
  saveData(data);
  showToast("Exercício removido.", "info");
  renderFichas();
}

function moverExercicio(fichaId, exercicioId, direcao) {
  const data = getData();
  const ficha = data.fichas.find((f) => f.id === fichaId);
  if (!ficha) return;
  const idx = ficha.exercicios.findIndex((e) => e.id === exercicioId);
  const novoIdx = direcao === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || novoIdx < 0 || novoIdx >= ficha.exercicios.length) return;
  [ficha.exercicios[idx], ficha.exercicios[novoIdx]] = [ficha.exercicios[novoIdx], ficha.exercicios[idx]];
  saveData(data);
  renderFichas();
}

/* ---------- Validação ---------- */

function invalidate(form, ids) {
  form.classList.add("was-validated");
  for (const id of ids) {
    document.getElementById(id).setCustomValidity("inválido");
    document.getElementById(id).reportValidity();
  }
}

function clearValidation(formId) {
  const form = document.getElementById(formId);
  form.classList.remove("was-validated");
  form.querySelectorAll(".form-control, .form-select").forEach((el) => el.setCustomValidity(""));
}
