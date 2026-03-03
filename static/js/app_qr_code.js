/* =========================================================
   app_qr_code.js — COMPLETO, ATUALIZADO E CORRIGIDO
   ✅ Remove duplicações do nome do estabelecimento
   ✅ Corrige erro de sintaxe (tinha um "+" perdido)
   ✅ Imprimir SEM popup/SEM about:blank (print area no próprio DOM)
   ✅ Mantém copiar/baixar/abrir link e lista de filas
========================================================= */

console.log("[QR] app_qr_code.js carregou");

// ===============================
// ESTABELECIMENTO (nome dinâmico)
// ===============================
(function syncNomeEstab() {
  const ja = localStorage.getItem("nomeEstabelecimento");
  if (ja && ja.trim()) return;

  const n = localStorage.getItem("estabelecimento_nome");
  if (n && n.trim()) localStorage.setItem("nomeEstabelecimento", n.trim());
})();

function obterNomeEstabelecimento() {
  const nome =
    localStorage.getItem("nomeEstabelecimento") ||
    localStorage.getItem("estabelecimento_nome") ||
    localStorage.getItem("nome_estabelecimento") ||
    localStorage.getItem("estab_nome");

  return nome && nome.trim() ? nome.trim() : null;
}

function preencherNomeNoTopo() {
  const nome = obterNomeEstabelecimento();
  const el = document.getElementById("nomeEstabelecimento");
  const header = document.getElementById("estabHeader");

  if (el) el.textContent = nome || "—";
  if (header) header.title = `Estabelecimento: ${nome || "—"}`;
}

// ✅ evita quebrar HTML se nome/link tiver caracteres especiais
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ================= BASES =================
const ORIGIN = window.location.origin;
const API_BASE = ORIGIN; // /api/...
const LOCAL_TEMPLATES_BASE = ORIGIN + "/templates/"; // se precisar abrir páginas localmente

// ✅ Vai ser preenchido com o NGROK salvo no backend (se existir)
let PUBLIC_ORIGIN = "";

// ================= ELEMENTOS (preenchidos no DOMContentLoaded) =================
let sidebar, backdrop, menuBtn;

let filaList, filaNomeTop, filaLink, btnOpenLink;

let qrBox, btnBaixar, btnCopiar, btnImprimir, toast;

// ================= ESTADO =================
let filas = [];
let filaSelecionada = null;
let linkSelecionado = "";

// ================= HELPERS =================
function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1500);
}

function clearQr() {
  if (!qrBox) return;
  qrBox.innerHTML = "";
}

function renderQr(text) {
  if (typeof QRCode === "undefined") {
    showToast("Erro: QRCode não carregou. Verifique /static/js/qrcodegen.js");
    return;
  }

  clearQr();
  new QRCode(qrBox, {
    text,
    width: 230,
    height: 230,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H,
  });
}

function normalizarFila(item) {
  const id =
    item.id ??
    item.idFila ??
    item.id_fila ??
    item.idFilaDigital ??
    item.idFilaINT ??
    item.idFilaPk;

  return {
    ...item,
    __id: id,
    nome:
      item.nome ||
      item.nome_fila ||
      item.fila_nome ||
      (id ? `Fila #${id}` : "Fila"),
    status: item.status || item.status_fila,
    ativa: item.ativa ?? (String(item.status || "").toUpperCase() === "ABERTA"),
  };
}

// ================= ✅ Pega NGROK salvo no backend =================
async function carregarPublicUrl() {
  try {
    const res = await fetch(`${API_BASE}/api/public-url`, { cache: "no-store" });
    if (!res.ok) return;

    const data = await res.json().catch(() => null);
    const url = (data?.public_url || "").trim().replace(/\/+$/, "");

    if (url.startsWith("http://") || url.startsWith("https://")) {
      PUBLIC_ORIGIN = url;
    }
  } catch {
    // se falhar, segue com origin local mesmo
  }
}

// ================= LINK PARA CLIENTE (QR) =================
function gerarLinkCliente(filaId) {
  const base = (PUBLIC_ORIGIN || ORIGIN).replace(/\/+$/, "");

  // ✅ login dentro de /templates
  const url = new URL(`${base}/templates/login.html`);

  // ✅ next também com /templates (pra não dar 404)
  url.searchParams.set("next", "/templates/Fila_cliente.html");

  // ✅ id da fila
  url.searchParams.set("filaId", String(filaId));

  return url.toString();
}

