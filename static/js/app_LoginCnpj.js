// static/js/app_LoginCnpj.js

// ✅ API: usa o mesmo origin (funciona em localhost e ngrok)
const API_BASE = window.location.origin;

// ================= FETCH =================
async function postJSON(path, data) {
  const url = API_BASE + path;

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch {
    throw new Error("Falha ao conectar com a API.");
  }

  let payload = null;
  let raw = "";

  try { payload = await res.json(); }
  catch { raw = await res.text().catch(() => ""); }

  if (!res.ok) {
    throw new Error(payload?.detail || raw || `Erro HTTP ${res.status}`);
  }

  return payload;
}

// ================= HELPERS =================
function onlyDigits(v) { return (v || "").replace(/\D/g, ""); }

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((email || "").toLowerCase());
}

function normalizarEmail(email) {
  return (email || "").trim().toLowerCase();
}

// ✅ pega id do retorno do backend (compatível com vários formatos)
function extrairEstabId(data) {
  const candidatos = [
    data?.estabelecimento_id,
    data?.estabelecimentoId,
    data?.idEstabelecimento,
    data?.id,
    data?.estabelecimento?.id,
    data?.estabelecimento?.idEstabelecimento,
    data?.user?.id,
  ];
  const id = candidatos.find(v => Number(v) > 0);
  return id ? Number(id) : null;
}

// ✅ pega nome do retorno do backend (compatível com vários formatos)
function extrairNomeEstab(data) {
  const candidatos = [
    data?.nome,
    data?.estabelecimento_nome,
    data?.nomeEstabelecimento,
    data?.estabelecimento?.nome,
    data?.estabelecimento?.estabelecimento_nome,
    data?.user?.nome,
    data?.user?.estabelecimento_nome,
  ];
  const nome = candidatos.find(v => typeof v === "string" && v.trim());
  return nome ? nome.trim() : null;
}

// ✅ salva nome em chaves padronizadas (pra todas as páginas)
function salvarNomeEstabelecimento(nome) {
  if (!nome || !String(nome).trim()) return;
  const n = String(nome).trim();

  // chave "universal" (recomendada)
  localStorage.setItem("nomeEstabelecimento", n);

  // mantém compatibilidade com o que você já usa
  localStorage.setItem("estabelecimento_nome", n);
}

// ================= ELEMENTOS =================
const bizError = document.getElementById("bizError");
const signupError = document.getElementById("signupError");
const signupError2 = document.getElementById("signupError2");

const modeBiz = document.getElementById("modeBiz");
const modeBizSignup = document.getElementById("modeBizSignup");

const signupBtn = document.getElementById("signupBtn");
const signupBackToLogin1 = document.getElementById("signupBackToLogin1");

const bizEmail = document.getElementById("bizEmail");
const bizPass = document.getElementById("bizPass");
const btnBiz = document.getElementById("btnBiz");

const signupStep1 = document.getElementById("signupStep1");
const signupStep2 = document.getElementById("signupStep2");

const btnSignupContinue = document.getElementById("btnSignupContinue");
const goPrevStepBtn = document.getElementById("goPrevStepBtn");
const btnSignupBiz = document.getElementById("btnSignupBiz");

const signupBizName = document.getElementById("signupBizName");
const signupBizCnpj = document.getElementById("signupBizCnpj");
const signupBizCategory = document.getElementById("signupBizCategory");
const signupBizCity = document.getElementById("signupBizCity");
const signupBizUF = document.getElementById("signupBizUF");
const signupBizPhone = document.getElementById("signupBizPhone");

const signupBizEmail = document.getElementById("signupBizEmail");
const signupBizPass = document.getElementById("signupBizPass");
const signupBizPass2 = document.getElementById("signupBizPass2");

// ================= UI =================
function mostrarApenas(target) {
  [modeBiz, modeBizSignup].forEach(m => m?.classList.add("hidden"));
  target?.classList.remove("hidden");
}

function abrirModoBiz() { mostrarApenas(modeBiz); }
function abrirModoBizSignup() {
  mostrarApenas(modeBizSignup);
  mostrarSignupEtapa(1);
}

function mostrarSignupEtapa(etapa) {
  if (etapa === 1) {
    signupStep1?.classList.remove("hidden");
    signupStep2?.classList.add("hidden");
  } else {
    signupStep1?.classList.add("hidden");
    signupStep2?.classList.remove("hidden");
  }
}

// ================= NAVEGAÇÃO =================
signupBtn?.addEventListener("click", abrirModoBizSignup);
signupBackToLogin1?.addEventListener("click", abrirModoBiz);
goPrevStepBtn?.addEventListener("click", () => mostrarSignupEtapa(1));

