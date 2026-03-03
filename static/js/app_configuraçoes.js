// ===== Sidebar mobile (somente nesta página) =====
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

menuBtn?.addEventListener("click", openSidebar);
backdrop?.addEventListener("click", closeSidebar);

// ===== API =====
const API_BASE = window.location.origin;

// ===== Toast =====
const toast = document.getElementById("toast");
function showToast(msg){
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1500);
}

// ===== Topbar nome (mesmo padrão que você usou nas outras páginas) =====
function setNomeTopbar(nome){
  const el = document.getElementById("nomeEstabelecimento"); // se existir no HTML
  if (el) el.textContent = (nome || "—").trim();
}

// ===== Inputs do formulário =====
const inpNome = document.getElementById("inpNome");
const inpEndereco = document.getElementById("inpEndereco");
const inpTelefone = document.getElementById("inpTelefone");
const inpTempoMedio = document.getElementById("inpTempoMedio");
const inpEmail = document.getElementById("inpEmail"); // só existe se você adicionar no HTML

// ===== Helpers =====
async function getJSON(path){
  const res = await fetch(API_BASE + path, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Erro HTTP ${res.status}`);
  return data;
}

function preencherPerfil(est){
  // tenta pegar nos nomes mais prováveis (seu backend pode variar)
  const nome = (est?.nome || "").trim();
  const email = (est?.email || est?.userEmail || "").trim();
  const telefone = (est?.telefone || est?.whatsapp || est?.celular || "").trim();

  // endereço pode estar em campos separados
  const endereco =
    (est?.endereco || "").trim() ||
    [est?.rua, est?.numero, est?.bairro, est?.cidade, est?.estado]
      .filter(Boolean)
      .join(", ");

  // tempo médio (se existir na tabela/endpoint)
  const tempoMedio =
    Number(est?.tempo_medio_min ?? est?.tempoMedio ?? est?.tempo_medio ?? 0);

  // preenche inputs (sem sobrescrever se não veio nada)
  if (inpNome && nome) inpNome.value = nome;
  if (inpEndereco && endereco) inpEndereco.value = endereco;
  if (inpTelefone && telefone) inpTelefone.value = telefone;
  if (inpEmail && email) inpEmail.value = email;
  if (inpTempoMedio && Number.isFinite(tempoMedio) && tempoMedio > 0) inpTempoMedio.value = String(tempoMedio);

  // topbar + localStorage
  if (nome) {
    setNomeTopbar(nome);
    localStorage.setItem("estabelecimento_nome", nome);
  }
}

// ===== Carregar perfil do banco =====
async function carregarPerfil(){
  const estabId = Number(localStorage.getItem("estabelecimento_id") || 0);
  if (!estabId){
    showToast("Faça login novamente.");
    window.location.href = "/templates/LoginCnpj.html";
    return;
  }

  // primeiro tenta o nome do cache (pra não ficar "—")
  const nomeLS = (localStorage.getItem("estabelecimento_nome") || "").trim();
  if (nomeLS) setNomeTopbar(nomeLS);

  // agora busca do banco
  const est = await getJSON(`/api/estabelecimentos/${estabId}`);
  preencherPerfil(est);
}

// ===== Form salvar (por enquanto mock; depois você liga no backend) =====
const formPerfil = document.getElementById("formPerfil");
formPerfil?.addEventListener("submit", (e) => {
  e.preventDefault();

  const payload = {
    nome: inpNome?.value.trim() || "",
    endereco: inpEndereco?.value.trim() || "",
    telefone: inpTelefone?.value.trim() || "",
    tempoMedio: Number(inpTempoMedio?.value || 0)
  };

  console.log("Salvar configurações:", payload);
  showToast("Configurações salvas! (mock)");
});

// ===== Preferências (mock salvar local) =====
const prefs = {
  notif: document.getElementById("togNotif"),
  live: document.getElementById("togLive"),
  qr: document.getElementById("togQr"),
};

function loadPrefs(){
  const saved = JSON.parse(localStorage.getItem("prefs") || "{}");
  if (typeof saved.notif === "boolean" && prefs.notif) prefs.notif.checked = saved.notif;
  if (typeof saved.live === "boolean" && prefs.live) prefs.live.checked = saved.live;
  if (typeof saved.qr === "boolean" && prefs.qr) prefs.qr.checked = saved.qr;
}
function savePrefs(){
  localStorage.setItem("prefs", JSON.stringify({
    notif: !!prefs.notif?.checked,
    live: !!prefs.live?.checked,
    qr: !!prefs.qr?.checked
  }));
  showToast("Preferências salvas!");
}

Object.values(prefs).forEach((el) => el?.addEventListener("change", savePrefs));
loadPrefs();

// ===== Sair =====
document.getElementById("btnSair")?.addEventListener("click", () => {
  // limpa sessão do estabelecimento
  localStorage.removeItem("estabelecimento_id");
  localStorage.removeItem("estabelecimento_nome");

  showToast("Sessão encerrada!");
  setTimeout(() => {
    window.location.href = "/templates/index.html";
  }, 800);
});

// ===== INIT =====
carregarPerfil().catch((e) => {
  console.error("Erro carregarPerfil:", e);
  showToast(e.message || "Erro ao carregar perfil.");
});