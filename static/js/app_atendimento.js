// ================= CONFIG =================
const API_BASE = window.location.origin;

// ================= ESTABELECIMENTO (nome dinâmico) =================
(function syncNomeEstab() {
  const ja = localStorage.getItem("nomeEstabelecimento");
  if (ja && ja.trim()) return;

  const n =
    localStorage.getItem("estabelecimento_nome") ||
    localStorage.getItem("nome_estabelecimento") ||
    localStorage.getItem("estab_nome");

  if (n && n.trim()) localStorage.setItem("nomeEstabelecimento", n.trim());
})();

function renderEstabNome(nome) {
  const finalNome =
    (nome ||
      localStorage.getItem("nomeEstabelecimento") ||
      localStorage.getItem("estabelecimento_nome") ||
      "—"
    ).trim();

  const el = document.getElementById("nomeEstabelecimento");
  const header = document.getElementById("estabHeader");

  if (el) el.textContent = finalNome;
  if (header) header.title = `Estabelecimento: ${finalNome}`;
}

// ================= ELEMENTOS UI =================
const sidebar = document.getElementById("sidebar");
const backdrop = document.getElementById("backdrop");
const menuBtn = document.getElementById("menuBtn");

const totalFilaEl = document.getElementById("totalFila");
const atendendoAgoraEl = document.getElementById("atendendoAgora");
const proxNomeEl = document.getElementById("proxNome");
const proxPosEl = document.getElementById("proxPosicao");
const proxBadgeEl = document.getElementById("proxBadge");
const tempoMedioEl = document.getElementById("tempoMedio");

const btnChamar = document.getElementById("btnChamar");
const btnFinalizar = document.getElementById("btnFinalizar");
const btnCancelar = document.getElementById("btnCancelar");
const btnPular = document.getElementById("btnPular");

const callModal = document.getElementById("callModal");
const callNome = document.getElementById("callNome");
const callPosicao = document.getElementById("callPosicao");

const finishOverlay = document.getElementById("finishOverlay");
const finishMsg = document.getElementById("finishMsg");
const finishSub = document.getElementById("finishSub");
const finishTip = document.getElementById("finishTip");
const finishOkBtn = document.getElementById("finishOkBtn");

const confirmModal = document.getElementById("confirmModal");
const confirmSub = document.getElementById("confirmSub");
const confirmClient = document.getElementById("confirmClient");
const confirmSim = document.getElementById("confirmSim");
const confirmNao = document.getElementById("confirmNao");

const filaSelect = document.getElementById("filaSelect");
const filaInfo = document.getElementById("filaInfo");

// ================= SIDEBAR (mobile) =================
function openSidebar() {
  if (!sidebar || !backdrop) return;
  sidebar.classList.add("open");
  backdrop.classList.add("show");
}
function closeSidebar() {
  if (!sidebar || !backdrop) return;
  sidebar.classList.remove("open");
  backdrop.classList.remove("show");
}
menuBtn?.addEventListener("click", openSidebar);
backdrop?.addEventListener("click", closeSidebar);

// ================= HELPERS =================
function pad3(n) { return String(n).padStart(3, "0"); }

function setButtons({ canChamar=false, canFinalizar=false, canCancelar=false, canPular=false }) {
  if (btnChamar) btnChamar.disabled = !canChamar;
  if (btnFinalizar) btnFinalizar.disabled = !canFinalizar;
  if (btnCancelar) btnCancelar.disabled = !canCancelar;
  if (btnPular) btnPular.disabled = !canPular;
}

// ✅ trava anti “cliquei 2x”
let opRunning = false;
function setOpRunning(v) {
  opRunning = !!v;
  if (v) {
    if (btnChamar) btnChamar.disabled = true;
    if (btnFinalizar) btnFinalizar.disabled = true;
    if (btnCancelar) btnCancelar.disabled = true;
    if (btnPular) btnPular.disabled = true;
  }
}

// ✅ Modal pequeno ("Chamando cliente")
function showCallModalCliente({ nome="—", posicao=1, titulo="Chamando cliente", ms=1800 }) {
  return new Promise((resolve) => {
    if (!callModal || !callNome || !callPosicao) return resolve();

    callNome.textContent = nome;
    callPosicao.textContent = `${titulo} • Posição #${pad3(posicao || 1)}`;

    callModal.classList.add("show");

    setTimeout(() => {
      callModal.classList.remove("show");
      resolve();
    }, ms);
  });
}

