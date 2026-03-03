// ================= CONFIG =================
const API_BASE = window.location.origin;

// ================= HELPERS =================
function getParam(name){
  return new URLSearchParams(location.search).get(name);
}

function fmt2(n){ return String(n).padStart(2,"0"); }
function horaAgora(){
  const d = new Date();
  return `${fmt2(d.getHours())}:${fmt2(d.getMinutes())}:${fmt2(d.getSeconds())}`;
}
function pad3(n){ return String(n).padStart(3,"0"); }

function showToast(msg){
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"), 1400);
}

function getFilaId(){
  return new URLSearchParams(location.search).get("filaId");
}

// ✅ Nome do cliente SEM conflito entre abas:
// prioridade: (fila+cliente) -> (fila) -> null
function getClienteNome(filaId){
  const cid =
    Number(sessionStorage.getItem(`cliente_session_${filaId}`) || 0) ||
    Number(localStorage.getItem(`cliente_session_${filaId}`) || 0) ||
    Number(getParam("clienteId") || 0);

  // 1) nome por FILA + CLIENTE
  if (filaId && cid) {
    const k = `cliente_nome_${filaId}_${cid}`;
    const n = sessionStorage.getItem(k) || localStorage.getItem(k);
    if (n && n.trim()) return n.trim();
  }

  // 2) nome por FILA (prioriza sessionStorage da aba)
  if (filaId) {
    const n2 = sessionStorage.getItem(`cliente_nome_${filaId}`) || localStorage.getItem(`cliente_nome_${filaId}`);
    if (n2 && n2.trim()) return n2.trim();
  }

  return "";
}

function setClienteNome(filaId, clienteId, nome){
  const n = (nome || "").trim();
  if (!filaId || !clienteId || !n) return;

  // grava por FILA+CLIENTE (não conflita)
  const k = `cliente_nome_${filaId}_${clienteId}`;
  try {
    localStorage.setItem(k, n);
    sessionStorage.setItem(k, n);
    // e também por FILA (pra telas que ainda usam só fila)
    sessionStorage.setItem(`cliente_nome_${filaId}`, n);
    localStorage.setItem(`cliente_nome_${filaId}`, n);
  } catch {}
}

function preencherNomeClienteNoTopo(){
  const el = document.getElementById("clienteNomeHeader");
  if (!el) return;
  el.textContent = getClienteNome(filaId) || "—";
}

document.addEventListener("DOMContentLoaded", preencherNomeClienteNoTopo);

// ❌ NÃO usar window.storage pra CLIENTE_NOME (isso causava sobrescrever entre abas)

