// ===============================
// ESTABELECIMENTO (nome dinâmico)
// ===============================
function obterNomeEstabelecimento() {
  // tenta em várias chaves (pra funcionar mesmo antes de eu ver teu login)
  const direct =
    localStorage.getItem("nomeEstabelecimento") ||
    localStorage.getItem("estabelecimento_nome") ||
    localStorage.getItem("nome_estabelecimento") ||
    localStorage.getItem("estab_nome");

  if (direct && direct.trim()) return direct.trim();

  // tenta objeto salvo em JSON (se existir)
  const possibleJsonKeys = ["estabelecimento", "biz", "usuarioEstab"];
  for (const k of possibleJsonKeys) {
    const raw = localStorage.getItem(k);
    if (!raw) continue;
    try {
      const obj = JSON.parse(raw);
      const name = obj?.nome || obj?.nomeEstabelecimento || obj?.estabelecimento_nome;
      if (name && String(name).trim()) return String(name).trim();
    } catch {}
  }

  return null;
}

function preencherNomeNoTopo() {
  const nome = obterNomeEstabelecimento();
  const el = document.getElementById("nomeEstabelecimento");
  const header = document.getElementById("estabHeader");

  if (el) el.textContent = nome || "—";
  if (header) header.title = `Estabelecimento: ${nome || "—"}`;
}

document.addEventListener("DOMContentLoaded", preencherNomeNoTopo);

// Sidebar mobile (apenas para esta página)
const sidebar = document.getElementById("sidebar");
const backdrop = document.getElementById("backdrop");
const menuBtn = document.getElementById("menuBtn");

function openSidebar(){
  if (!sidebar || !backdrop) return;
  sidebar.classList.add("open");
  backdrop.classList.add("show");
}
function closeSidebar(){
  if (!sidebar || !backdrop) return;
  sidebar.classList.remove("open");
  backdrop.classList.remove("show");
}

if (menuBtn) menuBtn.addEventListener("click", openSidebar);
if (backdrop) backdrop.addEventListener("click", closeSidebar);

// Range (raio em metros)
const rangeMeters = document.getElementById("rangeMeters");
const rangeValue = document.getElementById("rangeValue");

function setRangeLabel(v){
  if (!rangeValue) return;
  rangeValue.textContent = `${v}m`;
}

if (rangeMeters){
  setRangeLabel(rangeMeters.value);
  rangeMeters.addEventListener("input", (e) => {
    setRangeLabel(e.target.value);
  });
}

// ===============================
// CRIAR FILA
// ===============================

// inputs
const nomeFila = document.getElementById("nomeFila");
const enderecoFila = document.getElementById("enderecoFila");
const tempoMedio = document.getElementById("tempoMedio");
const capacidade = document.getElementById("capacidade");
const toggleAtiva = document.getElementById("toggleAtiva");
const msgBoasVindas = document.getElementById("msgBoasVindas");
const horario = document.getElementById("horario");
const observacoes = document.getElementById("observacoes");

const btnSalvar = document.getElementById("btnSalvarFila");
const listaFilas = document.getElementById("listaFilas");

const STORAGE_KEY = "filasCriadas";

// ✅ API: mesma origem (funciona em localhost e ngrok)
const API_BASE = window.location.origin;

// ===============================
// HELPERS localStorage
// ===============================
function obterFilas(){
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function salvarFilas(filas){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filas));
}

function gerarID(){
  return "fila_" + Math.random().toString(36).slice(2,8).toUpperCase();
}

// ===============================
// FETCH helper
// ===============================
async function postJSON(path, data) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(payload?.detail || `Erro HTTP ${res.status}`);
  }

  return payload;
}

// ===============================
// render lado direito (filas existentes)
// ===============================
function renderFilas(){
  if (!listaFilas) return;

  const filas = obterFilas();
  listaFilas.innerHTML = "";

  if (!filas.length){
    listaFilas.innerHTML = `<p style="opacity:.5;font-size:12px">Nenhuma fila criada ainda</p>`;
    return;
  }

  filas.forEach(fila => {
    const item = document.createElement("div");
    item.className = "queue-item";

    const statusTxt = fila.status || (fila.ativa ? "ABERTA" : "FECHADA");
    const idBanco = fila.idFila ? `ID Banco: ${fila.idFila}` : "";
    const idLocal = fila.id ? `ID Local: ${fila.id}` : "";

    item.innerHTML = `
      <div class="queue-left">
        <div class="queue-title">${fila.nome}</div>
        <div class="queue-sub">${fila.endereco}</div>
        ${idBanco ? `<div class="queue-sub">${idBanco}</div>` : ""}
        ${idLocal ? `<div class="queue-sub">${idLocal}</div>` : ""}
      </div>
      <span class="badge ${statusTxt === "ABERTA" ? "badge-on" : ""}">
        ${statusTxt === "ABERTA" ? "Ativa" : "Inativa"}
      </span>
    `;

    listaFilas.appendChild(item);
  });
}

// ===============================
// salvar nova fila (AGORA SALVA NO BANCO)
// ===============================
if (btnSalvar){
  btnSalvar.addEventListener("click", async () => {

    // ✅ precisa estar logado
    const estabId = Number(localStorage.getItem("estabelecimento_id") || 0);
    if (!estabId) {
      alert("Faça login novamente. ID do estabelecimento não encontrado.");
      return;
    }

    const nome = (nomeFila?.value || "").trim();
    const endereco = (enderecoFila?.value || "").trim();
    const tempo = Number(tempoMedio?.value);

    if (!nome || !endereco || !Number.isFinite(tempo) || tempo <= 0){
      alert("Preencha os campos obrigatórios (Nome, Endereço e Tempo médio).");
      return;
    }

    // ✅ payload para seu backend (main.py)
    const payloadAPI = {
      estabelecimento_id: estabId,
      status: (toggleAtiva?.checked ? "ABERTA" : "FECHADA"),
      nome,
      endereco,
      raio_metros: rangeMeters ? Number(rangeMeters.value) : 500,
      tempo_medio_min: tempo,
      capacidade_max: capacidade?.value ? Number(capacidade.value) : null,
      mensagem_boas_vindas: (msgBoasVindas?.value || "").trim() || null,
      horario_funcionamento: (horario?.value || "").trim() || null,
      observacoes: (observacoes?.value || "").trim() || null,
    };

    try {
      // ✅ cria no banco
      const resp = await postJSON("/api/filas", payloadAPI);

      // ✅ mantém também um “espelho” no localStorage (opcional)
      const novaFilaLocal = {
        id: gerarID(),
        idFila: resp?.idFila,
        nome,
        endereco,
        raio: payloadAPI.raio_metros,
        tempoMedio: tempo,
        capacidade: payloadAPI.capacidade_max,
        ativa: payloadAPI.status === "ABERTA",
        status: payloadAPI.status,
        mensagem: payloadAPI.mensagem_boas_vindas,
        horario: payloadAPI.horario_funcionamento,
        observacoes: payloadAPI.observacoes,
        criadaEm: Date.now()
      };

      const filas = obterFilas();
      filas.unshift(novaFilaLocal);
      salvarFilas(filas);
      renderFilas();

      alert(`Fila criada no banco! ID: ${resp.idFila}`);

      if (nomeFila) nomeFila.value = "";
      if (enderecoFila) enderecoFila.value = "";
      if (msgBoasVindas) msgBoasVindas.value = "";
      if (horario) horario.value = "";
      if (observacoes) observacoes.value = "";
      if (capacidade) capacidade.value = "";

    } catch (e) {
      alert(e.message || "Erro ao criar fila");
    }
  });
}

// init
renderFilas();