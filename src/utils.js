export function formatDateBR(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function currentMonthISO() {
  return todayISO().slice(0, 7);
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function isValidISODate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;
}

const toastColors = {
  success: "text-bg-success",
  danger: "text-bg-danger",
  info: "text-bg-secondary",
};

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

export function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  const el = document.createElement("div");
  el.className = `toast align-items-center border-0 ${toastColors[type] || "text-bg-secondary"}`;
  el.setAttribute("role", "alert");
  el.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${escapeHtml(message)}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>`;
  container.appendChild(el);
  const toast = new bootstrap.Toast(el, { delay: 3000 });
  el.addEventListener("hidden.bs.toast", () => el.remove());
  toast.show();
}

export function confirmDialog(message) {
  return new Promise((resolve) => {
    const modalEl = document.getElementById("confirmModal");
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    const btn = document.getElementById("btnConfirmDelete");
    document.getElementById("confirmMessage").textContent = message;

    const onConfirm = () => {
      cleanup();
      modal.hide();
      resolve(true);
    };
    const onHidden = () => {
      cleanup();
      resolve(false);
    };
    function cleanup() {
      btn.removeEventListener("click", onConfirm);
      modalEl.removeEventListener("hidden.bs.modal", onHidden);
    }
    btn.addEventListener("click", onConfirm, { once: true });
    modalEl.addEventListener("hidden.bs.modal", onHidden, { once: true });
    modal.show();
  });
}