// ================= GEO HELPERS =================
function haversineMeters(lat1, lon1, lat2, lon2){
  const R = 6371000;
  const toRad = (x) => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function formatDist(m){
  if (!isFinite(m)) return "--";
  if (m < 1000) return `${m.toFixed(0)} m`;
  return `${(m/1000).toFixed(2)} km`;
}

async function fetchFilaInfo(filaId){
  const res = await fetch(`${API_BASE}/api/fila/${filaId}/info`);
  if (!res.ok) throw new Error("Falha ao buscar info da fila");
  return res.json();
}

// ================= ELEMENTOS =================
const elPos = document.getElementById("posicao");
const elFrente = document.getElementById("aFrente");
const elTempoMedio = document.getElementById("tempoMedio");
const elEstimativa = document.getElementById("estimativa");

const elDist = document.getElementById("distancia");
const elCoordsStatus = document.getElementById("coordsStatus");
const elPillRaio = document.getElementById("pillRaio");

const elFilaNome = document.getElementById("filaNome");
const elFilaRaio = document.getElementById("filaRaio");
const elUlt = document.getElementById("ultimaAtualizacao");

const btnGeo = document.getElementById("btnGeo");
const btnAtualizar = document.getElementById("btnAtualizar");
const btnSair = document.getElementById("btnSair");

// ================= Estado =================
const filaId = getFilaId();
if (!filaId){
  alert("Link inválido: falta filaId. Acesse pela leitura do QR Code.");
  window.location.replace(`${window.location.origin}/templates/saiu.html`);
  throw new Error("Sem filaId");
}

const SESSION_KEY = `cliente_session_${filaId}`;

// ✅ sessão por aba (sessionStorage) + fallback localStorage
let clienteId =
  Number(sessionStorage.getItem(SESSION_KEY) || 0) ||
  Number(localStorage.getItem(SESSION_KEY) || 0);

let filaClienteIdAtual =
  Number(localStorage.getItem(`fila_cliente_id_${filaId}`) || 0);

let atendimentoEncerrado = false;
let filaInfoCache = null;

let encerramentoModo = null;
let ultimoStatusConhecido = null;

// ================= MODAL PADRONIZADO =================
function ensureEndModal() {
  if (!document.getElementById("endModalStyle")) {
    const style = document.createElement("style");
    style.id = "endModalStyle";
    style.innerHTML = `
      body.lock{overflow:hidden}
      .final-modal{position:fixed; inset:0; display:none; z-index:99999; align-items:center; justify-content:center; padding:16px;}
      .final-modal.show{display:flex}
      .final-overlay{position:absolute; inset:0; background:rgba(0,0,0,.75); backdrop-filter: blur(6px);}
      .final-card{position:relative; z-index:2; width:min(560px, 92vw); border-radius:18px; border:1px solid rgba(255,122,0,.25);
        background:linear-gradient(180deg, rgba(255,122,0,.14), rgba(0,0,0,.30)); box-shadow:0 30px 90px rgba(0,0,0,.85);
        padding:28px 26px; text-align:center; color:#fff; animation:pop .22s ease;}
      @keyframes pop{from{opacity:0; transform:scale(.95)} to{opacity:1; transform:scale(1)}}
      .final-title{font-weight:900; font-size:26px; margin:0 0 10px;}
      .final-sub{opacity:.9; margin:0 0 16px; font-size:14px; line-height:1.45}
      .final-pill{display:inline-flex; align-items:center; gap:10px; padding:10px 14px; border-radius:999px; border:1px solid rgba(255,255,255,.12);
        background:rgba(0,0,0,.18); font-weight:800; margin:10px 0 18px;}
      .final-actions{display:flex; justify-content:center; gap:12px; flex-wrap:wrap}
      .final-btn{border-radius:14px; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.06); color:#fff; padding:12px 16px;
        font-weight:900; cursor:pointer; min-width:220px;}
      .final-btn.primary{background:#ff7a00; color:#0b0c0e; border-color:rgba(255,122,0,.55); box-shadow:0 14px 30px rgba(255,122,0,.18);}
    `;
    document.head.appendChild(style);
  }

  let modal = document.getElementById("finalModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "finalModal";
    modal.className = "final-modal";
    document.body.appendChild(modal);
  }

  modal.className = "final-modal";
  modal.innerHTML = `
    <div class="final-overlay"></div>
    <div class="final-card" role="dialog" aria-modal="true" aria-label="Encerramento">
      <div class="final-title" id="finalTitle">Aviso</div>
      <p class="final-sub" id="finalSub">—</p>
      <div class="final-pill" id="finalPill">—</div>
      <div class="final-actions">
        <button class="final-btn primary" id="finalBtnSair" type="button">SAIR</button>
      </div>
    </div>
  `;

  modal.style.display = "";

  const btn = document.getElementById("finalBtnSair");
  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    forceExitToSaiu();
  };

  const overlay = modal.querySelector(".final-overlay");
  overlay.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
}

function showEncerradoModal({ mode="finalizado", nome="" } = {}){
  ensureEndModal();

  const modal = document.getElementById("finalModal");
  const title = document.getElementById("finalTitle");
  const sub = document.getElementById("finalSub");
  const pill = document.getElementById("finalPill");

  const clienteNome = nome || getClienteNome(filaId) || "Cliente";

  if (mode === "cancelado") {
    title.textContent = "Atendimento cancelado!";
    sub.innerHTML =
      `Você foi removido da fila.<br><br>` +
      `Clique em <b>SAIR</b> para voltar.`;
    pill.textContent = `Cliente: ${clienteNome}`;
  } else {
    title.textContent = "Atendimento concluído!";
    sub.innerHTML =
      `Seu atendimento foi concluído com sucesso.<br><br>` +
      `Clique em <b>SAIR</b> para finalizar.`;
    pill.textContent = `Cliente: ${clienteNome}`;
  }

  document.body.classList.add("lock");
  modal.classList.add("show");
}

