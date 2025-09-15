// VIGIA App — lógica principal

// ===== Estado e utilidades =====
const LS_CASES = "vigia-cases-v1";
const getCases = ()=> JSON.parse(localStorage.getItem(LS_CASES)||"[]");
const setCases = (a)=> localStorage.setItem(LS_CASES, JSON.stringify(a));
const sigmoid = x => 1/(1+Math.exp(-x));

const haversine = (lat1, lon1, lat2, lon2) => {
  const toRad = d => d * Math.PI / 180;
  const R = 6371000;
  const dLat = toRad(lat2-lat1);
  const dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R*c;
};

// ===== Inicializa mapa =====
const map = L.map('map').setView([-20.3155,-40.3128], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap'
}).addTo(map);
const markerGroup = L.layerGroup().addTo(map);
map.on('click', e=>{
  document.getElementById('latlng').value = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
});

// ===== Registrar caso =====
document.getElementById('btnRegistrar').onclick = ()=>{
  const tipo = document.getElementById('tipo').value;
  const autor = document.getElementById('autor').value.trim() || "Anônimo";
  const descricao = document.getElementById('descricao').value.trim();
  const latlng = document.getElementById('latlng').value.split(',').map(Number);
  const reach = parseInt(document.getElementById('reach').value)||50;
  if(latlng.length!==2 || isNaN(latlng[0])){ alert("Local inválido."); return; }

  const id = "c"+Date.now();
  const caso = {id,tipo,autor,descricao,lat:latlng[0],lng:latlng[1],reach,createdAt:new Date().toISOString()};
  caso.iir = calcularIIR(caso);
  const arr = getCases(); arr.push(caso); setCases(arr);
  render();
};

// ===== Cálculo simples de IIR =====
function calcularIIR(caso){
  // severidade simplificada: água/esgoto/alagamento mais graves
  let s = 0.5;
  if(["agua","esgoto","alagamento"].includes(caso.tipo)) s += 0.3;
  if(caso.descricao.toLowerCase().includes("hospital")) s += 0.2;
  // persistência baseada na data (simples demo)
  const days = (Date.now() - new Date(caso.createdAt).getTime())/(24*3600*1000);
  const p = Math.min(1, days/30);
  const r = Math.min(1, Math.log10(1+caso.reach)/3);
  const z = 2.0*s + 1.5*p + 1.2*r - 1.5;
  return Math.round(sigmoid(z)*100);
}

// ===== Renderização =====
function render(){
  markerGroup.clearLayers();
  const lista = document.getElementById('listaCasos'); lista.innerHTML="";
  const arr = getCases();
  arr.forEach(c=>{
    const m = L.circleMarker([c.lat,c.lng], {radius:9,color:"#fff",weight:1,
      fillColor: c.iir>66?"#ef4444":(c.iir>33?"#f59e0b":"#22c55e"), fillOpacity:0.9});
    m.bindPopup(`<b>${c.tipo}</b><br>${c.autor}<br>IIR ${c.iir}%`);
    m.addTo(markerGroup);
    const div = document.createElement("div");
    div.className="item";
    div.innerHTML = `<h4>${c.tipo}</h4><small>${c.autor}</small><br><b>IIR ${c.iir}%</b>`;
    lista.appendChild(div);
  });
}
render();