// ✅ Overlay grande (finalizado/cancelado)
function openFinishOverlay({ mode="finalizado", nome="Cliente" } = {}) {
  if (!finishOverlay) return;

  if (mode === "cancelado") {
    if (finishMsg) finishMsg.textContent = "Atendimento cancelado!";
    if (finishSub) finishSub.textContent = `${nome} não compareceu e foi removido da fila.`;
    if (finishTip) finishTip.textContent = "Você pode chamar o próximo cliente.";
  } else {
    if (finishMsg) finishMsg.textContent = "Atendimento finalizado!";
    if (finishSub) finishSub.textContent = `${nome} atendido com sucesso.`;
    if (finishTip) finishTip.textContent = "Você pode chamar o próximo cliente.";
  }

  finishOverlay.classList.add("show");
  finishOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("lock");
}

function closeFinishOverlay() {
  if (!finishOverlay) return;
  finishOverlay.classList.remove("show");
  finishOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("lock");
}

finishOkBtn?.addEventListener("click", closeFinishOverlay);
finishOverlay?.addEventListener("click", (e) => {
  if (e.target === finishOverlay) closeFinishOverlay();
});

// ✅ Modal compareceu? (Promise) — ESC/clicar fora = NÃO
function askCompareceu({ nome="Cliente", posicao=1 } = {}) {
  return new Promise((resolve) => {
    if (!confirmModal) return resolve(true);

    if (confirmSub) confirmSub.textContent = "O cliente chegou ao estabelecimento?";
    if (confirmClient) confirmClient.textContent = `${nome} • Posição #${pad3(posicao || 1)}`;

    confirmModal.classList.add("show");
    confirmModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("lock");

    const overlay = confirmModal.querySelector(".confirm-overlay");

    const cleanup = (val) => {
      confirmModal.classList.remove("show");
      confirmModal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("lock");

      confirmSim?.removeEventListener("click", onSim);
      confirmNao?.removeEventListener("click", onNao);
      overlay?.removeEventListener("click", onOverlay);
      window.removeEventListener("keydown", onKey);

      resolve(val);
    };

    const onSim = () => cleanup(true);
    const onNao = () => cleanup(false);
    const onOverlay = () => cleanup(false);
    const onKey = (ev) => { if (ev.key === "Escape") cleanup(false); };

    confirmSim?.addEventListener("click", onSim);
    confirmNao?.addEventListener("click", onNao);
    overlay?.addEventListener("click", onOverlay);
    window.addEventListener("keydown", onKey);

    setTimeout(() => confirmSim?.focus?.(), 0);
  });
}

// ================= FETCH =================
async function getJSON(path) {
  const res = await fetch(API_BASE + path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Erro HTTP ${res.status}`);
  return data;
}

async function postJSON(path, body = {}) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Erro HTTP ${res.status}`);
  return data;
}

// ================= AUTH / ESTAB =================
const estabId = Number(localStorage.getItem("estabelecimento_id") || 0);
const estabNomeLS = (localStorage.getItem("estabelecimento_nome") || "").trim();

if (!estabId) {
  alert("Você precisa estar logado como estabelecimento.");
  window.location.replace("/templates/LoginCnpj.html");
  throw new Error("Sem estabelecimento_id");
}

// ================= FILA SELECIONADA =================
const FILA_SELECIONADA_KEY = "filaSelecionadaId";
let filaIdAtual = Number(localStorage.getItem(FILA_SELECIONADA_KEY) || 0);

// caches
let atualCache = null; // { fila_cliente_id, nome }
let proxCache = null;  // { fila_cliente_id, nome, posicao }

// ================= CONTROLE ANTI-RACE =================
let pendingResult = null; // "finalizado" | "cancelado" | null
let pendingUntil = 0;

function setPending(mode) {
  pendingResult = mode;
  pendingUntil = Date.now() + 2500;
}
function clearPending() {
  pendingResult = null;
  pendingUntil = 0;
}
function canAcceptWsMode(mode) {
  if (!pendingResult) return true;
  if (Date.now() > pendingUntil) {
    clearPending();
    return true;
  }
  return mode === pendingResult;
}

// ================= WEBSOCKET =================
let ws = null;
let wsRetryTimer = null;
let wsPingTimer = null; // ✅ NOVO: ping pro servidor não fechar

function wsUrlForFila(filaId) {
  const proto = (location.protocol === "https:") ? "wss" : "ws";
  return `${proto}://${location.host}/ws/fila/${filaId}`;
}

function stopWS() {
  try { ws?.close(); } catch {}
  ws = null;
  clearTimeout(wsRetryTimer);
  clearInterval(wsPingTimer);
  wsPingTimer = null;
}

