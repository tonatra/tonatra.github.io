// VIGIA App — lógica principal (versão definitiva)

const LS_CASES = "vigia-cases-v1";
const getCases = ()=> JSON.parse(localStorage.getItem(LS_CASES)||"[]");
const setCases = (a)=> localStorage.setItem(LS_CASES, JSON.stringify(a));
const sigmoid = x => 1/(1+Math.exp(-x));

// Órgãos responsáveis (ES/Vitória)
const ORGAOS = {
  agua:  {nome:"Cesan (Companhia Espírito Santense de Saneamento)", fone:"115", email:"ouvidoria@cesan.com.br", url:"https://www.cesan.com.br/"},
  esgoto:{nome:"Cesan (Companhia Espírito Santense de Saneamento)", fone:"115", email:"ouvidoria@cesan.com.br", url:"https://www.cesan.com.br/"},
  luz:   {nome:"EDP Espírito Santo (Concessionária de Energia)", fone:"0800 721 0707", email:"atendimento@edp.com.br", url:"https://www.edponline.com.br/"},
  buraco:{nome:"Prefeitura de Vitória — Ouvidoria", fone:"156", email:"ouvidoria@vitoria.es.gov.br", url:"https://ouvidoria.vitoria.es.gov.br/"},
  alagamento:{nome:"Prefeitura de Vitória — Defesa Civil", fone:"199", email:"defesacivil@vitoria.es.gov.br", url:"https://vitoria.es.gov.br/defesacivil"},
  outro:{nome:"Ouvidoria Geral do Município", fone:"156", email:"ouvidoria@vitoria.es.gov.br", url:"https://ouvidoria.vitoria.es.gov.br/"}
};
const orgaoByTipo = t => ORGAOS[t] || ORGAOS.outro;

