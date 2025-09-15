// Funções "IA" demonstráveis (sem libs externas)

// 1) Classificador simples por palavras-chave (demo)
const KEYWORDS = {
  agua: ["água","agua","abastecimento","hidráulica","hidraulica","torneira","adutora"],
  esgoto: ["esgoto","esgoto a céu aberto","esgoto a ceu aberto","rede de esgoto","esgotamento"],
  luz: ["luz","energia","falta de luz","queda de energia","apagão","apagao"],
  buraco: ["buraco","asfalto","cratera","pista danificada","via"],
  alagamento: ["alagamento","enchente","alagar","alagou","ponto de alagamento"],
};
function classificar(texto){
  const t = (texto||"").toLowerCase();
  let best = {tipo:"outro", score:0};
  for(const [tipo, words] of Object.entries(KEYWORDS)){
    let s=0; for(const w of words){ if(t.includes(w)) s++; }
    if(s>best.score) best = {tipo, score:s};
  }
  return best.tipo;
}

// 2) IIR (mesma lógica do app, parametrizada)
const sigmoid = x => 1/(1+Math.exp(-x));
function calcIIR_demo({dias=0, pessoas=50, texto=""}){
  let s=0.5;
  if(/água|agua|esgoto|alagamento/i.test(texto)) s+=0.3;
  if(/escola|hospital|posto de saúde|posto de saude/i.test(texto)) s+=0.1;
  const p = Math.min(1, Math.max(0.3, (dias||0)/30));
  const r = Math.min(1, Math.log10(1+(pessoas||50))/3);
  const z = 2.0*s + 1.2*p + 1.1*r - 1.8;
  return Math.round(sigmoid(z)*100);
}

// 3) Deduplicação: similaridade de texto (Jaccard) + distância geográfica (Haversine)
function tokens(s){ return (s||"").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"").split(/[^a-z0-9]+/).filter(Boolean); }
function jaccard(a,b){
  const A=new Set(tokens(a)), B=new Set(tokens(b));
  const inter=[...A].filter(x=>B.has(x)).length; const uni=new Set([...A,...B]).size;
  return uni? inter/uni : 0;
}
function hav(lat1, lon1, lat2, lon2){
  const toRad = d => d * Math.PI / 180, R = 6371000;
  const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function isDuplicate({aText,bText,aLat,aLon,bLat,bLon, simMin=0.55, distMax=300}){
  const sim = jaccard(aText,bText);
  const dist = (isFinite(aLat)&&isFinite(aLon)&&isFinite(bLat)&&isFinite(bLon))? hav(aLat,aLon,bLat,bLon) : Infinity;
  return { duplicate: sim>=simMin && dist<=distMax, sim:+sim.toFixed(3), dist: isFinite(dist)? Math.round(dist): null };
}

// ====== Ligações com a UI ======
document.getElementById("btnClass").onclick = ()=>{
  const t = document.getElementById("txt").value;
  const tipo = classificar(t);
  document.getElementById("outClass").textContent = "Tipo estimado: " + tipo;
};
document.getElementById("btnIIR").onclick = ()=>{
  const dias = parseInt(document.getElementById("days").value)||0;
  const pessoas = parseInt(document.getElementById("reach").value)||50;
  const texto = document.getElementById("txtIIR").value||"";
  const iir = calcIIR_demo({dias,pessoas,texto});
  document.getElementById("outIIR").textContent = "IIR estimado: " + iir + "%";
};
document.getElementById("btnDup").onclick = ()=>{
  const a = document.getElementById("a").value||"";
  const b = document.getElementById("b").value||"";
  const alat = parseFloat(document.getElementById("alat").value), alon = parseFloat(document.getElementById("alon").value);
  const blat = parseFloat(document.getElementById("blat").value), blon = parseFloat(document.getElementById("blon").value);
  const r = isDuplicate({aText:a,bText:b,aLat:alat,aLon:alon,bLat:blat,bLon:blon});
  document.getElementById("outDup").textContent = JSON.stringify(r, null, 2);
};