function encerrarETravar(mode, nome){
  if (atendimentoEncerrado) return;

  atendimentoEncerrado = true;
  encerramentoModo = mode;

  showEncerradoModal({ mode, nome });

  try { ws?.close(); } catch {}
  ws = null;

  clearInterval(wsPingTimer);
  clearTimeout(wsRetryTimer);
  clearInterval(fallbackTimer);
}

// ✅ Sai para saiu.html e limpa APENAS as chaves da fila/cliente atual
function forceExitToSaiu(){
  const target = `${window.location.origin}/templates/saiu.html`;

  atendimentoEncerrado = true;
  document.body.classList.remove("lock");

  try { ws?.close(); } catch {}
  ws = null;

  clearInterval(wsPingTimer);
  clearTimeout(wsRetryTimer);
  clearInterval(fallbackTimer);

  try {
    // remove sessão desta fila (aba + fallback)
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);

    // remove fila_cliente_id desta fila
    localStorage.removeItem(`fila_cliente_id_${filaId}`);

    // NÃO remover cliente_nome_{filaId} global da fila pode afetar outra aba;
    // mas pode remover o da ABA:
    sessionStorage.removeItem(`cliente_nome_${filaId}`);

    // se tiver clienteId, remove a chave específica desta pessoa:
    if (clienteId) {
      sessionStorage.removeItem(`cliente_nome_${filaId}_${clienteId}`);
      // opcional: pode manter no localStorage (histórico), mas se quiser limpar:
      // localStorage.removeItem(`cliente_nome_${filaId}_${clienteId}`);
    }
  } catch {}

  window.location.replace(target);
  setTimeout(() => window.location.replace(target), 250);
}

// ================= Render =================
function renderStatus(payload){
  const stRaw = payload?.cliente?.status ?? payload?.status ?? "aguardando";
  const st = String(stRaw).toLowerCase();

  ultimoStatusConhecido = st;

  const aFrente = Number(payload.a_frente ?? 0);
  const pos = Number(payload.posicao ?? (aFrente + 1));

  if (st === "em_atendimento" || st === "em atendimento") {
    if (elPos){
      elPos.textContent = "Em atendimento";
      elPos.classList.add("em-atendimento");
    }
    if (elFrente){
      elFrente.textContent = "Você está sendo atendido agora";
      elFrente.classList.add("em-atendimento");
    }
  } else {
    if (elPos){
      elPos.textContent = `#${pad3(pos)}`;
      elPos.classList.remove("em-atendimento");
    }
    if (elFrente){
      elFrente.textContent = `${aFrente} pessoas à frente`;
      elFrente.classList.remove("em-atendimento");
    }
  }

  const tempoMedioMin = Number(payload.tempo_medio_min ?? 12);
  if (elTempoMedio) elTempoMedio.textContent = `${tempoMedioMin} min`;

  const estimativa = Number(payload.estimativa_min ?? (aFrente * tempoMedioMin));
  if (elEstimativa) elEstimativa.textContent = `~${estimativa} min`;

  if (elFilaNome) elFilaNome.textContent = payload.fila_nome || "Fila";
  if (elUlt) elUlt.textContent = horaAgora();
  if (payload.fila_raio_m && elFilaRaio) elFilaRaio.textContent = `${payload.fila_raio_m}m`;

  // atualiza topo com nome correto desta sessão
  preencherNomeClienteNoTopo();
}

async function atualizarStatus({ silent=false } = {}) {
  if (!filaId || !clienteId) return;
  if (atendimentoEncerrado) return;

  let res, data = null;

  try {
    res = await fetch(`${API_BASE}/api/filas/${filaId}/cliente/${clienteId}/status`);
    data = await res.json().catch(() => null);
  } catch (e) {
    if (!silent) showToast("Erro de conexão");
    return;
  }

  // ✅ backend pode retornar encerrado=true
  if (data && data.encerrado === true) {
    const modo = encerramentoModo || "cancelado";
    encerrarETravar(modo, getClienteNome(filaId));
    return;
  }

  if (!res.ok){
    if (res.status === 404){
      const modo = encerramentoModo || (ultimoStatusConhecido === "em_atendimento" ? "finalizado" : "cancelado");
      encerrarETravar(modo, getClienteNome(filaId));
      return;
    }
    if (!silent) showToast("Erro ao atualizar");
    return;
  }

  if (!data) {
    if (!silent) showToast("Resposta inválida do servidor");
    return;
  }

  const fcId = Number(data?.cliente?.fila_cliente_id || 0);
  if (fcId) {
    filaClienteIdAtual = fcId;
    localStorage.setItem(`fila_cliente_id_${filaId}`, String(fcId));
  }

  // tenta atualizar nome localmente, se backend mandou algum nome (não está mandando hoje, ok)
  // setClienteNome(filaId, clienteId, data?.cliente?.nome);

  renderStatus(data);
  if (!silent) showToast("Atualizado!");
}

