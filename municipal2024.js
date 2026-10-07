'use strict';
(() => {
  const q = new URL(location.href);
  const year = q.searchParams.get('eleicao') === '2024' ? '2024' : '2026';
  window.APP_ELECTION_YEAR = year;

  const cargoCard = document.getElementById('cargo')?.closest('.card');
  if(cargoCard && !document.getElementById('eleicao')){
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="label">Eleição</div><select id="eleicao"><option value="2026">2026 · Geral</option><option value="2024">2024 · Municipal</option></select>`;
    cargoCard.insertBefore(wrap, cargoCard.firstChild);
    const sel = document.getElementById('eleicao');
    sel.value = year;
    sel.onchange = () => {
      const u = new URL(location.href);
      u.search = '';
      u.searchParams.set('eleicao', sel.value);
      location.href = u.pathname + u.search;
    };
  }

  if(year !== '2024') return;

  let city = null;
  let cityData = null;
  let validMunicipal = 0;
  let currentTurn = '1';
  let m24Token = 0;
  let secData = null;
  let secRows = [];
  let secTab = 'bairro';
  let secFilter = '';
  let secBairro = '';
  let secCandidate = '';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const candidateLabel = c => `${c.urna || c.official || 'Sem nome'} · Nº ${c.number}${c.party ? ' · ' + c.party : ''}`;
  const cargoLabel = () => cargo === '11' ? 'Prefeito' : 'Vereador';

  token++;
  loading = false;
  cargo = '11';
  cands = [];
  current = null;
  stateValid = 0;
  mun = new Map();
  failed = new Set();
  selected = '';

  document.title = 'Eleições ES 2024 e 2026 — Uildo Marques Avila (Tupan)';
  const h1 = document.querySelector('.panel h1');
  if(h1) h1.textContent = 'Eleições 2024 · ES';
  const intro = h1?.nextElementSibling;
  if(intro) intro.textContent = 'Resultados municipais de Prefeito e Vereador no Espírito Santo.';

  const cargoSel = $('cargo');
  cargoSel.innerHTML = '<option value="11">Prefeito</option><option value="13">Vereador</option>';
  cargoSel.value = '11';

  const cargoLabelNode = cargoSel.previousElementSibling;
  if(cargoLabelNode?.classList.contains('label')) cargoLabelNode.style.marginTop = '8px';

  const turnoWrap = document.createElement('div');
  turnoWrap.id = 'm24TurnoWrap';
  turnoWrap.innerHTML = `<div class="label" style="margin-top:8px">Turno</div><select id="m24Turno"><option value="1">1º turno</option><option value="2">2º turno</option></select>`;
  cargoSel.insertAdjacentElement('afterend', turnoWrap);

  const candLabel = $('busca')?.previousElementSibling;
  if(candLabel) candLabel.textContent = 'Candidato do município';
  $('busca').placeholder = 'Primeiro clique em um município no mapa';
  $('busca').disabled = true;
  $('cand').innerHTML = '<option>Escolha um município</option>';
  $('cand').disabled = true;
  $('candBox').style.display = 'none';

  const statLabels = document.querySelectorAll('#candBox .stat .label');
  if(statLabels[0]) statLabels[0].textContent = 'Votos no município';
  if(statLabels[1]) statLabels[1].textContent = '% válidos no município';
  document.querySelector('#candBox .row2')?.style.setProperty('display','none');
  document.querySelector('#candBox .progress')?.style.setProperty('display','none');
  if($('progT')) $('progT').style.display = 'none';
  if($('retry')) $('retry').style.display = 'none';
  document.querySelector('.card.top')?.style.setProperty('display','none');
  $('leg').style.display = 'none';
  $('titulo').textContent = 'Espírito Santo · 78 municípios · Eleições Municipais 2024';
  $('status').textContent = 'Clique em um município';
  $('det').innerHTML = '<div class="muted">Clique em um município no mapa para consultar Prefeito ou Vereador.</div>';
  const source = [...document.querySelectorAll('.panel > .muted')].at(-1);
  if(source) source.innerHTML = '<b>Fonte:</b> resultados oficiais do TSE · Eleições Municipais 2024.';

  const style = document.createElement('style');
  style.textContent = `
#m24TurnoWrap select{margin-top:6px}.m24hint{padding:8px;border-radius:8px;background:#eff6ff;color:#344054;font-size:10px;font-weight:700;margin-top:7px}.m24open{margin-top:7px!important;background:#155eef!important;color:white!important;border-color:#155eef!important}
.m24back{display:none;position:fixed;inset:0;z-index:260;background:rgba(15,23,42,.62);padding:3vh 3vw;align-items:center;justify-content:center}.m24back.show{display:flex}.m24panel{width:min(1120px,96vw);height:min(92vh,880px);background:#fff;border-radius:16px;box-shadow:0 18px 60px #0005;display:flex;flex-direction:column;overflow:hidden;min-height:0}.m24head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:14px 16px;border-bottom:1px solid #e5eaf1;flex:0 0 auto}.m24title{font-size:18px;font-weight:900}.m24sub{font-size:11px;color:#667085;margin-top:3px}.m24close{width:34px;height:34px;padding:0;border:0;border-radius:99px;background:#eef2f7;font-size:20px;font-weight:900;cursor:pointer;flex:0 0 auto}.m24controls{padding:10px 14px;border-bottom:1px solid #e5eaf1;background:#f8fafc;flex:0 0 auto}.m24candlabel{font-size:9px;font-weight:900;color:#475467;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px}.m24candtools{display:grid;grid-template-columns:minmax(180px,.8fr) minmax(280px,1.2fr);gap:6px;margin-bottom:8px}.m24candtools input,.m24candtools select{margin:0!important;padding:8px!important;font-size:11px!important}.m24tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.m24tab{margin:0;font-size:11px;font-weight:800;cursor:pointer}.m24tab.active{background:#172b4d;color:#fff;border-color:#172b4d}.m24search{margin-top:8px!important}.m24body{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;padding:10px 14px;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior:contain}.m24notice{font-size:10px;color:#667085;padding:8px 14px;border-top:1px solid #e5eaf1;background:#f8fafc;flex:0 0 auto}.m24row{display:grid;grid-template-columns:minmax(180px,1fr) 100px 100px 80px 26px;gap:8px;align-items:center;width:100%;margin:0;border:0;border-bottom:1px solid #edf1f5;border-radius:0;padding:10px 6px;background:#fff;color:#172033;font:inherit;text-align:left}.m24bairro{cursor:pointer}.m24bairro:hover,.m24bairro:focus{background:#eef6ff;outline:2px solid #93c5fd;outline-offset:-2px}.m24main b{font-size:12px}.m24meta{font-size:9px;color:#667085;margin-top:2px;line-height:1.3}.m24vote,.m24pct,.m24count{text-align:right;font-weight:800;font-size:11px}.m24arrow{text-align:center;font-size:22px;font-weight:900;color:#155eef}.m24empty{padding:28px 8px;text-align:center;color:#667085;font-size:12px}.m24backbtn{width:auto;margin:0 0 8px;padding:7px 10px;font-size:10px;font-weight:800;background:#eef2f7;cursor:pointer}.m24bairrotitle{font-size:13px;font-weight:900;margin:2px 0 8px}
@media(max-width:850px){.m24back{padding:0;align-items:stretch}.m24panel{width:100%;height:100dvh;max-height:100dvh;border-radius:0}.m24head{padding:10px 11px}.m24title{font-size:16px}.m24controls{padding:7px 8px}.m24candtools{grid-template-columns:1fr;gap:4px;margin-bottom:7px}.m24body{padding:6px 8px;overflow-y:scroll!important;-webkit-overflow-scrolling:touch!important}.m24row{grid-template-columns:minmax(0,1fr) 70px 65px 22px;gap:5px;padding:10px 4px}.m24count{display:none}.m24vote,.m24pct{font-size:10px}.m24arrow{font-size:20px}.m24tab{padding:8px 4px;font-size:10px}.m24notice{padding-bottom:max(8px,env(safe-area-inset-bottom))}}
`;
  document.head.appendChild(style);

  document.body.insertAdjacentHTML('beforeend', `
    <div class="m24back" id="m24Back">
      <section class="m24panel" role="dialog" aria-modal="true" aria-labelledby="m24Title">
        <div class="m24head"><div><div class="m24title" id="m24Title">Bairros e seções</div><div class="m24sub" id="m24Sub"></div></div><button class="m24close" id="m24Close">×</button></div>
        <div class="m24controls">
          <div class="m24candlabel">Trocar candidato sem voltar</div>
          <div class="m24candtools"><input id="m24CandSearch" placeholder="Buscar nome, número ou partido"><select id="m24CandSelect"></select></div>
          <div class="m24tabs"><button class="m24tab active" data-m24tab="bairro">Bairros</button><button class="m24tab" data-m24tab="local">Locais</button><button class="m24tab" data-m24tab="secao">Seções</button></div>
          <input class="m24search" id="m24Search" placeholder="Buscar bairro, local, zona ou seção">
        </div>
        <div class="m24body" id="m24Body"><div class="m24empty">Selecione um município.</div></div>
        <div class="m24notice">Bairro = bairro do local de votação. Isso não identifica necessariamente o bairro de residência do eleitor. Fonte: TSE.</div>
      </section>
    </div>`);

  function electionCode(){ return currentTurn === '2' ? '620' : '619'; }
  function resultURL(m){
    const e = electionCode();
    const cc = cargo === '13' ? '0013' : '0011';
    return `https://resultados.tse.jus.br/oficial/ele2024/${e}/dados/es/es${m.tse}-c${cc}-e${String(e).padStart(6,'0')}-u.json`;
  }

  function neutralMap(){
    Object.values(paths || {}).forEach(p => p.setAttribute('fill','#bfdbfe'));
    $('leg').style.display = 'none';
  }
  setTimeout(neutralMap, 300);
  setTimeout(neutralMap, 1000);

  function markCity(k){
    document.querySelectorAll('.mun.sel').forEach(x => x.classList.remove('sel'));
    if(paths[k]) paths[k].classList.add('sel');
  }

  function fillCandidates(query=''){
    const z = norm(query);
    const arr = (cands || []).filter(x => !z || norm(`${x.urna} ${x.official} ${x.number} ${x.party}`).includes(z));
    $('cand').innerHTML = arr.length ? arr.map(x => `<option value="${esc(x.number)}">${esc(candidateLabel(x))}</option>`).join('') : '<option value="">Nenhum candidato encontrado</option>';
    if(arr.length){
      $('cand').value = arr[0].number;
      setMunicipalCandidate(arr[0].number);
    }
  }

  function setMunicipalCandidate(n){
    current = (cands || []).find(x => String(x.number) === String(n));
    if(!current || !city) return;
    $('candBox').style.display = 'block';
    $('nome').textContent = current.urna;
    $('oficial').textContent = current.official && norm(current.official) !== norm(current.urna) ? 'Nome completo: ' + current.official : '';
    $('num').textContent = `Nº ${current.number}${current.party ? ' · ' + current.party : ''}${current.elected ? ' · ELEITO(A)' : ''}`;
    $('vES').textContent = fmt(current.votes);
    $('pES').textContent = pct(validMunicipal ? current.votes / validMunicipal * 100 : 0);
    renderCityDetails();
  }

  function renderCityDetails(){
    if(!city || !current) return;
    const p = validMunicipal ? current.votes / validMunicipal * 100 : 0;
    const html = `<div><b>${esc(city.municipio)}</b><b>${fmt(current.votes)} votos</b></div><div><span>% dos válidos no município</span><b>${pct(p)}</b></div><div><span>Eleição</span><b>2024 · ${currentTurn}º turno</b></div><button class="btn m24open" id="m24OpenSide">Ver bairros, locais e seções</button>`;
    $('det').innerHTML = html;
    const md = $('mapDet');
    if(md){
      md.classList.add('show');
      $('mapWrap')?.classList.add('hasdetail');
      md.innerHTML = `<div class="mdhead"><div><div class="mdcity">${esc(city.municipio)}</div><div class="small">${esc(current.urna)}${current.party ? ' · ' + esc(current.party) : ''} · ${cargoLabel()}</div></div><button class="mdclose" id="mdClose">×</button></div><div class="mdrow"><span>Votos</span><b>${fmt(current.votes)}</b></div><div class="mdrow"><span>% válidos</span><b>${pct(p)}</b></div><button class="btn m24open" id="m24OpenMap">Ver bairros, locais e seções</button>`;
      $('mdClose').onclick = e => { e.stopPropagation(); md.classList.remove('show'); $('mapWrap')?.classList.remove('hasdetail'); };
      $('m24OpenMap').onclick = e => { e.stopPropagation(); openSections(); };
    }
    $('m24OpenSide').onclick = openSections;
  }

  async function loadCity(m){
    if(!m) return;
    const my = ++m24Token;
    city = m;
    selected = m.norm;
    markCity(m.norm);
    current = null;
    cands = [];
    cityData = null;
    validMunicipal = 0;
    mun = new Map();
    $('candBox').style.display = 'none';
    $('busca').disabled = true;
    $('cand').disabled = true;
    $('cand').innerHTML = '<option>Carregando candidatos...</option>';
    $('det').innerHTML = `<div class="muted"><b>${esc(m.municipio)}</b><br>Carregando ${cargoLabel().toLowerCase()}s de 2024...</div>`;
    $('status').textContent = `${m.municipio} · carregando ${cargoLabel()}`;
    try{
      const r = await fetch(resultURL(m), {cache:'force-cache', mode:'cors'});
      if(!r.ok) throw Error(String(r.status));
      const d = await r.json();
      if(my !== m24Token) return;
      cityData = d;
      validMunicipal = num(d?.v?.vv ?? d?.vv ?? d?.vnom ?? d?.vvc);
      cands = flat(d);
      mun.set(m.tse, parseMun(d));
      if(!cands.length) throw Error('sem candidatos');
      $('busca').disabled = false;
      $('cand').disabled = false;
      $('busca').value = '';
      $('busca').placeholder = `Buscar ${cargoLabel().toLowerCase()} em ${m.municipio}`;
      fillCandidates('');
      $('status').textContent = `${m.municipio} · ${cargoLabel()} · ${currentTurn}º turno`;
    }catch(e){
      if(my !== m24Token) return;
      $('cand').innerHTML = '<option>Sem dados</option>';
      const msg = currentTurn === '2' ? 'Este município pode não ter tido 2º turno para Prefeito.' : 'Não foi possível carregar os resultados do TSE.';
      $('det').innerHTML = `<div class="err"><b>${esc(m.municipio)}</b><br>${msg}</div>`;
      $('status').textContent = `${m.municipio} · sem dados para esta seleção`;
    }
  }

  const showMunicipal = function(k){
    const m = MUNICIPIOS.find(x => x.norm === k);
    if(m) loadCity(m);
  };
  show = showMunicipal;

  cargoSel.onchange = () => {
    cargo = cargoSel.value;
    if(cargo === '13'){
      currentTurn = '1';
      $('m24Turno').value = '1';
      $('m24Turno').disabled = true;
    }else{
      $('m24Turno').disabled = false;
      currentTurn = $('m24Turno').value;
    }
    if(city) loadCity(city);
    else $('status').textContent = 'Clique em um município';
  };
  $('m24Turno').onchange = e => {
    currentTurn = e.target.value;
    if(cargo === '13'){ currentTurn = '1'; e.target.value = '1'; }
    if(city) loadCity(city);
  };
  $('busca').oninput = e => fillCandidates(e.target.value);
  $('cand').onchange = e => setMunicipalCandidate(e.target.value);

  function pairMap(arr){
    const m = new Map();
    for(const p of arr || []) if(Array.isArray(p) && p.length > 1) m.set(Number(p[0]), Number(p[1] || 0));
    return m;
  }
  function secRowsFor(data, candidateNumber){
    const ck = String(cargo);
    const vm = pairMap(data?.vv?.[ck]);
    const key = String(Number(String(candidateNumber || '').replace(/\D/g,'')) || '');
    const cm = pairMap(data?.v?.[ck]?.[key] || data?.v?.[ck]?.[String(candidateNumber)] || []);
    return (data?.s || []).map((s,i) => {
      const vv = vm.get(i) || 0, v = cm.get(i) || 0;
      return {...s,idx:i,vv,v,p:vv?v/vv*100:0,b:s.b||'Bairro não informado',n:s.n||'Local de votação',e:s.e||''};
    });
  }
  function aggregate(rs,keyFn,labelFn){
    const mp = new Map();
    for(const r of rs){
      const k=keyFn(r); let x=mp.get(k);
      if(!x){x={key:k,label:labelFn(r),v:0,vv:0,count:0,locais:new Set(),bairro:r.b||''};mp.set(k,x)}
      x.v+=r.v;x.vv+=r.vv;x.count++;x.locais.add(`${r.z}|${r.l}|${r.n}`);
    }
    return [...mp.values()].map(x=>({...x,p:x.vv?x.v/x.vv*100:0,localCount:x.locais.size}));
  }
  function match(text){ return !secFilter || norm(text).includes(norm(secFilter)); }
  function activateTab(){ document.querySelectorAll('[data-m24tab]').forEach(b=>b.classList.toggle('active',b.dataset.m24tab===secTab)); }

  function fillModalCandidates(query=''){
    const z=norm(query); const arr=(cands||[]).filter(c=>!z||norm(`${c.urna} ${c.official} ${c.number} ${c.party}`).includes(z));
    const sel=$('m24CandSelect');
    sel.innerHTML=arr.length?arr.map(c=>`<option value="${esc(c.number)}">${esc(candidateLabel(c))}</option>`).join(''):'<option value="">Nenhum candidato encontrado</option>';
    if(arr.length){
      const wanted=arr.find(c=>String(c.number)===String(secCandidate))||arr[0];
      sel.value=String(wanted.number);
      if(String(wanted.number)!==String(secCandidate)) changeModalCandidate(wanted.number,false);
    }
  }

  function changeModalCandidate(n,syncMain=true){
    if(!n || !secData) return;
    secCandidate=String(n);
    secRows=secRowsFor(secData,secCandidate);
    const c=(cands||[]).find(x=>String(x.number)===secCandidate);
    if(c) $('m24Sub').textContent=`${c.urna} · Nº ${c.number}${c.party?' · '+c.party:''} · ${cargoLabel()} · ${currentTurn}º turno`;
    renderSections();
    if(syncMain){
      $('cand').value=secCandidate;
      setMunicipalCandidate(secCandidate);
    }
  }

  function renderSections(){
    const body=$('m24Body'); if(!body) return;
    if(secTab==='bairro'){
      const arr=aggregate(secRows,r=>norm(r.b),r=>r.b).filter(x=>match(x.label)).sort((a,b)=>b.v-a.v||b.p-a.p);
      body.innerHTML=arr.length?arr.map((x,i)=>`<button type="button" class="m24row m24bairro" data-b="${esc(x.label)}"><div class="m24main"><b>${i+1}. ${esc(x.label)}</b><div class="m24meta">${x.count} seção(ões) · ${x.localCount} local(is)</div></div><div class="m24vote">${fmt(x.v)} votos</div><div class="m24pct">${pct(x.p)}</div><div class="m24count">${fmt(x.vv)} válidos</div><span class="m24arrow">›</span></button>`).join(''):'<div class="m24empty">Nenhum bairro encontrado.</div>';
    }else if(secTab==='local'){
      const arr=aggregate(secRows,r=>`${r.z}|${r.l}|${norm(r.n)}`,r=>r.n).filter(x=>match(x.label+' '+x.bairro)).sort((a,b)=>b.v-a.v||b.p-a.p);
      body.innerHTML=arr.length?arr.map((x,i)=>`<div class="m24row"><div class="m24main"><b>${i+1}. ${esc(x.label)}</b><div class="m24meta">${esc(x.bairro)} · ${x.count} seção(ões)</div></div><div class="m24vote">${fmt(x.v)} votos</div><div class="m24pct">${pct(x.p)}</div><div class="m24count">${fmt(x.vv)} válidos</div><span></span></div>`).join(''):'<div class="m24empty">Nenhum local encontrado.</div>';
    }else{
      const arr=secRows.filter(r=>(!secBairro||r.b===secBairro)&&match(`${r.b} ${r.n} ${r.e} ${r.z} ${r.s}`)).sort((a,b)=>b.v-a.v||b.p-a.p);
      const back=secBairro?`<button class="m24backbtn" id="m24BackBairro">← Todos os bairros</button><div class="m24bairrotitle">${esc(secBairro)}</div>`:'';
      body.innerHTML=back+(arr.length?arr.map((r,i)=>`<div class="m24row"><div class="m24main"><b>${i+1}. Zona ${r.z} · Seção ${r.s}</b><div class="m24meta">${esc(r.n)} · ${esc(r.b)}${r.e?' · '+esc(r.e):''}</div></div><div class="m24vote">${fmt(r.v)} votos</div><div class="m24pct">${pct(r.p)}</div><div class="m24count">${fmt(r.vv)} válidos</div><span></span></div>`).join(''):'<div class="m24empty">Nenhuma seção encontrada.</div>');
    }
    body.scrollTop=0;
  }

  async function openSections(){
    if(!city || !current) return;
    secTab='bairro';secFilter='';secBairro='';secCandidate=String(current.number);secData=null;secRows=[];
    $('m24Back').classList.add('show');document.body.style.overflow='hidden';
    $('m24Title').textContent=`${city.municipio} · bairros e seções`;
    $('m24Sub').textContent=`${current.urna} · Nº ${current.number}${current.party?' · '+current.party:''} · ${cargoLabel()} · ${currentTurn}º turno`;
    $('m24Search').value='';$('m24CandSearch').value='';activateTab();fillModalCandidates('');
    $('m24Body').innerHTML='<div class="m24empty">Carregando dados oficiais por seção…</div>';
    try{
      const r=await fetch(`data/2024/secoes/${currentTurn}/${city.tse}.json?v=20241007`,{cache:'force-cache'});
      if(!r.ok) throw Error(String(r.status));
      secData=await r.json();
      secRows=secRowsFor(secData,secCandidate);
      renderSections();
    }catch(e){
      $('m24Body').innerHTML='<div class="m24empty"><b>Os totais municipais já estão disponíveis.</b><br><br>A base de bairros, locais e seções de 2024 ainda está sendo preparada ou não existe para este turno.</div>';
    }
  }
  function closeSections(){ $('m24Back').classList.remove('show');document.body.style.overflow=''; }

  $('m24Close').onclick=closeSections;
  $('m24Back').onclick=e=>{if(e.target===$('m24Back'))closeSections()};
  document.querySelectorAll('[data-m24tab]').forEach(b=>b.onclick=()=>{secTab=b.dataset.m24tab;secBairro='';activateTab();renderSections()});
  $('m24Search').oninput=e=>{secFilter=e.target.value;renderSections()};
  $('m24CandSearch').oninput=e=>fillModalCandidates(e.target.value);
  $('m24CandSelect').onchange=e=>changeModalCandidate(e.target.value,true);
  $('m24Body').onclick=e=>{
    const b=e.target.closest('.m24bairro');
    if(b){secBairro=b.dataset.b;secTab='secao';activateTab();renderSections();return}
    if(e.target.closest('#m24BackBairro')){secBairro='';secTab='bairro';activateTab();renderSections()}
  };
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSections()});
})();
