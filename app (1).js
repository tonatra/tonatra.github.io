// VIGIA App — lógica principal (versão com órgão responsável e import JSON)

// ===== Estado e utilidades =====
const LS_CASES = "vigia-cases-v1";
const getCases = ()=> JSON.parse(localStorage.getItem(LS_CASES)||"[]");
const setCases = (a)=> localStorage.setItem(LS_CASES, JSON.stringify(a));
const sigmoid = x => 1/(1+Math.exp(-x));

// Mapeamento de órgãos responsáveis (exemplo ES/Vitória)
const ORGAOS = {
  agua:  {nome:"Cesan (Companhia Espírito Santense de Saneamento)", fone:"115", email:"ouvidoria@cesan.com.br", url:"https://www.cesan.com.br/"},
  esgoto:{nome:"Cesan (Companhia Espírito Santense de Saneamento)", fone:"115", email:"ouvidoria@cesan.com.br", url:"https://www.cesan.com.br/"},
  luz:   {nome:"EDP Espírito Santo (Concessionária de Energia)", fone:"0800 721 0707", email:"atendimento@edp.com.br", url:"https://www.edponline.com.br/"},
  buraco:{nome:"Prefeitura de Vitória — Ouvidoria", fone:"156", email:"ouvidoria@vitoria.es.gov.br", url:"https://ouvidoria.vitoria.es.gov.br/"},
  alagamento:{nome:"Prefeitura de Vitória — Defesa Civil", fone:"199", email:"defesacivil@vitoria.es.gov.br", url:"https://vitoria.es.gov.br/defesacivil"},
  outro:{nome:"Ouvidoria Geral do Município", fone:"156", email:"ouvidoria@vitoria.es.gov.br", url:"https://ouvidoria.vitoria.es.gov.br/"}
};

function orgaoByTipo(tipo){
  return ORGAOS[tipo] || ORGAOS.outro;
}

// ===== Haversine e helpers =====
const haversine = (lat1, lon1, lat2, lon2) => {
  const toRad = d => d * Math.PI / 180;
  const R = 6371000;
  const dLat = toRad(lat2-lat1);
  const dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R*c;
};

