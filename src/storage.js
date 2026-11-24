const STORAGE_KEY = "fittrack_data_v1";
const DEMO_FLAG = "fittrack_demo_seeded";

export const GRUPOS_MUSCULARES = [
  "Peito",
  "Costas",
  "Pernas",
  "Ombros",
  "Bíceps",
  "Tríceps",
  "Abdômen",
  "Panturrilha",
];

function emptyData() {
  return { fichas: [], treinos: [] };
}

function readData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.fichas) || !Array.isArray(parsed.treinos)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function getData() {
  return readData() ?? emptyData();
}

export function saveData(data) {
  writeData(data);
}

export function resetData() {
  writeData(emptyData());
  localStorage.removeItem(DEMO_FLAG);
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function seedDemoData() {
  if (localStorage.getItem(DEMO_FLAG) || readData()) return;

  const data = {
    fichas: [
      {
        id: uid(),
        nome: "Ficha A",
        descricao: "Peito, ombros e tríceps",
        exercicios: [
          { id: uid(), nome: "Supino reto", grupo: "Peito", series: 4, repeticoes: 10 },
          { id: uid(), nome: "Desenvolvimento halteres", grupo: "Ombros", series: 3, repeticoes: 12 },
          { id: uid(), nome: "Tríceps na polia", grupo: "Tríceps", series: 3, repeticoes: 12 },
        ],
      },
      {
        id: uid(),
        nome: "Ficha B",
        descricao: "Costas e bíceps",
        exercicios: [
          { id: uid(), nome: "Puxada frontal", grupo: "Costas", series: 4, repeticoes: 10 },
          { id: uid(), nome: "Remada curvada", grupo: "Costas", series: 3, repeticoes: 10 },
          { id: uid(), nome: "Rosca direta", grupo: "Bíceps", series: 3, repeticoes: 12 },
        ],
      },
      {
        id: uid(),
        nome: "Ficha C",
        descricao: "Pernas e abdômen",
        exercicios: [
          { id: uid(), nome: "Agachamento livre", grupo: "Pernas", series: 4, repeticoes: 8 },
          { id: uid(), nome: "Leg press", grupo: "Pernas", series: 4, repeticoes: 12 },
          { id: uid(), nome: "Elevação de panturrilha", grupo: "Panturrilha", series: 3, repeticoes: 15 },
        ],
      },
    ],
    treinos: [],
  };

  const [fichaA, fichaB, fichaC] = data.fichas;
  const plan = [
    { ficha: fichaA, dia: 21, registros: { "Supino reto": [40, 42.5, 45], "Desenvolvimento halteres": [16, 16, 18], "Tríceps na polia": [25, 27.5, 30] } },
    { ficha: fichaB, dia: 18, registros: { "Puxada frontal": [45, 45, 50], "Remada curvada": [40, 42.5, 45], "Rosca direta": [15, 15, 17.5] } },
    { ficha: fichaC, dia: 15, registros: { "Agachamento livre": [60, 62.5, 65], "Leg press": [120, 130, 140], "Elevação de panturrilha": [40, 40, 45] } },
    { ficha: fichaA, dia: 12, registros: { "Supino reto": [42.5, 45, 45], "Desenvolvimento halteres": [18, 18, 18], "Tríceps na polia": [27.5, 30, 30] } },
    { ficha: fichaB, dia: 9, registros: { "Puxada frontal": [50, 50, 52.5], "Remada curvada": [42.5, 45, 45], "Rosca direta": [17.5, 17.5, 20] } },
    { ficha: fichaC, dia: 6, registros: { "Agachamento livre": [65, 65, 70], "Leg press": [130, 140, 150], "Elevação de panturrilha": [45, 45, 45] } },
    { ficha: fichaA, dia: 3, registros: { "Supino reto": [45, 47.5, 50], "Desenvolvimento halteres": [18, 20, 20], "Tríceps na polia": [30, 30, 32.5] } },
    { ficha: fichaB, dia: 1, registros: { "Puxada frontal": [52.5, 52.5, 55], "Remada curvada": [45, 47.5, 47.5], "Rosca direta": [20, 20, 22.5] } },
  ];

  for (const { ficha, dia, registros } of plan) {
    const itens = ficha.exercicios
      .filter((ex) => registros[ex.nome])
      .map((ex) => {
        const [carga, reps] = registros[ex.nome];
        return {
          exercicioId: ex.id,
          exercicioNome: ex.nome,
          carga,
          repeticoes: ex.repeticoes,
        };
      });
    if (itens.length) {
      data.treinos.push({ id: uid(), fichaId: ficha.id, data: daysAgo(dia), itens });
    }
  }

  writeData(data);
  localStorage.setItem(DEMO_FLAG, "1");
}