// ================= VALIDAÇÃO ETAPA 1 =================
function validarEtapa1() {
  if (!signupBizName.value.trim()) return "Digite o nome.";
  if (onlyDigits(signupBizCnpj.value).length !== 14) return "CNPJ inválido.";
  if (!signupBizCategory.value) return "Selecione categoria.";
  if (!signupBizCity.value.trim()) return "Digite a cidade.";
  if (!signupBizUF.value) return "Selecione UF.";
  if (onlyDigits(signupBizPhone.value).length < 10) return "Telefone inválido.";
  return "";
}

btnSignupContinue?.addEventListener("click", () => {
  const msg = validarEtapa1();
  if (msg) {
    signupError.textContent = msg;
    return;
  }
  signupError.textContent = "";
  mostrarSignupEtapa(2);
});

// ================= VALIDAÇÃO ETAPA 2 =================
function validarEtapa2() {
  const email = signupBizEmail.value.trim();
  const p1 = signupBizPass.value;
  const p2 = signupBizPass2.value;

  if (!emailValido(email)) return "Email inválido.";
  if (p1.length < 8) return "Senha mínima 8 caracteres.";
  if (p1 !== p2) return "Senhas não coincidem.";
  return "";
}

// ================= CADASTRO (POST /api/estabelecimentos) =================
btnSignupBiz?.addEventListener("click", async () => {
  const msg = validarEtapa2();
  if (msg) {
    signupError2.textContent = msg;
    return;
  }
  signupError2.textContent = "";

  // ✅ normaliza categoria para o ENUM do banco
  const categoriaMap = {
    "Clínica": "CLINICA",
    "Barbearia": "BARBEARIA",
    "Salão": "SALAO",
    "Estética": "ESTETICA",
    "Restaurante": "RESTAURANTE",
    "Açougue": "ACOUGUE",
    "Supermercad": "SUPERMERCADO",
    "Outros": "SUPERMERCADO",
  };

  const categoria = categoriaMap[signupBizCategory.value.trim()] || "BARBEARIA";

  const payload = {
    nome: signupBizName.value.trim(),
    cidade: signupBizCity.value.trim(),
    cnpj: signupBizCnpj.value.trim(),
    categoria,
    estado: signupBizUF.value.trim(),
    telefone: signupBizPhone.value.trim(),
    email: normalizarEmail(signupBizEmail.value),
    senha: signupBizPass.value,
    latitude: null,
    longitude: null,
    raio_alerta: null,
  };

  try {
    const resp = await postJSON("/api/estabelecimentos", payload);

    // ✅ se a API retornar id, salva
    const id = extrairEstabId(resp) || resp?.id || null;
    if (id) localStorage.setItem("estabelecimento_id", String(id));

    // ✅ salva nome em chaves padronizadas
    salvarNomeEstabelecimento(payload.nome);

    abrirModoBiz();
    bizEmail.value = payload.email;
    bizPass.value = "";
    bizError.textContent = "Conta criada! Faça login.";

  } catch (e) {
    signupError2.textContent = e.message;
  }
});

// ================= LOGIN (POST /api/login-estabelecimento) =================
btnBiz?.addEventListener("click", async () => {
  bizError.textContent = "";

  const email = normalizarEmail(bizEmail.value);
  const senha = bizPass.value;

  if (!emailValido(email)) {
    bizError.textContent = "Email inválido.";
    return;
  }
  if (!senha) {
    bizError.textContent = "Digite a senha.";
    return;
  }

  try {
    const data = await postJSON("/api/login-estabelecimento", { email, senha });

    const estabId = extrairEstabId(data);
    if (!estabId) {
      console.log("Resposta do login:", data);
      throw new Error("Login OK, mas a API não retornou o id do estabelecimento.");
    }

    // ✅ salva id no localStorage (isso destrava Criar Fila e QR Code)
    localStorage.setItem("estabelecimento_id", String(estabId));

    // ✅ salva nome vindo da API (se vier) OU mantém o que já tinha salvo
    const nomeDaApi = extrairNomeEstab(data);
    if (nomeDaApi) {
      salvarNomeEstabelecimento(nomeDaApi);
    } else {
      // fallback: se já existe do cadastro/anterior, mantém
      const jaSalvo = localStorage.getItem("estabelecimento_nome");
      if (jaSalvo) salvarNomeEstabelecimento(jaSalvo);
    }

    window.location.href = "/templates/Dashboard.html";
  } catch (e) {
    bizError.textContent = e.message;
  }
});