function startWS(filaId) {
  stopWS();
  if (!filaId) return;

  ws = new WebSocket(wsUrlForFila(filaId));

  // ✅ IMPORTANTÍSSIMO: seu backend espera receive_text() — então precisa mandar ping
  ws.onopen = () => {
    clearInterval(wsPingTimer);
    wsPingTimer = setInterval(() => {
      try {
        if (ws?.readyState === WebSocket.OPEN) ws.send("ping");
      } catch {}
    }, 25000);
  };

    ws.onmessage = async (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg?.type !== "fila_update") return;

      const action = (msg.action || "").toUpperCase();
      const p = msg.payload || {};
      const nome = p.nome || atualCache?.nome || "Cliente";

      // ✅✅✅ CLIENTE SAIU POR CONTA PRÓPRIA:
      // Só atualiza posições/contadores — NUNCA abre modal.
      if (action === "CLIENTE_SAIU") {
        await refreshAtendimento();
        return;
      }

      // ✅ atendimento finalizado (funcionário)
      if (action === "ATENDIMENTO_FINALIZADO" || action === "FINALIZOU") {
        if (canAcceptWsMode("finalizado")) {
          openFinishOverlay({ mode: "finalizado", nome });
          clearPending();
        }
        await refreshAtendimento();
        return;
      }

      // ✅ cancelamento do atendimento (funcionário)
      if (action === "CANCELOU" || action === "ATENDIMENTO_CANCELADO") {
        if (canAcceptWsMode("cancelado")) {
          openFinishOverlay({ mode: "cancelado", nome });
          clearPending();
        }
        await refreshAtendimento();
        return;
      }

      // outros eventos: só atualiza
      await refreshAtendimento();
    } catch {
      // ignore
    }
  };

  ws.onclose = () => {
    clearInterval(wsPingTimer);
    clearTimeout(wsRetryTimer);
    wsRetryTimer = setTimeout(() => startWS(filaId), 2500);
  };
}

// ================= API: STATUS ATENDIMENTO =================
async function refreshAtendimento() {
  try {
    if (!filaIdAtual) {
      if (totalFilaEl) totalFilaEl.textContent = "0";
      if (atendendoAgoraEl) atendendoAgoraEl.textContent = "Selecione uma fila";
      if (proxNomeEl) proxNomeEl.textContent = "—";
      if (proxPosEl) proxPosEl.textContent = "—";
      if (proxBadgeEl) proxBadgeEl.textContent = "—";
      if (filaInfo) filaInfo.textContent = "";
      atualCache = null;
      proxCache = null;
      setButtons({});
      return;
    }

    const data = await getJSON(`/api/filas/${filaIdAtual}/atendimento/status`);

    if (filaInfo) {
      const statusTxt = (data.fila_status || "").toUpperCase() === "ABERTA" ? "Ativa" : "Inativa";
      filaInfo.textContent = `${statusTxt} • ID: ${data.fila_id}`;
    }

    if (totalFilaEl) totalFilaEl.textContent = String(data.aguardando_total ?? 0);
    if (tempoMedioEl) tempoMedioEl.textContent = String(data.tempo_medio_min ?? 15);

    const atual = data.atual || null;
    atualCache = atual;

    if (atual) {
      if (atendendoAgoraEl) atendendoAgoraEl.textContent = atual.nome || "—";
    } else {
      if (atendendoAgoraEl) atendendoAgoraEl.textContent = "Nenhum cliente sendo atendido";
    }

    const prox = data.proximo || null;
    proxCache = prox;

    if (prox) {
      if (proxNomeEl) proxNomeEl.textContent = prox.nome || "—";
      if (proxPosEl) proxPosEl.textContent = `Posição #${pad3(prox.posicao || 1)}`;
      if (proxBadgeEl) proxBadgeEl.textContent = "Aguardando";
    } else {
      if (proxNomeEl) proxNomeEl.textContent = "—";
      if (proxPosEl) proxPosEl.textContent = "Sem próximo";
      if (proxBadgeEl) proxBadgeEl.textContent = "—";
    }

    const temAtual = !!atual;
    const temProx = !!prox;

    setButtons({
      canChamar: !temAtual && temProx,
      canFinalizar: temAtual,
      canCancelar: temAtual,
      canPular: !temAtual && (data.aguardando_total ?? 0) > 1,
    });

    if (btnChamar) btnChamar.title = temAtual ? "Finalize/cancele antes de chamar outro" : "";
  } catch (e) {
    console.log("refreshAtendimento erro:", e);
  } finally {
    setOpRunning(false);
  }
}

