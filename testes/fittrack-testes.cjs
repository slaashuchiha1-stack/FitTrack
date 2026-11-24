// Roteiro de testes funcionais do FitTrack (Playwright + Chromium).
// Uso: node fittrack-testes.cjs <pasta-do-projeto>
// Como o ambiente de teste não tem acesso às CDNs, Bootstrap e Chart.js são substituídos por versões
// simplificadas ("stubs"): o roteiro valida a LÓGICA (dados, validações, navegação, DOM gerado),
// não a aparência nem o desenho real dos gráficos.
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright"); // npm install --save-dev playwright && npx playwright install chromium
const root = process.argv[2];
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

const results = [];
let currentGroup = "";
const group = (name) => { currentGroup = name; console.log(`\n## ${name}`); };
const check = (desc, cond, detail = "") => {
  results.push({ group: currentGroup, desc, pass: !!cond });
  console.log(`${cond ? "PASS" : "FAIL"}  ${desc}${detail !== "" ? "  -> " + detail : ""}`);
};

const srv = http.createServer((req, res) => {
  let p = req.url.split("?")[0]; if (p === "/") p = "/index.html";
  const f = path.join(root, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": mime[path.extname(f)] || "text/plain" });
  res.end(fs.readFileSync(f));
});

const BS_STUB = `
window.__toasts = [];
window.bootstrap = {
  Modal: { getOrCreateInstance(el) {
    if (!el.__m) el.__m = {
      show() { el.dispatchEvent(new Event('show.bs.modal')); el.dataset.shown = '1'; },
      hide() { el.dataset.shown = '0'; setTimeout(() => el.dispatchEvent(new Event('hidden.bs.modal')), 0); }
    };
    return el.__m;
  } },
  Toast: class { constructor(el) { this.el = el; } show() { window.__toasts.push({ text: this.el.textContent.trim(), cls: this.el.className }); } }
};`;
const CHART_STUB = `window.__charts = []; window.Chart = class { constructor(c, cfg) { this.cfg = cfg; this.canvas = c; window.__charts.push({ id: c.id, cfg }); } destroy() {} };`;

srv.listen(0, async () => {
  const port = srv.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  await page.route("**/*", (r) => {
    const u = r.request().url();
    if (u.includes("bootstrap.bundle")) return r.fulfill({ contentType: "text/javascript", body: BS_STUB });
    if (u.includes("chart.umd")) return r.fulfill({ contentType: "text/javascript", body: CHART_STUB });
    if (u.startsWith("http://localhost") || u.startsWith("http://127.0.0.1")) return r.continue();
    return r.fulfill({ status: 200, contentType: "text/css", body: "" });
  });
  const url = `http://localhost:${port}/`;

  // ---------- utilitários ----------
  const fresh = async (state) => {
    await page.goto(url);
    await page.evaluate((s) => { localStorage.clear(); if (s) localStorage.setItem("fittrack_data_v1", JSON.stringify(s)); }, state || null);
    await page.reload();
    await page.waitForFunction(() => document.getElementById("pageTitle").textContent === "Dashboard");
  };
  const click = (sel, i = 0) => page.evaluate(([s, i]) => document.querySelectorAll(s)[i].click(), [sel, i]);
  const nav = (screen) => click(`.sidebar-nav .nav-link[data-screen=${screen}]`);
  const val = (sel, v) => page.evaluate(([s, v]) => { const el = document.querySelector(s); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }, [sel, v]);
  const data = () => page.evaluate(() => JSON.parse(localStorage.getItem("fittrack_data_v1")));
  const lastToast = () => page.evaluate(() => (window.__toasts.slice(-1)[0] || {}).text || "");
  const count = (sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel);
  const text = (sel) => page.evaluate((s) => document.querySelector(s).textContent.replace(/\s+/g, " ").trim(), sel);
  const settle = () => page.waitForTimeout(60);
  const confirmYes = async () => { await click("#btnConfirmDelete"); await settle(); };
  const confirmNo = async () => { await page.evaluate(() => document.getElementById("confirmModal").dispatchEvent(new Event("hidden.bs.modal"))); await settle(); };

  /* 1 */ group("1. Primeira abertura: dados de demonstração e Dashboard");
  await fresh();
  let d = await data();
  check("3 fichas de demonstração gravadas", d.fichas.length === 3, d.fichas.map((f) => f.nome).join(", "));
  check("8 treinos de demonstração gravados", d.treinos.length === 8);
  check("indicador de fichas mostra 3", (await text("#statFichas")) === "3");
  check("lista de atividades recentes tem 5 itens", (await count("#dashRecent li")) === 5);
  const dashChart = await page.evaluate(() => window.__charts.filter((c) => c.id === "dashChart").slice(-1)[0].cfg.data);
  check("gráfico do painel tem 8 pontos (um por treino)", dashChart.datasets[0].data.length === 8, JSON.stringify(dashChart.datasets[0].data));
  const expLast = await page.evaluate(() => { const t = JSON.parse(localStorage.fittrack_data_v1).treinos.sort((a, b) => b.data.localeCompare(a.data))[0]; const m = t.itens.reduce((s, i) => s + i.carga, 0) / t.itens.length; const [y, mo, dd] = t.data.split("-"); return { data: `${dd}/${mo}/${y}`, media: m.toFixed(1) }; });
  check("último treino exibido corretamente", (await text("#statUltimoTreino")) === expLast.data, expLast.data);
  check("carga média do treino mais recente = soma/nº de exercícios", (await text("#dashRecent li:first-child .badge")) === `${expLast.media} kg`, expLast.media + " kg");
  check("saudação segue o padrão 'Bom dia/Boa tarde/Boa noite! ...'", /^(Bom dia|Boa tarde|Boa noite)! Pronto para treinar\?$/.test(await text("#dashGreeting")), await text("#dashGreeting"));

  /* 2 */ group("2. Navegação entre as quatro telas");
  const titles = { dashboard: "Dashboard", fichas: "Minhas fichas", treino: "Executar treino", evolucao: "Minha evolução" };
  for (const s of ["fichas", "treino", "evolucao", "dashboard"]) {
    await nav(s);
    const active = await page.evaluate(() => document.querySelector(".screen.active").id);
    check(`tela ${s}: título e tela ativa corretos`, (await text("#pageTitle")) === titles[s] && active === `screen-${s}`, `${await text("#pageTitle")} / ${active}`);
  }
  await click('[data-goto="treino"]');
  check("botão do Dashboard leva à tela Executar treino", (await text("#pageTitle")) === "Executar treino");

  /* 3 */ group("3. Fichas: criar, validar nome vazio e escapar HTML");
  await fresh(); await nav("fichas");
  check("3 cartões de ficha exibidos", (await count(".ficha-card")) === 3);
  await click("#btnNovaFicha"); await val("#inputNomeFicha", "Ficha D"); await val("#textareaDescFicha", "Teste"); await click("#btnSalvarFicha");
  check("ficha válida criada (4 cartões)", (await count(".ficha-card")) === 4 && (await data()).fichas.some((f) => f.nome === "Ficha D"));
  check("mensagem 'Ficha criada.'", (await lastToast()) === "Ficha criada.");
  await click("#btnNovaFicha"); await val("#inputNomeFicha", "   "); await click("#btnSalvarFicha");
  check("nome em branco é recusado (continuam 4 fichas)", (await count(".ficha-card")) === 4 && (await data()).fichas.length === 4);
  check("campo marcado como inválido", await page.evaluate(() => document.getElementById("inputNomeFicha").validity.customError));
  check("HTML limita o nome da ficha a 50 e a descrição a 200 caracteres", await page.evaluate(() => document.getElementById("inputNomeFicha").maxLength === 50 && document.getElementById("textareaDescFicha").maxLength === 200));
  await click("#btnNovaFicha"); await val("#inputNomeFicha", "<img src=x onerror=window.__xss=1>"); await click("#btnSalvarFicha"); await settle();
  check("texto com HTML é exibido como texto (sem injeção)", (await page.evaluate(() => !window.__xss && document.querySelectorAll("#fichasList img").length === 0 && document.getElementById("fichasList").textContent.includes("<img src=x"))));

  /* 4 */ group("4. Exercícios: adicionar, validar, reordenar e editar");
  await fresh(); await nav("fichas");
  const nEx0 = (await data()).fichas[0].exercicios.length;
  const fillEx = async (nome, grupo, series, reps) => { await val("#inputNomeExercicio", nome); await val("#selectGrupoExercicio", grupo); await val("#inputSeriesExercicio", series); await val("#inputRepsExercicio", reps); };
  await click('[data-action="add-exercicio"]', 0); await fillEx("Crucifixo", "Peito", "3", "12"); await click("#btnSalvarExercicio");
  check("exercício válido adicionado à ficha", (await data()).fichas[0].exercicios.length === nEx0 + 1 && (await lastToast()) === "Exercício adicionado.");
  check("grupo muscular tem 8 opções", (await page.evaluate(() => [...document.querySelectorAll("#selectGrupoExercicio option")].map((o) => o.value).filter(Boolean).join(","))) === "Peito,Costas,Pernas,Ombros,Bíceps,Tríceps,Abdômen,Panturrilha");
  const invalidos = [["", "Peito", "3", "12", "sem nome"], ["X", "", "3", "12", "sem grupo"], ["X", "Peito", "0", "12", "séries = 0"], ["X", "Peito", "21", "12", "séries = 21"], ["X", "Peito", "2.5", "12", "séries decimal"], ["X", "Peito", "3", "0", "repetições = 0"], ["X", "Peito", "3", "51", "repetições = 51"]];
  for (const [n, g, s, r, label] of invalidos) {
    await click('[data-action="add-exercicio"]', 0); await fillEx(n, g, s, r); await click("#btnSalvarExercicio");
    check(`exercício inválido recusado (${label})`, (await data()).fichas[0].exercicios.length === nEx0 + 1);
  }
  check("limite de 80 caracteres no nome do exercício e faixa 1–20 / 1–50 no HTML", await page.evaluate(() => document.getElementById("inputNomeExercicio").maxLength === 80 && document.getElementById("inputSeriesExercicio").max === "20" && document.getElementById("inputRepsExercicio").max === "50"));
  const ordemAntes = (await data()).fichas[0].exercicios.map((e) => e.nome);
  check("botão 'subir' do 1º exercício e 'descer' do último ficam desabilitados", await page.evaluate(() => { const it = document.querySelectorAll(".ficha-card")[0].querySelectorAll(".exercicio-item"); return it[0].querySelector('[data-action="move-up"]').disabled && it[it.length - 1].querySelector('[data-action="move-down"]').disabled; }));
  await page.evaluate(() => document.querySelectorAll(".ficha-card")[0].querySelectorAll('[data-action="move-down"]')[0].click());
  const ordemDepois = (await data()).fichas[0].exercicios.map((e) => e.nome);
  check("mover para baixo troca os dois primeiros exercícios", ordemDepois[0] === ordemAntes[1] && ordemDepois[1] === ordemAntes[0], ordemDepois.slice(0, 2).join(" / "));
  await page.evaluate(() => document.querySelectorAll(".ficha-card")[0].querySelectorAll('[data-action="edit-exercicio"]')[0].click());
  await val("#inputNomeExercicio", "Supino inclinado"); await click("#btnSalvarExercicio");
  check("editar exercício atualiza o nome", (await data()).fichas[0].exercicios[0].nome === "Supino inclinado" && (await lastToast()) === "Exercício atualizado.");

  /* 5 */ group("5. Exclusão com confirmação e preservação do histórico");
  await fresh(); await nav("fichas");
  const antes = await data();
  const fichaAlvo = antes.fichas[0];
  const treinosDaFicha = antes.treinos.filter((t) => t.fichaId === fichaAlvo.id).length;
  await click('[data-action="delete-ficha"]', 0); await settle(); await confirmNo();
  check("cancelar a confirmação NÃO exclui a ficha", (await data()).fichas.length === 3);
  await click('[data-action="delete-ficha"]', 0); await settle(); await confirmYes();
  const depois = await data();
  check("confirmar exclui a ficha (3 -> 2)", depois.fichas.length === 2 && !depois.fichas.some((f) => f.id === fichaAlvo.id));
  check("lista de treinos permanece idêntica (histórico preservado)", JSON.stringify(depois.treinos) === JSON.stringify(antes.treinos), `${depois.treinos.length} treinos`);
  await nav("dashboard");
  check("Dashboard mostra 'Ficha removida' nos treinos órfãos", (await page.evaluate(() => document.getElementById("dashRecent").textContent.includes("Ficha removida"))), `${treinosDaFicha} treinos da ficha excluída`);
  await nav("evolucao");
  const nomesEvo = await page.evaluate(() => [...document.querySelectorAll("#selectExercicioEvo option")].map((o) => o.value).filter(Boolean));
  check("Evolução continua listando os exercícios da ficha excluída", fichaAlvo.exercicios.every((e) => nomesEvo.includes(e.nome)), nomesEvo.length + " exercícios na lista");
  await nav("fichas");
  const exAntes = (await data()).fichas[0].exercicios.length;
  await click('[data-action="delete-exercicio"]', 0); await settle(); await confirmYes();
  const d2 = await data();
  check("excluir exercício remove da ficha, sem alterar os treinos", d2.fichas[0].exercicios.length === exAntes - 1 && JSON.stringify(d2.treinos) === JSON.stringify(antes.treinos));

  /* 6 */ group("6. Executar treino: gravação válida");
  await fresh(); await nav("treino");
  check("data já vem preenchida com hoje", await page.evaluate(() => { const n = new Date(); const iso = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`; return document.getElementById("inputDataTreino").value === iso; }));
  const ficha0 = (await data()).fichas[0];
  check("um cartão por exercício da ficha selecionada", (await count("[data-carga]")) === ficha0.exercicios.length);
  check("passo do campo de carga é 0,5 e a sugestão de repetições é o valor planejado", await page.evaluate(() => { const c = document.querySelector("[data-carga]"), r = document.querySelector("[data-reps]"); return c.step === "0.5" && r.placeholder !== ""; }));
  const [e1, e2, e3] = ficha0.exercicios;
  await val(`[data-carga="${e1.id}"]`, "50");                                  // reps vazias -> usa planejado
  await val(`[data-carga="${e2.id}"]`, "18"); await val(`[data-reps="${e2.id}"]`, "8");
  await click("#btnSalvarTreino");
  const d3 = await data(); const novo = d3.treinos[d3.treinos.length - 1];
  check("treino gravado (8 -> 9)", d3.treinos.length === 9 && novo.fichaId === ficha0.id);
  check("somente os 2 exercícios preenchidos viram itens", novo.itens.length === 2, novo.itens.map((i) => i.exercicioNome).join(", "));
  check("repetições vazias assumem o valor planejado", novo.itens[0].repeticoes === e1.repeticoes && novo.itens[0].carga === 50, `${novo.itens[0].repeticoes} reps`);
  check("item guarda nome do exercício (snapshot)", novo.itens[0].exercicioNome === e1.nome);
  check("mensagem de sucesso e campos limpos", /^Treino da Ficha A salvo \(\d{2}\/\d{2}\/\d{4}\)\.$/.test(await lastToast()) && (await page.evaluate(() => [...document.querySelectorAll("[data-carga]")].every((i) => i.value === ""))), await lastToast());

  /* 7 */ group("7. Executar treino: entradas inválidas (nenhum treino pode ser gravado)");
  await fresh(); await nav("treino");
  const f0 = (await data()).fichas[0]; const x1 = f0.exercicios[0];
  const tryIt = async (label, setup, esperado) => {
    await nav("treino");
    await val("#inputDataTreino", new Date().toISOString().slice(0, 10));
    await page.evaluate(() => document.querySelectorAll("[data-carga],[data-reps]").forEach((i) => (i.value = "")));
    await setup();
    await click("#btnSalvarTreino");
    const t = await lastToast();
    check(`${label}`, (await data()).treinos.length === 8 && t.includes(esperado), t);
  };
  await tryIt("nada preenchido", async () => {}, "Preencha pelo menos um exercício");
  await tryIt("data vazia", async () => { await val("#inputDataTreino", ""); await val(`[data-carga="${x1.id}"]`, "40"); }, "Informe uma data válida");
  await tryIt("data inexistente (31/02)", async () => { await val("#inputDataTreino", "2026-02-31"); await val(`[data-carga="${x1.id}"]`, "40"); }, "Informe uma data válida");
  await tryIt("carga igual a zero", async () => { await val(`[data-carga="${x1.id}"]`, "0"); }, `Informe uma carga válida para "${x1.nome}"`);
  await tryIt("carga negativa", async () => { await val(`[data-carga="${x1.id}"]`, "-5"); }, "Informe uma carga válida");
  await tryIt("repetições sem carga", async () => { await val(`[data-reps="${x1.id}"]`, "10"); }, "Informe uma carga válida");
  await tryIt("repetições acima de 100", async () => { await val(`[data-carga="${x1.id}"]`, "40"); await val(`[data-reps="${x1.id}"]`, "101"); }, "Informe repetições válidas");
  await tryIt("repetições decimais", async () => { await val(`[data-carga="${x1.id}"]`, "40"); await val(`[data-reps="${x1.id}"]`, "2.5"); }, "Informe repetições válidas");
  await nav("treino"); await val("#selectFichaTreino", ""); await click("#btnSalvarTreino");
  check("sem ficha selecionada", (await data()).treinos.length === 8 && (await lastToast()).includes("Selecione uma ficha"), await lastToast());

  /* 8 */ group("8. Minha evolução: gráfico, maior carga, tabela e comparação");
  await fresh(); await nav("evolucao");
  const nomes = await page.evaluate(() => [...document.querySelectorAll("#selectExercicioEvo option")].map((o) => o.value).filter(Boolean));
  check("lista de exercícios vem dos treinos e está em ordem alfabética", nomes.length === 9 && JSON.stringify(nomes) === JSON.stringify([...nomes].sort()), nomes.join(" | "));
  check("primeiro exercício já vem selecionado", (await page.evaluate(() => document.getElementById("selectExercicioEvo").value)) === nomes[0], nomes[0]);
  const expEvo = await page.evaluate((n) => { const d = JSON.parse(localStorage.fittrack_data_v1); const r = []; d.treinos.forEach((t) => t.itens.forEach((i) => i.exercicioNome === n && r.push({ data: t.data, carga: i.carga }))); r.sort((a, b) => a.data.localeCompare(b.data)); return r; }, nomes[0]);
  const evoChart = await page.evaluate(() => window.__charts.filter((c) => c.id === "evoChart").slice(-1)[0].cfg.data.datasets[0].data);
  check("gráfico usa as cargas do exercício em ordem cronológica", JSON.stringify(evoChart) === JSON.stringify(expEvo.map((r) => r.carga)), JSON.stringify(evoChart));
  check("maior carga exibida", (await text("#evoMaxCarga")) === `${Math.max(...expEvo.map((r) => r.carga))} kg`, await text("#evoMaxCarga"));
  const linhas = await page.evaluate(() => [...document.querySelectorAll("#evoRegistrosBody tr")].map((tr) => tr.children[0].textContent));
  const isoToBR = (s) => s.split("-").reverse().join("/");
  check("tabela lista do mais recente para o mais antigo", JSON.stringify(linhas) === JSON.stringify([...expEvo].reverse().map((r) => isoToBR(r.data))), linhas.join(", "));
  // comparação: linha mais recente (A) x registro mais antigo (B)
  await page.evaluate(() => document.querySelectorAll('#evoRegistrosBody [data-action="compare"]')[0].click()); await settle();
  const A = expEvo[expEvo.length - 1], B = expEvo[0];
  const diff = A.carga - B.carga, pct = ((diff / B.carga) * 100).toFixed(1);
  const res = await text("#compareResult");
  check("comparação mostra diferença em kg e em % (ponto decimal)", res.includes(`+${diff} kg (+${pct}%)`), res);
  check("aumento aparece em verde (text-success)", await page.evaluate(() => !!document.querySelector("#compareResult .text-success")));
  await page.evaluate(() => document.querySelectorAll('#evoRegistrosBody [data-action="compare"]')[1].click()); await settle();
  const res2 = await text("#compareResult");
  check("comparação inversa mostra queda em vermelho", res2.includes(`${-diff} kg (${(((-diff) / A.carga) * 100).toFixed(1)}%)`) && (await page.evaluate(() => !!document.querySelector("#compareResult .text-danger"))), res2);
  await fresh({ fichas: [{ id: "f1", nome: "Única", descricao: "", exercicios: [{ id: "e1", nome: "Supino", grupo: "Peito", series: 3, repeticoes: 10 }] }], treinos: [{ id: "t1", fichaId: "f1", data: "2026-11-01", itens: [{ exercicioId: "e1", exercicioNome: "Supino", carga: 40, repeticoes: 10 }] }] });
  await nav("evolucao"); await page.evaluate(() => document.querySelector('#evoRegistrosBody [data-action="compare"]').click()); await settle();
  check("com um único registro a janela avisa que não há o que comparar", (await text("#compareModalBody")).includes("Não há outros registros para comparar"), await text("#compareModalBody"));

  /* 9 */ group("9. Estados vazios (nenhum dado cadastrado)");
  await fresh({ fichas: [], treinos: [] });
  check("Dashboard: indicadores zerados e aviso", (await text("#statFichas")) === "0" && (await text("#statTreinosMes")) === "0" && (await text("#statUltimoTreino")) === "—" && (await text("#dashRecent")).includes("Nenhum treino registrado ainda"));
  await nav("fichas"); check("Fichas: mensagem de lista vazia", (await text("#fichasList")).includes("Nenhuma ficha cadastrada"));
  await nav("treino"); check("Treino: pede para selecionar ficha", (await text("#treinoExercicios")).includes("Selecione uma ficha"));
  await nav("evolucao");
  check("Evolução: mensagem no gráfico, '—' na maior carga e aviso na tabela", (await text("#evoMaxCarga")) === "—" && (await text("#evoRegistrosBody")).includes("Nenhum registro encontrado") && (await page.evaluate(() => !!document.querySelector("[data-chart-placeholder]"))));

  /* 10 */ group("10. Persistência e erros de JavaScript");
  await fresh(); await nav("fichas"); await click("#btnNovaFicha"); await val("#inputNomeFicha", "Persistente"); await click("#btnSalvarFicha");
  await page.reload(); await nav("fichas");
  check("dados continuam após recarregar a página", (await text("#fichasList")).includes("Persistente"));
  check("nenhum erro de JavaScript no console durante todo o roteiro", errors.length === 0, errors.join(" | ") || "nenhum");

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n=== RESUMO: ${passed}/${results.length} verificações aprovadas ===`);
  const byGroup = {};
  results.forEach((r) => { (byGroup[r.group] ||= { p: 0, t: 0 }); byGroup[r.group].t++; if (r.pass) byGroup[r.group].p++; });
  Object.entries(byGroup).forEach(([g, v]) => console.log(`${v.p === v.t ? "OK  " : "FALHA"} ${g}: ${v.p}/${v.t}`));
  await browser.close(); srv.close();
  process.exit(passed === results.length ? 0 : 1);
});