// ================= LISTA DE FILAS =================
function renderLista() {
  if (!filaList) return;

  if (!filas.length) {
    filaList.innerHTML = `<p style="opacity:.6">Nenhuma fila encontrada.</p>`;
    return;
  }

  filaList.innerHTML = filas
    .map((f) => {
      const id = f.__id;
      const nome = f.nome || `Fila #${id}`;
      const statusRaw = f.status || (f.ativa ? "ABERTA" : "FECHADA");
      const status = String(statusRaw || "").toUpperCase();
      const isOpen = status === "ABERTA" || f.ativa === true;

      const isSelected = String(id) === String(filaSelecionada?.__id);

      return `
        <div class="queue-card ${isSelected ? "" : "inactive"}" data-id="${String(
        id
      )}">
          <div>
            <div class="queue-title">${escapeHtml(nome)}</div>
            <div class="queue-sub">Status: ${escapeHtml(status || "-")}</div>
          </div>
          <span class="badge">${isOpen ? "Aberta" : "Fechada"}</span>
        </div>
      `;
    })
    .join("");

  filaList.querySelectorAll(".queue-card").forEach((card) => {
    card.addEventListener("click", () => {
      const id = String(card.dataset.id || "");
      const f = filas.find((x) => String(x.__id) === id);
      if (!f) return;

      filaSelecionada = f;
      renderTudo();
    });
  });
}

// ================= RENDER PRINCIPAL =================
function renderTudo() {
  renderLista();

  if (!filaSelecionada) return;

  const id = filaSelecionada.__id;
  const nome = filaSelecionada.nome || `Fila #${id}`;

  linkSelecionado = gerarLinkCliente(id);

  if (filaNomeTop) filaNomeTop.textContent = nome;

  if (filaLink) {
    filaLink.textContent = linkSelecionado;
    filaLink.href = linkSelecionado;
  }

  renderQr(linkSelecionado);
}

// ================= AÇÕES =================
function abrirLink() {
  if (!linkSelecionado) return;
  window.open(linkSelecionado, "_blank", "noopener");
}

async function copiarLink() {
  if (!linkSelecionado) return;

  try {
    await navigator.clipboard.writeText(linkSelecionado);
    showToast("Link copiado!");
  } catch {
    const temp = document.createElement("textarea");
    temp.value = linkSelecionado;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand("copy");
    temp.remove();
    showToast("Link copiado!");
  }
}

function baixarQr() {
  const img = qrBox?.querySelector("img");
  const canvas = qrBox?.querySelector("canvas");

  let dataUrl = "";
  if (canvas) dataUrl = canvas.toDataURL("image/png");
  else if (img) dataUrl = img.src;

  if (!dataUrl) return showToast("Erro ao baixar.");

  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `QR_Fila_${filaSelecionada?.__id || "fila"}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  showToast("Baixado!");
}

/* =========================================================
   ✅ IMPRIMIR DEFINITIVO (SEM POPUP / SEM about:blank)
   - Cria uma área temporária no DOM
   - Usa @media print pra imprimir só o QR + nome + link
========================================================= */
function imprimirQr() {
  const img = qrBox?.querySelector("img");
  const canvas = qrBox?.querySelector("canvas");

  let dataUrl = "";
  if (canvas) dataUrl = canvas.toDataURL("image/png");
  else if (img) dataUrl = img.src;

  if (!dataUrl) return showToast("Erro ao imprimir.");

  const nome = filaSelecionada?.nome || `Fila #${filaSelecionada?.__id || ""}`;
  const link = linkSelecionado || "";

  // remove restos de prints anteriores
  document.getElementById("print-area")?.remove();
  document.getElementById("print-style")?.remove();

  // cria área de impressão no DOM (mesma aba)
  const printArea = document.createElement("div");
  printArea.id = "print-area";
  printArea.innerHTML = `
    <div style="
      min-height:100vh;
      display:grid;
      place-items:center;
      font-family:Arial, sans-serif;
      text-align:center;
      background:#fff;
      color:#000;
      padding:24px;
      box-sizing:border-box;
    ">
      <div style="max-width:90vw">
        <h2 style="margin:0 0 16px">${escapeHtml(nome)}</h2>
        <img id="print-qr-img" src="${dataUrl}" alt="QR Code" style="width:300px;height:300px" />
        <p style="margin:16px 0 0; word-break:break-all; font-size:12px; opacity:.9">
          ${escapeHtml(link)}
        </p>
      </div>
    </div>
  `;
  document.body.appendChild(printArea);

  // CSS para imprimir SÓ o print-area
  const style = document.createElement("style");
  style.id = "print-style";
  style.textContent = `
    @media print {
      body * { visibility: hidden !important; }
      #print-area, #print-area * { visibility: visible !important; }
      #print-area { position: fixed; inset: 0; }
    }
  `;
  document.head.appendChild(style);

  // quando terminar de imprimir, limpa tudo
  const cleanup = () => {
    document.getElementById("print-area")?.remove();
    document.getElementById("print-style")?.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);

  // força render antes do print (isso é o “pulo do gato”)
  void printArea.offsetHeight;

  // imprime na mesma aba (SEM about:blank)
  window.print();
}