// ================= CARREGAR FILAS =================
async function carregarFilas() {
  const filas = await getJSON(`/api/filas?estabelecimento_id=${estabId}`);

  if (!filaSelect) return;

  filaSelect.innerHTML = "";

  if (!Array.isArray(filas) || !filas.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Nenhuma fila criada";
    filaSelect.appendChild(opt);

    filaIdAtual = 0;
    localStorage.removeItem(FILA_SELECIONADA_KEY);
    await refreshAtendimento();
    stopWS();
    return;
  }

  filas.sort((a, b) => {
    const aa = (a.status === "ABERTA") ? 0 : 1;
    const bb = (b.status === "ABERTA") ? 0 : 1;
    if (aa !== bb) return aa - bb;
    return (b.idFila || b.id || 0) - (a.idFila || a.id || 0);
  });

  for (const f of filas) {
    const id = Number(f.idFila || f.id || 0);
    const nome = (f.nome || `Fila #${id}`).trim();
    const ativa = (f.status || "").toUpperCase() === "ABERTA";

    const opt = document.createElement("option");
    opt.value = String(id);
    opt.textContent = ativa ? nome : `${nome} (inativa)`;
    filaSelect.appendChild(opt);
  }

  const existe = filas.some(f => Number(f.idFila || f.id) === Number(filaIdAtual));
  filaIdAtual = existe ? Number(filaIdAtual) : Number(filas[0].idFila || filas[0].id);

  filaSelect.value = String(filaIdAtual);
  localStorage.setItem(FILA_SELECIONADA_KEY, String(filaIdAtual));

  startWS(filaIdAtual);
  await refreshAtendimento();
}

filaSelect?.addEventListener("change", async () => {
  filaIdAtual = Number(filaSelect.value || 0);
  localStorage.setItem(FILA_SELECIONADA_KEY, String(filaIdAtual || ""));
  startWS(filaIdAtual);
  await refreshAtendimento();
});

// ================= AÇÕES =================
btnChamar?.addEventListener("click", async () => {
  if (!filaIdAtual || opRunning) return;

  try {
    setOpRunning(true);

    const r = await postJSON(`/api/filas/${filaIdAtual}/atendimento/chamar`);

    const nome = r?.cliente?.nome || proxCache?.nome || "Cliente";
    const pos = r?.cliente?.posicao || 1;

    await showCallModalCliente({ nome, posicao: pos, titulo: "Chamando cliente", ms: 1800 });

    await refreshAtendimento();

    const compareceu = await askCompareceu({ nome, posicao: pos });

    if (!compareceu) {
      setPending("cancelado");
      await postJSON(`/api/filas/${filaIdAtual}/atendimento/cancelar`);
      openFinishOverlay({ mode: "cancelado", nome });
      await refreshAtendimento();
      return;
    }

    // ✅ compareceu: garante sincronismo
    await refreshAtendimento();

  } catch (e) {
    alert(e.message || "Erro ao chamar");
  } finally {
    setOpRunning(false);
  }
});

btnFinalizar?.addEventListener("click", async () => {
  if (!filaIdAtual || opRunning) return;

  try {
    setOpRunning(true);

    const nome = atualCache?.nome || "Cliente";
    setPending("finalizado");

    await postJSON(`/api/filas/${filaIdAtual}/atendimento/finalizar`);
    openFinishOverlay({ mode: "finalizado", nome });

    await refreshAtendimento();
  } catch (e) {
    clearPending();
    alert(e.message || "Erro ao finalizar");
  } finally {
    setOpRunning(false);
  }
});

btnCancelar?.addEventListener("click", async () => {
  if (!filaIdAtual || opRunning) return;

  try {
    setOpRunning(true);

    const nome = atualCache?.nome || "Cliente";
    setPending("cancelado");

    await postJSON(`/api/filas/${filaIdAtual}/atendimento/cancelar`);
    openFinishOverlay({ mode: "cancelado", nome });

    await refreshAtendimento();
  } catch (e) {
    clearPending();
    alert(e.message || "Erro ao cancelar");
  } finally {
    setOpRunning(false);
  }
});

btnPular?.addEventListener("click", async () => {
  if (!filaIdAtual || opRunning) return;

  try {
    setOpRunning(true);
    await postJSON(`/api/filas/${filaIdAtual}/atendimento/pular`);
    await refreshAtendimento();
  } catch (e) {
    alert(e.message || "Erro ao pular");
  } finally {
    setOpRunning(false);
  }
});

// ================= INIT =================
(async () => {
  renderEstabNome(estabNomeLS);

  try {
    const est = await getJSON(`/api/estabelecimentos/${estabId}`);
    if (est?.nome) {
      localStorage.setItem("estabelecimento_nome", est.nome);
      localStorage.setItem("nomeEstabelecimento", est.nome);
      renderEstabNome(est.nome);
    }
  } catch {}

  await carregarFilas();

  // ✅ fallback: atualiza sozinho mesmo se WS falhar
  setInterval(() => {
    if (!filaIdAtual) return;
    refreshAtendimento().catch(()=>{});
  }, 4000);
})();