async function entrarNaFila(){
  if (!filaId) return;

  if (clienteId){
    // garante que existe nome salvo por fila+cliente
    const n = getClienteNome(filaId);
    if (n) setClienteNome(filaId, clienteId, n);

    await atualizarStatus({ silent:true });
    return;
  }

  const nome = (getClienteNome(filaId) || "").trim();

  if (!nome){
    const url = new URL("/templates/login.html", window.location.origin);
    url.searchParams.set("next", "Fila_cliente.html");
    url.searchParams.set("filaId", String(filaId));
    window.location.replace(url.toString());
    return;
  }

  const res = await fetch(`${API_BASE}/api/fila/${filaId}/entrar`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ nome })
  });

  if (!res.ok){
    const err = await res.json().catch(()=>({detail:"Erro"}));
    alert(err.detail || "Erro ao entrar na fila");
    return;
  }

  const data = await res.json();

  clienteId = Number(data.cliente_id || 0);

  // ✅ sessão por ABA (não conflita) + fallback localStorage
  if (clienteId) {
    sessionStorage.setItem(SESSION_KEY, String(clienteId));
    localStorage.setItem(SESSION_KEY, String(clienteId));
    setClienteNome(filaId, clienteId, nome);
  }

  const fcId = Number(data.fila_cliente_id || 0);
  if (fcId) {
    filaClienteIdAtual = fcId;
    localStorage.setItem(`fila_cliente_id_${filaId}`, String(fcId));
  }

  showToast(`Sua senha: ${data.senha_codigo || "OK"}`);
  await atualizarStatus({ silent:true });
}

// ================= GEO =================
function setRaioStatus(ok){
  if (!elPillRaio) return;
  elPillRaio.classList.toggle("ok", ok);
  elPillRaio.classList.toggle("bad", !ok);
  elPillRaio.innerHTML = ok
    ? `<i class="bi bi-check2-circle"></i><span>Dentro do raio</span>`
    : `<i class="bi bi-x-circle"></i><span>Fora do raio</span>`;
}