// Leaflet
let map, markerGroup;
(function initMap(){
  const el = document.getElementById('map');
  if(!el) return;
  map = L.map('map').setView([-20.3155,-40.3128], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19, attribution:'&copy; OpenStreetMap'}).addTo(map);
  markerGroup = L.layerGroup().addTo(map);
  map.on('click', e=>{ const ll=document.getElementById('latlng'); if(ll) ll.value = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`; });
})();

// Geo
(function bindGeo(){
  const geoBtn = document.getElementById('geo');
  if(!geoBtn) return;
  geoBtn.onclick = ()=>{
    if(!navigator.geolocation) return alert("Geolocalização indisponível.");
    navigator.geolocation.getCurrentPosition(p=>{
      const {latitude, longitude} = p.coords;
      const ll=document.getElementById('latlng'); if(ll) ll.value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      if(map) map.setView([latitude, longitude], 15);
    }, err=> alert("Erro ao obter localização: "+err.message));
  };
})();

// IIR
function calcIIR(c){
  let s = 0.5;
  if(["agua","esgoto","alagamento"].includes(c.tipo)) s += 0.3;
  if((c.descricao||"").toLowerCase().includes("hospital")) s += 0.1;
  const days = c.createdAt ? (Date.now() - new Date(c.createdAt).getTime())/(24*3600*1000) : 0;
  const p = Math.min(1, Math.max(0.3, days/30));
  const r = Math.min(1, Math.log10(1 + (c.reach||50)) / 3);
  const z = 2.0*s + 1.2*p + 1.1*r - 1.8;
  return Math.round(sigmoid(z)*100);
}
function enrichCase(c){
  if(!c.createdAt) c.createdAt = new Date().toISOString();
  if(c.iir===undefined) c.iir = calcIIR(c);
  if(!c.responsavel){
    const org = orgaoByTipo(c.tipo);
    c.responsavel = org.nome;
    c.contato = { fone:org.fone, email:org.email, url:org.url };
  }
  return c;
}

// Seed automático
(async function autoSeed(){
  if(getCases().length) return;
  try{
    const r = await fetch("./denuncias_vitoria.json", {cache:"no-store"});
    if(r.ok){
      const data = await r.json();
      if(Array.isArray(data)){
        setCases(data.map(enrichCase));
      }
    }
  }catch{}
  render();
})();

// Filtros
let filtroTipo="todos", filtroIIR=0;
(function bindFilters(){
  const t = document.getElementById('filtroTipo');
  const f = document.getElementById('filtroIIR');
  if(t) t.onchange = ()=>{filtroTipo=t.value; render();};
  if(f) f.oninput  = ()=>{filtroIIR=parseInt(f.value||"0"); render();};
})();

// Registrar
(function bindRegistrar(){
  const btn = document.getElementById('btnRegistrar');
  if(!btn) return;
  btn.onclick = ()=>{
    const tipo = document.getElementById('tipo').value;
    const autor = (document.getElementById('autor').value||"Anônimo").trim();
    const descricao = document.getElementById('descricao').value.trim();
    const reach = parseInt(document.getElementById('reach').value)||50;
    const [lat,lng] = (document.getElementById('latlng').value||"").split(',').map(Number);
    if(!isFinite(lat)||!isFinite(lng)) return alert("Informe latitude e longitude válidas.");
    const file = document.getElementById('foto').files[0];
    const add = (foto)=>{
      const c = enrichCase({id:"c"+Date.now(), tipo, autor, descricao, reach, lat, lng, foto});
      const arr = getCases(); arr.push(c); setCases(arr); render();
      alert(`Órgão responsável:\n${c.responsavel}\nTelefone: ${c.contato.fone}\nEmail: ${c.contato.email}\nSite: ${c.contato.url}`);
    };
    if(file){ const rd=new FileReader(); rd.onload=()=>add(rd.result); rd.readAsDataURL(file);} else add(null);
  };
})();

// Limpar
(function bindClear(){
  const btn = document.getElementById('btnClear');
  if(!btn) return;
  btn.onclick = ()=>{ if(confirm("Limpar todos os registros locais?")){ localStorage.removeItem(LS_CASES); render(); } };
})();

// Render
function corIIR(v){ if(v>=66) return "#ef4444"; if(v>=33) return "#f59e0b"; return "#22c55e"; }
function render(){
  if(markerGroup) markerGroup.clearLayers();
  const lista = document.getElementById('listaCasos'); if(lista) lista.innerHTML="";
  const u = JSON.parse(localStorage.getItem("vigia-user-v1")||"null");
  const av = document.getElementById('navAvatar'); if(av) av.src = u?.photo||"";

  const arr = getCases().map(enrichCase);
  const filtered = arr.filter(c => (filtroTipo==="todos"||c.tipo===filtroTipo) && (c.iir||0)>=filtroIIR );

  filtered.forEach(c=>{
    if(markerGroup){
      const m = L.circleMarker([c.lat,c.lng], {radius:9,color:"#fff",weight:1,fillColor:corIIR(c.iir),fillOpacity:0.9});
      const linkSite = c.contato?.url ? `<br><a href="${c.contato.url}" target="_blank">Site</a>` : "";
      const linkFone = c.contato?.fone ? `<br><a href="tel:${(c.contato.fone||'').replace(/\s+/g,'')}">Ligar: ${c.contato.fone}</a>` : "";
      const linkMail = c.contato?.email ? `<br><a href="mailto:${c.contato.email}">Email</a>` : "";
      m.bindPopup(`<b>${c.titulo||c.tipo}</b><br>${c.autor||"Autor desconhecido"}<br>IIR ${c.iir}%<br><small>${c.descricao||""}</small><br><b>Órgão:</b> ${c.responsavel||"-"}${linkFone}${linkMail}${linkSite}`);
      m.addTo(markerGroup);
    }
    if(lista){
      const div = document.createElement("div"); div.className="item";
      const parts=[]; if(c.contato?.fone) parts.push(`<a href="tel:${c.contato.fone.replace(/\s+/g,'')}">${c.contato.fone}</a>`);
      if(c.contato?.email) parts.push(`<a href="mailto:${c.contato.email}">${c.contato.email}</a>`);
      if(c.contato?.url) parts.push(`<a href="${c.contato.url}" target="_blank">site</a>`);
      div.innerHTML = `<div class="pill">IIR ${c.iir}%</div> <b>${c.titulo||c.tipo}</b> <small style="color:#94a3b8">(${c.tipo})</small>
        <div style="font-size:12px;color:#9ca3af;margin-top:4px">Órgão: <b>${c.responsavel||"-"}</b>${parts.length?` — ${parts.join(" · ")}`:""}</div>`;
      lista.appendChild(div);
    }
  });
}
render();

// Estimar pessoas afetadas (demo)
document.getElementById('btnEstimarReach')?.addEventListener('click', ()=>{
  const base = 30 + Math.floor(Math.random()*200);
  document.getElementById('reach').value = base;
});
