import { seedDemoData } from "./storage.js";
import { formatDateBR, showToast, todayISO } from "./utils.js";
import { initFichas, renderFichas } from "./screens/fichas.js";
import { initTreino, renderTreino } from "./screens/treino.js";
import { initEvolucao, renderEvolucao } from "./screens/evolucao.js";
import { renderDashboard } from "./screens/dashboard.js";

const PAGE_TITLES = {
  dashboard: "Dashboard",
  fichas: "Minhas fichas",
  treino: "Executar treino",
  evolucao: "Minha evolução",
};

const RENDERERS = {
  dashboard: renderDashboard,
  fichas: renderFichas,
  treino: renderTreino,
  evolucao: renderEvolucao,
};

let currentScreen = "dashboard";

function navigate(screen) {
  if (!PAGE_TITLES[screen]) return;
  currentScreen = screen;

  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(`screen-${screen}`).classList.add("active");

  document.querySelectorAll(".sidebar-nav .nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.screen === screen);
  });

  document.getElementById("pageTitle").textContent = PAGE_TITLES[screen];
  closeSidebar();
  RENDERERS[screen]();
}

function setupSidebar() {
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebarBackdrop");
  document.getElementById("btnSidebar").addEventListener("click", () => {
    sidebar.classList.add("open");
    backdrop.classList.add("show");
  });
  backdrop.addEventListener("click", closeSidebar);
}

function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarBackdrop").classList.remove("show");
}

function init() {
  seedDemoData();

  document.getElementById("todayDate").textContent = formatDateBR(todayISO());

  document.querySelectorAll(".sidebar-nav .nav-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(link.dataset.screen);
    });
  });

  document.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.dataset.goto));
  });

  setupSidebar();
  initFichas();
  initTreino();
  initEvolucao();

  navigate("dashboard");
}

document.addEventListener("DOMContentLoaded", init);