async function atualizarLocalizacao(){
  if (atendimentoEncerrado) return;

  if (!navigator.geolocation){
    if (elCoordsStatus){
      elCoordsStatus.textContent = "Indisponível";
      elCoordsStatus.classList.add("danger");
    }
    showToast("Geolocalização indisponível.");
    return;
  }

  try {
    if (!filaInfoCache) {
      const info = await fetchFilaInfo(filaId);
      if (!info?.ok) throw new Error(info?.error || "Info inválida");
      filaInfoCache = info;

      if (elFilaNome) elFilaNome.textContent = info.fila?.nome || "Fila";
      const raio = info.estabelecimento?.raio_m;
      if (raio && elFilaRaio) elFilaRaio.textContent = `${raio}m`;
    }
  } catch (e) {
    console.log(e);
    showToast("Erro ao carregar dados da fila");
    return;
  }

  const estab = filaInfoCache.estabelecimento;
  const estabLat = Number(estab?.lat);
  const estabLng = Number(estab?.lng);
  const raioM = Number(estab?.raio_m);

  if (!isFinite(estabLat) || !isFinite(estabLng) || !isFinite(raioM)){
    showToast("Estabelecimento sem GPS/raio configurados");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const acc = pos.coords.accuracy;

      if (elCoordsStatus){
        elCoordsStatus.textContent = `Ativa (±${acc.toFixed(0)}m)`;
        elCoordsStatus.classList.remove("danger");
      }

      const distM = haversineMeters(lat, lng, estabLat, estabLng);
      if (elDist) elDist.textContent = formatDist(distM);

      const dentro = distM <= raioM;
      setRaioStatus(dentro);

      if (elUlt) elUlt.textContent = horaAgora();
      showToast("Localização atualizada!");
    },
    (err) => {
      if (elCoordsStatus){
        elCoordsStatus.textContent = "Permissão negada";
        elCoordsStatus.classList.add("danger");
      }
      setRaioStatus(false);
      showToast("Permissão de localização negada.");
      console.log(err);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// ================= SAIR (manual) =================
let isExiting = false;

async function apiSairDaFilaSeguro() {
  if (!clienteId || clienteId <= 0) return;

  const url = `${API_BASE}/api/filas/${filaId}/cliente/${clienteId}/sair`;

  // 1) Beacon
  try {
    const blob = new Blob([], { type: "application/json" });
    const ok = navigator.sendBeacon?.(url, blob);
    if (ok) return;
  } catch {}

  // 2) fetch keepalive
  try {
    await fetch(url, { method: "POST", keepalive: true });
  } catch {}
}

async function sairDaFila(evt){
  if (evt){
    evt.preventDefault();
    evt.stopPropagation();
    if (evt.stopImmediatePropagation) evt.stopImmediatePropagation();
  }

  if (isExiting) return;
  isExiting = true;

  try {
    const ok = confirm("Tem certeza que deseja sair da fila?");
    if (!ok) return;

    await apiSairDaFilaSeguro();
    forceExitToSaiu();

  } finally {
    setTimeout(() => { isExiting = false; }, 800);
  }
}

btnSair?.addEventListener("touchend", sairDaFila, { capture: true });
btnSair?.addEventListener("click", sairDaFila, { capture: true });

// ================= LISTENERS =================
btnGeo?.addEventListener("click", atualizarLocalizacao);
btnAtualizar?.addEventListener("click", () => atualizarStatus({ silent:false }));

// ================= WEBSOCKET (TEMPO REAL) =================
let ws = null;
let wsPingTimer = null;
let wsRetryTimer = null;
let fallbackTimer = null;

function wsUrlForFila(filaId) {
  const proto = (location.protocol === "https:") ? "wss" : "ws";
  return `${proto}://${location.host}/ws/fila/${filaId}`;
}

function eventoEhMeu(p = {}) {
  const payloadClienteId = Number(p.cliente_id || 0);
  const payloadFilaClienteId = Number(p.fila_cliente_id || 0);

  if (payloadClienteId && clienteId && payloadClienteId === Number(clienteId)) return true;
  if (payloadFilaClienteId && filaClienteIdAtual && payloadFilaClienteId === Number(filaClienteIdAtual)) return true;

  return false;
}

function startWebSocket() {
  if (!filaId) return;
  if (atendimentoEncerrado) return;

  try { ws?.close(); } catch {}
  ws = null;

  ws = new WebSocket(wsUrlForFila(filaId));

  ws.onopen = () => {
    clearInterval(wsPingTimer);
    wsPingTimer = setInterval(() => {
      try {
        if (ws?.readyState === WebSocket.OPEN) ws.send("ping");
      } catch {}
    }, 25000);
  };

  ws.onmessage = (e) => {
    if (atendimentoEncerrado) return;

    try {
      const msg = JSON.parse(e.data);
      if (msg.type !== "fila_update") return;

      const action = (msg.action || "").toString().toUpperCase();
      const p = msg.payload || {};
      const ehMeu = eventoEhMeu(p);

      if ((action === "ATENDIMENTO_FINALIZADO" || action === "FINALIZOU") && ehMeu) {
        encerramentoModo = "finalizado";
        encerrarETravar("finalizado", getClienteNome(filaId));
        return;
      }

      if ((action === "ATENDIMENTO_CANCELADO" || action === "CANCELOU") && ehMeu) {
        encerramentoModo = "cancelado";
        encerrarETravar("cancelado", getClienteNome(filaId));
        return;
      }

      atualizarStatus({ silent:true }).catch(()=>{});
    } catch {
      // ignore
    }
  };

  ws.onclose = () => {
    clearInterval(wsPingTimer);
    if (atendimentoEncerrado) return;
    clearTimeout(wsRetryTimer);
    wsRetryTimer = setTimeout(startWebSocket, 2500);
  };
}

// ================= INIT =================
(async () => {
  try {
    ensureEndModal();

    await entrarNaFila();

    // topo com nome correto desta sessão
    preencherNomeClienteNoTopo();

    startWebSocket();

    await atualizarStatus({ silent:true });

    await atualizarLocalizacao();

    fallbackTimer = setInterval(() => {
      if (atendimentoEncerrado) return;
      atualizarStatus({ silent:true }).catch(()=>{});
    }, 5000);

  } catch (e) {
    console.log("Init erro:", e);
  }
})();