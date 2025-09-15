// VIGIA — Painel (admin.js)
// Funciona com vigia_admin.html e com o app.js "one-by-one".

// ===== Chaves e helpers de storage (compatíveis com o app one-by-one) =====
const LS_CASES = "vigia-cases-v1";
const LS_USER  = "vigia-user-v1";
const getCases = ()=> JSON.parse(localStorage.getItem(LS_CASES)||"[]");
const setCases = (a)=> localStorage.setItem(LS_CASES, JSON.stringify(a));
const getUser  = ()=> JSON.parse(localStorage.getItem(LS_USER)||"null");
const setUser  = (u)=> localStorage.setItem(LS_USER, JSON.stringify(u));

// ===== Utilidades =====
const sigmoid = x => 1/(1+Math.exp(-x));
function recalcIIR(c){
  // mesmo raciocínio simples do app.js (one-by-one)
  let s = 0.5;
  if(["agua","esgoto","alagamento"].includes(c.tipo)) s += 0.3;
  if((c.desc||c.descricao||"").toLowerCase().match(/hospital|escola|idoso/)) s += 0.1;
  const r = Math.min(1, Math.log10(1 + (c.reach||c.pessoas||50)) / 3);
  const z = 2.0*s + 1.2*0.3 + 1.1*r - 1.8; // p mínimo = 0.3 (demo)
  return Math.round(sigmoid(z)*100);
}

function formatLatLng(c){
  if (typeof c.lat === "number" && typeof c.lng === "number") return `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
  if (typeof c.latlng === "string") return c.latlng;
  return "";
}

function toISODate(s){
  try{ return new Date(s).toLocaleString(); }catch{ return s||""; }
}

// ===== Render da conta =====
function renderUser(){
  const u = getUser() || {};
  const nav = document.getElementById("navAvatar");
  if (nav) nav.src = u.photo || "";
  const prev = document.getElementById("accPreview");
  if (prev) prev.src = u.photo || "";
  const name = document.getElementById("accName");
  const email= document.getElementById("accEmail");
  const pwd  = document.getElementById("accPwd");
  if (name)  name.value  = u.name  || "";
  if (email) email.value = u.email || "";
  if (pwd)   pwd.value   = u.pwd   || "";
}
renderUser();

// Salvar perfil
const btnSaveProfile = document.getElementById("btnSaveProfile");
if (btnSaveProfile){
  btnSaveProfile.onclick = ()=>{
    const u = getUser() || {};
    u.name  = document.getElementById("accName").value.trim();
    u.email = document.getElementById("accEmail").value.trim();
    u.pwd   = document.getElementById("accPwd").value;
    const file = document.getElementById("accPhoto").files[0];
    if (file){
      const rd = new FileReader();
      rd.onload = ()=>{ u.photo = rd.result; setUser(u); renderUser(); alert("Perfil salvo."); };
      rd.readAsDataURL(file);
    } else {
      setUser(u); renderUser(); alert("Perfil salvo.");
    }
  };
}

// ===== Exportar / Importar / Zerar =====
const btnExport = document.getElementById("btnExport");
if (btnExport){
  btnExport.onclick = ()=>{
    const data = { user: getUser(), cases: getCases() };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "vigia_export.json"; a.click();
    URL.revokeObjectURL(url);
  };
}

const btnImport = document.getElementById("btnImport");
if (btnImport){
  btnImport.onclick = ()=> document.getElementById("fileImport").click();
}
const fileImport = document.getElementById("fileImport");
if (fileImport){
  fileImport.onchange = (e)=>{
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = ()=>{
      try{
        const obj = JSON.parse(rd.result);
        if (obj.user !== undefined) setUser(obj.user);
        if (obj.cases !== undefined) setCases(obj.cases);
        renderUser(); renderTable();
        alert("Importação concluída.");
      }catch(err){
        alert("Arquivo inválido.");
      }
    };
    rd.readAsText(f);
  };
}

const btnClearAll = document.getElementById("btnClearAll");
if (btnClearAll){
  btnClearAll.onclick = ()=>{
    if (!confirm("Zerar TODOS os casos?")) return;
    localStorage.removeItem(LS_CASES);
    renderTable();
  };
}

// ===== Tabela de casos =====
const rows = document.getElementById("rows");
function corIIR(v){ if (v>=66) return "#ef4444"; if(v>=33) return "#f59e0b"; return "#22c55e"; }

function renderTable(){
  if (!rows) return;
  rows.innerHTML = "";
  const arr = getCases();
  for (const c of arr){
    if (c.iir===undefined) c.iir = recalcIIR(c);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span style="background:${corIIR(c.iir)};color:#000;padding:2px 8px;border-radius:999px;font-weight:700">${c.iir}%</span></td>
      <td>${c.tipo||"-"}</td>
      <td>${c.titulo||c.title||"(sem título)"}</td>
      <td>${c.reach||c.pessoas||"-"}</td>
      <td>${formatLatLng(c)}</td>
      <td class="muted">${toISODate(c.createdAt)}</td>
      <td>
        <button data-id="${c.id}" class="btn-edit">Editar</button>
        <button data-id="${c.id}" class="btn-del"  style="background:linear-gradient(90deg,#ef4444,#b91c1c)">Excluir</button>
      </td>
    `;
    rows.appendChild(tr);
  }

  // Bind actions
  document.querySelectorAll(".btn-edit").forEach(b=> b.onclick = ()=> openEdit(b.getAttribute("data-id")));
  document.querySelectorAll(".btn-del").forEach(b=> b.onclick = ()=> delCase(b.getAttribute("data-id")));
}
renderTable();

