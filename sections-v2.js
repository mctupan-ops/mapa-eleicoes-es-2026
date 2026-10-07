'use strict';
(() => {
  let sectionCache = new Map();
  let secState = null;
  let secTab = 'bairro';
  let secFilter = '';
  let secBairroFilter = '';
  let secCandFilter = '';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  function pairMap(arr){
    const m = new Map();
    for(const p of arr || []){
      if(Array.isArray(p) && p.length > 1) m.set(Number(p[0]), Number(p[1] || 0));
    }
    return m;
  }

  function candidateDataKey(n){
    const s = String(n ?? '').replace(/\D/g,'');
    return s ? String(Number(s)) : '';
  }

  function sectionRows(data){
    const vm = pairMap(data?.vv?.[cargo]);
    const key = candidateDataKey(current?.number);
    const raw = data?.v?.[cargo]?.[key] ?? data?.v?.[cargo]?.[String(current?.number)] ?? [];
    const cm = pairMap(raw);
    return (data?.s || []).map((s,i) => {
      const vv = vm.get(i) || 0;
      const v = cm.get(i) || 0;
      return {
        ...s,
        idx:i,
        vv,
        v,
        p:vv ? v / vv * 100 : 0,
        b:s.b || 'Bairro não informado',
        n:s.n || 'Local de votação',
        e:s.e || ''
      };
    });
  }

  function aggregate(rs,keyFn,labelFn){
    const mp = new Map();
    for(const r of rs){
      const k = keyFn(r);
      let x = mp.get(k);
      if(!x){
        x = {key:k,label:labelFn(r),v:0,vv:0,count:0,locais:new Set(),bairro:r.b || ''};
        mp.set(k,x);
      }
      x.v += r.v;
      x.vv += r.vv;
      x.count++;
      x.locais.add(`${r.z}|${r.l}|${r.n}`);
    }
    return [...mp.values()].map(x => ({...x,p:x.vv ? x.v / x.vv * 100 : 0,localCount:x.locais.size}));
  }

  function secMatch(text){
    return !secFilter || norm(text).includes(norm(secFilter));
  }

  function activateSecTab(){
    document.querySelectorAll('[data-sectab]').forEach(b => {
      b.classList.toggle('active', b.dataset.sectab === secTab);
    });
  }

  function candidateLabel(c){
    return `${c.urna || c.official || 'Sem nome'} · Nº ${c.number}${c.party ? ' · ' + c.party : ''}`;
  }

  function filteredCandidates(){
    const q = norm(secCandFilter || '');
    return (cands || []).filter(c => !q || norm(`${c.urna || ''} ${c.official || ''} ${c.number || ''} ${c.party || ''}`).includes(q));
  }

  function fillCandidateSelect(){
    const sel = $('secCandSelect');
    if(!sel) return;
    const arr = filteredCandidates();
    sel.innerHTML = arr.length
      ? arr.map(c => `<option value="${esc(c.number)}">${esc(candidateLabel(c))}</option>`).join('')
      : '<option value="">Nenhum candidato encontrado</option>';
    if(current && arr.some(c => String(c.number) === String(current.number))) sel.value = String(current.number);
  }

  function refreshCandidateHeader(){
    if(!current) return;
    const sub = $('secSub');
    if(sub) sub.textContent = `${current.urna} · Nº ${current.number}${current.party ? ' · ' + current.party : ''} · ${cfg().l}`;
    fillCandidateSelect();
  }

  function renderSectionsView(){
    if(!secState) return;
    const body = $('secBody');
    if(!body) return;
    const all = secState.rows;

    if(secTab === 'bairro'){
      const arr = aggregate(all,r=>norm(r.b),r=>r.b)
        .filter(x => secMatch(x.label))
        .sort((a,b) => b.v-a.v || b.p-a.p);

      body.innerHTML = '<div class="sechint">Clique ou toque em um bairro para ver as seções daquele bairro.</div>' +
        (arr.length ? arr.map((x,i) => `
          <button type="button" class="secrow secbairro" data-b="${esc(x.label)}">
            <div class="secmain"><b>${i+1}. ${esc(x.label)}</b><div class="secmeta">${x.count} seção(ões) · ${x.localCount} local(is)</div></div>
            <div class="secvote">${fmt(x.v)} votos</div>
            <div class="secpct">${pct(x.p)}</div>
            <div class="seccount">${fmt(x.vv)} válidos</div>
            <span class="secarrow">›</span>
          </button>`).join('') : '<div class="secempty">Nenhum bairro encontrado.</div>');
    }
    else if(secTab === 'local'){
      const arr = aggregate(all,r=>`${r.z}|${r.l}|${norm(r.n)}`,r=>r.n)
        .filter(x => secMatch(x.label + ' ' + x.bairro))
        .sort((a,b) => b.v-a.v || b.p-a.p);

      body.innerHTML = arr.length ? arr.map((x,i) => `
        <div class="secrow secstatic">
          <div class="secmain"><b>${i+1}. ${esc(x.label)}</b><div class="secmeta">${esc(x.bairro)} · ${x.count} seção(ões)</div></div>
          <div class="secvote">${fmt(x.v)} votos</div>
          <div class="secpct">${pct(x.p)}</div>
          <div class="seccount">${fmt(x.vv)} válidos</div>
          <span></span>
        </div>`).join('') : '<div class="secempty">Nenhum local encontrado.</div>';
    }
    else {
      const arr = all
        .filter(r => (!secBairroFilter || r.b === secBairroFilter) && secMatch(`${r.b} ${r.n} ${r.e} ${r.z} ${r.s}`))
        .sort((a,b) => b.v-a.v || b.p-a.p);

      const back = secBairroFilter
        ? `<button type="button" class="secbackbtn" id="secBackBairro">← Todos os bairros</button><div class="secbairrotitle">${esc(secBairroFilter)}</div>`
        : '';

      body.innerHTML = back + (arr.length ? arr.map((r,i) => `
        <div class="secrow secstatic">
          <div class="secmain"><b>${i+1}. Zona ${r.z} · Seção ${r.s}</b><div class="secmeta">${esc(r.n)} · ${esc(r.b)}${r.e ? ' · ' + esc(r.e) : ''}</div></div>
          <div class="secvote">${fmt(r.v)} votos</div>
          <div class="secpct">${pct(r.p)}</div>
          <div class="seccount">${fmt(r.vv)} válidos</div>
          <span></span>
        </div>`).join('') : '<div class="secempty">Nenhuma seção encontrada.</div>');
    }
    body.scrollTop = 0;
  }

  function openBairro(nome){
    if(!nome || !secState) return;
    secBairroFilter = nome;
    secTab = 'secao';
    activateSecTab();
    renderSectionsView();
  }

  function changeSectionCandidate(n){
    if(!n || !secState) return;
    const keepTab = secTab;
    const keepBairro = secBairroFilter;
    const municipioKey = secState.k;
    const mainSel = $('cand');
    if(mainSel) mainSel.value = String(n);
    setCandidate(String(n));
    if(!current) return;
    secTab = keepTab;
    secBairroFilter = keepBairro;
    secState = {...secState,rows:sectionRows(secState.data),cargo,candidate:current.number};
    refreshCandidateHeader();
    renderSectionsView();
    if(municipioKey) show(municipioKey);
  }

  async function openSections(k){
    if(!current) return;
    const r = rows().find(x => x.norm === k);
    if(!r) return;

    secTab = 'bairro';
    secFilter = '';
    secBairroFilter = '';
    secCandFilter = '';

    $('secBack').classList.add('show');
    document.body.classList.add('secmodalopen');
    $('secTitle').textContent = `${r.municipio} · bairros e seções`;
    $('secSearch').value = '';
    $('secCandSearch').value = '';
    refreshCandidateHeader();
    $('secBody').innerHTML = '<div class="secempty">Carregando dados oficiais por seção…</div>';
    activateSecTab();

    try{
      let data = sectionCache.get(r.tse);
      if(!data){
        const resp = await fetch(`data/secoes/${r.tse}.json`,{cache:'force-cache'});
        if(!resp.ok) throw Error(resp.status);
        data = await resp.json();
        sectionCache.set(r.tse,data);
      }
      secState = {k,row:r,data,rows:sectionRows(data),cargo,candidate:current.number};
      renderSectionsView();
    }catch(e){
      secState = null;
      $('secBody').innerHTML = '<div class="secempty"><b>Não foi possível abrir os dados por seção.</b><br><br>Tente novamente.</div>';
    }
  }

  function closeSections(){
    $('secBack')?.classList.remove('show');
    document.body.classList.remove('secmodalopen');
    secState = null;
    secBairroFilter = '';
    secCandFilter = '';
  }

  function sectionButton(k){
    return `<button class="btn secopen" data-k="${esc(k)}">Ver bairros, locais e seções</button>`;
  }

  function bindSectionButtons(){
    document.querySelectorAll('.secopen').forEach(b => {
      b.onclick = e => {
        e.stopPropagation();
        openSections(b.dataset.k);
      };
    });
  }

  function installUI(){
    const st = document.createElement('style');
    st.id = 'secStylesStable';
    st.textContent = `
body.secmodalopen{overflow:hidden}
.secback{display:none;position:fixed;inset:0;z-index:200;background:rgba(15,23,42,.62);padding:3vh 3vw;align-items:center;justify-content:center}.secback.show{display:flex}
.secpanel{width:min(1120px,96vw);height:min(92vh,880px);background:#fff;border-radius:16px;box-shadow:0 18px 60px #0005;display:flex;flex-direction:column;overflow:hidden;min-height:0}
.sechead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:14px 16px;border-bottom:1px solid #e5eaf1;flex:0 0 auto}.sectitle{font-size:18px;font-weight:900}.secsub{font-size:11px;color:#667085;margin-top:3px}
.secclose{width:34px;height:34px;padding:0;border:0;border-radius:99px;background:#eef2f7;font-size:20px;font-weight:900;cursor:pointer;flex:0 0 auto}.seccontrols{padding:10px 14px;border-bottom:1px solid #e5eaf1;background:#f8fafc;flex:0 0 auto}
.seccandlabel{font-size:9px;font-weight:900;color:#475467;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px}.seccandtools{display:grid;grid-template-columns:minmax(180px,.8fr) minmax(280px,1.2fr);gap:6px;margin-bottom:8px}.seccandsearch,.seccandselect{margin:0!important;padding:8px!important;font-size:11px!important}
.sectabs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.sectab{margin:0;font-size:11px;font-weight:800;cursor:pointer}.sectab.active{background:#172b4d;color:#fff;border-color:#172b4d}.secsearch{margin-top:8px!important}
.secbody{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;padding:10px 14px;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior:contain}
.secnotice{font-size:10px;color:#667085;padding:8px 14px;border-top:1px solid #e5eaf1;background:#f8fafc;flex:0 0 auto}
.sechint{padding:8px 10px;margin-bottom:5px;border-radius:8px;background:#eff6ff;color:#344054;font-size:10px;font-weight:700}
.secrow{display:grid;grid-template-columns:minmax(180px,1fr) 100px 100px 80px 26px;gap:8px;align-items:center;width:100%;margin:0;border:0;border-bottom:1px solid #edf1f5;border-radius:0;padding:10px 6px;background:#fff;color:#172033;font:inherit;text-align:left}
button.secrow{cursor:pointer}.secbairro:hover,.secbairro:focus{background:#eef6ff;outline:2px solid #93c5fd;outline-offset:-2px}.secstatic{cursor:default}
.secmain b{font-size:12px}.secmeta{font-size:9px;color:#667085;margin-top:2px;line-height:1.3}.secvote,.secpct,.seccount{text-align:right;font-weight:800;font-size:11px}.secarrow{text-align:center;font-size:22px;font-weight:900;color:#155eef}.secbairrotitle{font-size:13px;font-weight:900;margin:2px 0 8px}
.secempty{padding:28px 8px;text-align:center;color:#667085;font-size:12px}.secbackbtn{width:auto;margin:0 0 8px;padding:7px 10px;font-size:10px;font-weight:800;background:#eef2f7;cursor:pointer}.secopen{margin-top:7px!important;background:#155eef!important;color:#fff!important;border-color:#155eef!important}
@media(min-width:851px){.mapdetail.show{display:block;position:absolute;left:12px;top:58px;z-index:80;width:270px;max-height:calc(100% - 80px);overflow:auto;background:rgba(255,255,255,.98);border:1px solid #cfd7e4;border-radius:12px;box-shadow:0 10px 28px #0f172a2d;padding:10px}.mapdetail.show .mdcity{font-size:15px}.mapdetail.show .mdrow{font-size:11px}}
@media(max-width:850px){.secback{padding:0;align-items:stretch}.secpanel{width:100%;height:100dvh;max-height:100dvh;border-radius:0}.sechead{padding:10px 11px}.sectitle{font-size:16px}.seccontrols{padding:7px 8px}.seccandtools{grid-template-columns:1fr;gap:4px;margin-bottom:7px}.seccandsearch,.seccandselect{font-size:11px!important;padding:8px!important}.secbody{padding:6px 8px;overflow-y:scroll!important;-webkit-overflow-scrolling:touch!important}.secrow{grid-template-columns:minmax(0,1fr) 70px 65px 22px;gap:5px;padding:10px 4px}.seccount{display:none}.secvote,.secpct{font-size:10px}.secarrow{font-size:20px}.sectab{padding:8px 4px;font-size:10px}.secnotice{padding-bottom:max(8px,env(safe-area-inset-bottom))}}
`;
    document.head.appendChild(st);

    document.body.insertAdjacentHTML('beforeend',`
      <div class="secback" id="secBack">
        <section class="secpanel" role="dialog" aria-modal="true" aria-labelledby="secTitle">
          <div class="sechead">
            <div><div class="sectitle" id="secTitle">Bairros e seções</div><div class="secsub" id="secSub"></div></div>
            <button class="secclose" id="secClose" aria-label="Fechar">×</button>
          </div>
          <div class="seccontrols">
            <div class="seccandlabel">Trocar candidato sem voltar</div>
            <div class="seccandtools"><input id="secCandSearch" class="seccandsearch" placeholder="Buscar nome, número ou partido"><select id="secCandSelect" class="seccandselect"></select></div>
            <div class="sectabs"><button class="sectab active" data-sectab="bairro">Bairros</button><button class="sectab" data-sectab="local">Locais</button><button class="sectab" data-sectab="secao">Seções</button></div>
            <input class="secsearch" id="secSearch" placeholder="Buscar bairro, local, zona ou seção">
          </div>
          <div class="secbody" id="secBody"><div class="secempty">Selecione um município.</div></div>
          <div class="secnotice">Bairro = bairro do local de votação. Isso não identifica necessariamente o bairro de residência do eleitor. Fonte: TSE.</div>
        </section>
      </div>`);

    $('secClose').onclick = closeSections;
    $('secBack').onclick = e => { if(e.target === $('secBack')) closeSections(); };
    document.querySelectorAll('[data-sectab]').forEach(b => {
      b.onclick = () => {
        secTab = b.dataset.sectab;
        secBairroFilter = '';
        activateSecTab();
        renderSectionsView();
      };
    });
    $('secSearch').oninput = e => { secFilter = e.target.value; renderSectionsView(); };
    $('secCandSearch').oninput = e => { secCandFilter = e.target.value; fillCandidateSelect(); };
    $('secCandSelect').onchange = e => changeSectionCandidate(e.target.value);
    $('secBody').onclick = e => {
      const bairro = e.target.closest('.secbairro');
      if(bairro && $('secBody').contains(bairro)){
        openBairro(bairro.dataset.b);
        return;
      }
      if(e.target.closest('#secBackBairro')){
        secBairroFilter = '';
        secTab = 'bairro';
        activateSecTab();
        renderSectionsView();
      }
    };
    document.addEventListener('keydown',e => { if(e.key === 'Escape') closeSections(); });
  }

  installUI();

  const baseShow = show;
  show = function(k){
    baseShow(k);
    if(!current) return;
    const r = rows().find(x => x.norm === k);
    if(!r?.loaded) return;
    const det = $('det');
    if(det && !det.querySelector('.secopen')) det.insertAdjacentHTML('beforeend',sectionButton(k));
    const md = $('mapDet');
    if(md && !md.querySelector('.secopen')) md.insertAdjacentHTML('beforeend',sectionButton(k));
    bindSectionButtons();
  };

  const map = $('map');
  if(map){
    map.addEventListener('click',e => {
      const el = e.target.closest?.('.mun');
      if(!el || !map.contains(el)) return;
      let k = '';
      if(typeof paths !== 'undefined'){
        for(const [key,p] of Object.entries(paths)){
          if(p === el){ k = key; break; }
        }
      }
      if(!k) return;
      e.preventDefault();
      e.stopPropagation();
      show(k);
    },true);
  }

  $('cargo')?.addEventListener('change',closeSections);
  $('cand')?.addEventListener('change',closeSections);
})();