// ===== Inicializa mapa (Leaflet) =====
let map, markerGroup;
(function initMap(){
  const el = document.getElementById('map');
  if(!el){ console.warn("Elemento #map não encontrado."); return; }
  map = L.map('map').setView([-20.3155,-40.3128], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  markerGroup = L.layerGroup().addTo(map);
  map.on('click', e=>{
    const ll = document.getElementById('latlng');
    if(ll) ll.value = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
  });
})();

// Geolocalização (se existir botão #geo)
(function bindGeo(){
  const geoBtn = document.getElementById('geo');
  if(!geoBtn) return;
  geoBtn.onclick = ()=>{
    if(!navigator.geolocation){ alert("Geolocalização indisponível."); return; }
    navigator.geolocation.getCurrentPosition(pos=>{
      const {latitude, longitude} = pos.coords;
      const ll = document.getElementById('latlng');
      if(ll) ll.value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      if(map) map.setView([latitude, longitude], 15);
    }, err=> alert("Erro ao obter localização: "+err.message));
  };
})();

// ===== Cálculo de IIR =====
function calcularIIR(caso){
  // severidade simplificada
  let s = 0.5;
  if(["agua","esgoto","alagamento"].includes(caso.tipo)) s += 0.3;
  if((caso.descricao||caso.desc||"").toLowerCase().includes("hospital")) s += 0.1;
  // persistência simplificada (se não houver histórico, usa 0.3)
  const days = caso.createdAt ? (Date.now() - new Date(caso.createdAt).getTime())/(24*3600*1000) : 0;
  const p = isFinite(days) ? Math.min(1, days/30) : 0.3;
  // alcance
  const reach = parseInt(caso.reach||caso.pessoas||50) || 50;
  const r = Math.min(1, Math.log10(1+reach)/3);
  const z = 2.0*s + 1.2*p + 1.1*r - 1.8;
  return Math.round(sigmoid(z)*100);
}

// ===== Enriquecimento do caso (IIR + órgão) =====
function enrichCase(c){
  if(!c.createdAt) c.createdAt = new Date().toISOString();
  if(c.iir===undefined) c.iir = calcularIIR(c);
  if(!c.responsavel){
    const org = orgaoByTipo(c.tipo||"outro");
    c.responsavel = org.nome;
    c.contato = {fone:org.fone, email:org.email, url:org.url};
  }
  return c;
}

// ===== Registrar caso =====
const btnRegistrar = document.getElementById('btnRegistrar');
if(btnRegistrar){
  btnRegistrar.onclick = ()=>{
    const tipo = document.getElementById('tipo').value;
    const autor = (document.getElementById('autor')?.value.trim()) || "Anônimo";
    const descricao = document.getElementById('descricao').value.trim();
    const latlngStr = document.getElementById('latlng').value;
    const reach = parseInt(document.getElementById('reach').value)||50;

    const [lat, lng] = (latlngStr||"").split(',').map(Number);
    if(!isFinite(lat)||!isFinite(lng)){ alert("Local inválido. Clique no mapa ou use 'Minha localização'."); return; }

    // Foto (opcional)
    const file = document.getElementById('foto')?.files?.[0];
    const addCase = (photoData)=>{
      const id = "c"+Date.now();
      const caso = enrichCase({id,tipo,autor,descricao,lat,lng,reach,createdAt:new Date().toISOString(), foto:photoData||null});
      const arr = getCases(); arr.push(caso); setCases(arr);
      render();
      // feedback visual: mostrar órgão/contato
      alert(`Órgão responsável:\n${caso.responsavel}\nTelefone: ${caso.contato?.fone||"-"}\nEmail: ${caso.contato?.email||"-"}\nSite: ${caso.contato?.url||"-"}`);
    };

    if(file){
      const rd = new FileReader();
      rd.onload = ()=> addCase(rd.result);
      rd.readAsDataURL(file);
    } else {
      addCase(null);
    }
  };
}

// ===== Filtros =====
let filtroTipo = "todos";
let filtroIIR  = 0;
(function bindFilters(){
  const fTipoEl = document.getElementById('filtroTipo');
  const fIIREl  = document.getElementById('filtroIIR');
  if(fTipoEl) fTipoEl.onchange = ()=>{ filtroTipo = fTipoEl.value; render(); };
  if(fIIREl)  fIIREl.oninput  = ()=>{ filtroIIR  = parseInt(fIIREl.value||"0"); render(); };
})();

// ===== Renderização =====
function corIIR(v){ if(v>=66) return "#ef4444"; if(v>=33) return "#f59e0b"; return "#22c55e"; }

function render(){
  // avatar (se existir)
  try{
    const u = JSON.parse(localStorage.getItem("vigia-user-v1")||"null");
    const av = document.getElementById('navAvatar'); if(av) av.src = u?.photo||"";
  }catch{}

  // mapa
  if(markerGroup) markerGroup.clearLayers();

  const lista = document.getElementById('listaCasos');
  if(lista) lista.innerHTML = "";

  const arr = getCases();
  const filtered = arr.filter(c=>{
    const tipoOk = (filtroTipo==="todos" || c.tipo===filtroTipo);
    const iirOk  = (c.iir||0) >= filtroIIR;
    return tipoOk && iirOk;
  });

  filtered.forEach(c=>{
    // marker
    if(markerGroup && isFinite(c.lat) && isFinite(c.lng)){
      const m = L.circleMarker([c.lat,c.lng], {radius:9,color:"#fff",weight:1,
        fillColor: corIIR(c.iir), fillOpacity:0.9});
      const contatos = c.contato||{};
      const linkSite = contatos.url ? `<br><a href="${contatos.url}" target="_blank">Site</a>` : "";
      const linkFone = contatos.fone ? `<br><a href="tel:${contatos.fone.replace(/\s+/g,'')}">Ligar: ${contatos.fone}</a>` : "";
      const linkMail = contatos.email ? `<br><a href="mailto:${contatos.email}">Email</a>` : "";
      m.bindPopup(`<b>${c.titulo||c.tipo}</b><br>${c.autor||"Autor desconhecido"}<br>IIR ${c.iir}%<br><small>${c.descricao||c.desc||""}</small><br><b>Órgão:</b> ${c.responsavel||"-"}${linkFone}${linkMail}${linkSite}`);
      m.addTo(markerGroup);
    }
    // lista lateral
    if(lista){
      const div = document.createElement("div");
      div.className="item";
      const contatos = c.contato||{};
      const parts = [];
      if(contatos.fone) parts.push(`<a href="tel:${contatos.fone.replace(/\s+/g,'')}">${contatos.fone}</a>`);
      if(contatos.email) parts.push(`<a href="mailto:${contatos.email}">${contatos.email}</a>`);
      if(contatos.url) parts.push(`<a href="${contatos.url}" target="_blank">site</a>`);
      div.innerHTML = `<h4>${c.titulo||c.tipo}</h4>
        <div class="pill">IIR ${c.iir}%</div>
        <div style="font-size:12px;color:#9ca3af;margin-top:4px">
          Órgão responsável: <b>${c.responsavel||"-"}</b>${parts.length?` — ${parts.join(" · ")}`:""}
        </div>`;
      lista.appendChild(div);
    }
  });
}
render();

// ===== Import automático de denuncias_vitoria.json (se existir) =====
(async function autoImportSeed(){
  try{
    if(getCases().length) return; // não sobrescreve se já tiver dados
    const resp = await fetch("./denuncias_vitoria.json", {cache:"no-store"});
    if(!resp.ok) return;
    const data = await resp.json();
    if(Array.isArray(data)){
      const enriched = data.map(d=>{
        // padroniza campos (alguns registros usam 'descricao' e não 'desc')
        if(d.lat===undefined && typeof d.latlng==="string"){
          const [lat,lng] = d.latlng.split(",").map(Number);
          d.lat = lat; d.lng = lng;
        }
        d = enrichCase(d);
        return d;
      });
      setCases(enriched);
      render();
    }
  }catch(e){
    console.warn("Sem seed JSON ou erro ao importar:", e);
  }
})();