function openEdit(id){
  const arr = getCases();
  const c = arr.find(x=>x.id===id);
  if (!c) return alert("Caso não encontrado.");
  document.getElementById("edTitulo").value = c.titulo || c.title || "";
  document.getElementById("edDesc").value   = c.desc || c.descricao || "";
  document.getElementById("edReach").value  = c.reach || c.pessoas || 50;
  document.getElementById("edLatLng").value = formatLatLng(c);
  document.getElementById("backdropEdit").style.display = "flex";
  // salvar handler único
  const btnSave = document.getElementById("btnSaveEdit");
  btnSave.onclick = ()=>{
    c.titulo = document.getElementById("edTitulo").value.trim();
    c.desc   = document.getElementById("edDesc").value.trim();
    c.reach  = parseInt(document.getElementById("edReach").value)||50;
    const ll = document.getElementById("edLatLng").value.split(",").map(x=>parseFloat(x));
    if (ll.length===2 && isFinite(ll[0]) && isFinite(ll[1])){ c.lat = ll[0]; c.lng = ll[1]; c.latlng = `${ll[0]}, ${ll[1]}`; }
    c.iir = recalcIIR(c);
    setCases(arr);
    document.getElementById("backdropEdit").style.display = "none";
    renderTable();
  };
}
document.getElementById("btnCloseEdit").onclick = ()=>{
  document.getElementById("backdropEdit").style.display = "none";
};

function delCase(id){
  if (!confirm("Excluir este caso?")) return;
  const arr = getCases().filter(x=>x.id!==id);
  setCases(arr);
  renderTable();
}

// ===== Semeia 2 exemplos se tabela vazia =====
(function seedIfEmpty(){
  const arr = getCases();
  if (arr.length) return;
  const now = new Date().toISOString();
  const demo = [
    {id:"adm1", tipo:"agua", titulo:"Sem água no bairro Nova Esperança", desc:"5 dias sem água, crianças afetadas", reach:120, lat:-20.307, lng:-40.297, createdAt:now},
    {id:"adm2", tipo:"esgoto", titulo:"Esgoto a céu aberto", desc:"mau cheiro perto de escola", reach:80, lat:-20.325, lng:-40.314, createdAt:now}
  ];
  demo.forEach(c=> c.iir = recalcIIR(c));
  setCases(demo);
  renderTable();
})();