// ================= CARREGAR FILAS =================
async function carregarFilas() {
  try {
    const estabIdRaw = localStorage.getItem("estabelecimento_id");
    const estabId = Number(estabIdRaw);

    console.log("[QR] estabelecimento_id (raw):", estabIdRaw, "->", estabId);

    if (!Number.isFinite(estabId) || estabId <= 0) {
      if (filaList)
        filaList.innerHTML = `<p style="opacity:.6">Faça login para ver as filas.</p>`;
      clearQr();
      if (filaLink) {
        filaLink.textContent = "";
        filaLink.href = "#";
      }
      showToast("Faça login primeiro");
      return;
    }

    const url = `${API_BASE}/api/filas?estabelecimento_id=${encodeURIComponent(
      estabId
    )}`;
    console.log("[QR] GET:", url);

    const res = await fetch(url, { cache: "no-store" });

    const contentType = res.headers.get("content-type") || "";
    let data;

    if (contentType.includes("application/json")) {
      data = await res.json().catch(() => null);
    } else {
      const txt = await res.text().catch(() => "");
      data = txt;
    }

    console.log("[QR] status:", res.status, "data:", data);

    if (!res.ok) {
      throw new Error(
        data && data.detail
          ? data.detail
          : typeof data === "string" && data.trim()
          ? data
          : `HTTP ${res.status}`
      );
    }

    let lista = [];
    if (Array.isArray(data)) lista = data;
    else if (data && Array.isArray(data.filas)) lista = data.filas;
    else if (data && Array.isArray(data.data)) lista = data.data;
    else lista = [];

    filas = lista.map(normalizarFila);

    if (!filas.length) {
      if (filaList)
        filaList.innerHTML = `<p style="opacity:.6">Nenhuma fila encontrada para este estabelecimento.</p>`;
      clearQr();
      if (filaLink) {
        filaLink.textContent = "";
        filaLink.href = "#";
      }
      return;
    }

    filaSelecionada = filas.find((f) => f.ativa === true) || filas[0] || null;
    renderTudo();
  } catch (err) {
    console.error("Erro carregarFilas:", err);
    if (filaList)
      filaList.innerHTML = `<p style="opacity:.6">Erro ao carregar filas.</p>`;
    clearQr();
    if (filaLink) {
      filaLink.textContent = "";
      filaLink.href = "#";
    }
    showToast(err?.message || "Erro ao carregar filas");
  }
}

// ================= SIDEBAR MOBILE =================
function setupSidebar() {
  sidebar = document.getElementById("sidebar");
  backdrop = document.getElementById("backdrop");
  menuBtn = document.getElementById("menuBtn");

  function openSidebar() {
    sidebar?.classList.add("open");
    backdrop?.classList.add("show");
  }
  function closeSidebar() {
    sidebar?.classList.remove("open");
    backdrop?.classList.remove("show");
  }

  menuBtn?.addEventListener("click", openSidebar);
  backdrop?.addEventListener("click", closeSidebar);
}

// ================= INIT =================
document.addEventListener("DOMContentLoaded", async () => {
  preencherNomeNoTopo();

  // elementos
  filaList = document.getElementById("filaList");
  filaNomeTop = document.getElementById("filaNomeTop");
  filaLink = document.getElementById("filaLink");
  btnOpenLink = document.getElementById("btnOpenLink");

  qrBox = document.getElementById("qrBox");
  btnBaixar = document.getElementById("btnBaixar");
  btnCopiar = document.getElementById("btnCopiar");
  btnImprimir = document.getElementById("btnImprimir");
  toast = document.getElementById("toast");

  setupSidebar();

  // eventos
  btnOpenLink?.addEventListener("click", (e) => {
    e?.preventDefault?.();
    abrirLink();
  });

  btnCopiar?.addEventListener("click", (e) => {
    e?.preventDefault?.();
    copiarLink();
  });

  btnBaixar?.addEventListener("click", (e) => {
    e?.preventDefault?.();
    baixarQr();
  });

  btnImprimir?.addEventListener("click", (e) => {
    e?.preventDefault?.();
    imprimirQr();
  });

  // init
  await carregarPublicUrl();
  await carregarFilas();
});