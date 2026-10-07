'use strict';
(() => {
  const $id=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function label(c){
    return `${c.urna||c.official||'Sem nome'} · Nº ${c.number}${c.party?' · '+c.party:''}`;
  }

  function list(q=''){
    const z=norm(q||'');
    return (cands||[])
      .filter(c=>!z||norm(`${c.urna||''} ${c.official||''} ${c.number||''} ${c.party||''}`).includes(z))
      .slice()
      .sort((a,b)=>String(a.urna||a.official||'').localeCompare(String(b.urna||b.official||''),'pt-BR'));
  }

  function populate(){
    const sel=$id('secCandSelect'),q=$id('secCandSearch');
    if(!sel||typeof cands==='undefined')return;
    const arr=list(q?.value||'');
    const selectedValue=typeof current!=='undefined'&&current?String(current.number):'';
    const html=arr.length?arr.map(c=>`<option value="${esc(c.number)}">${esc(label(c))}</option>`).join(''):'<option value="">Nenhum candidato encontrado</option>';
    if(sel.innerHTML!==html)sel.innerHTML=html;
    if(selectedValue&&arr.some(c=>String(c.number)===selectedValue))sel.value=selectedValue;
  }

  function reopenForCurrentMunicipality(){
    const k=typeof selected!=='undefined'?selected:'';
    if(!k)return;
    setTimeout(()=>{
      const safe=window.CSS&&CSS.escape?CSS.escape(k):k.replace(/"/g,'\\"');
      const btn=document.querySelector(`.secopen[data-k="${safe}"]`) || document.querySelector('.secopen');
      if(btn)btn.click();
    },20);
  }

  function changeCandidate(n){
    if(!n||typeof setCandidate!=='function')return;
    if(typeof current!=='undefined'&&current&&String(current.number)===String(n))return;
    const mainSel=$id('cand');
    if(mainSel)mainSel.value=String(n);
    setCandidate(String(n));
    reopenForCurrentMunicipality();
  }

  function install(){
    const sub=$id('secSub');
    if(!sub||$id('secCandTools'))return;
    const wrap=document.createElement('div');
    wrap.id='secCandTools';
    wrap.className='seccandtools';
    wrap.innerHTML=`<div class="seccandlabel">Trocar candidato sem voltar</div><div class="seccandgrid"><input id="secCandSearch" class="seccandsearch" placeholder="Buscar candidato, número ou partido"><select id="secCandSelect" class="seccandselect"></select></div>`;
    sub.insertAdjacentElement('afterend',wrap);
    $id('secCandSearch').addEventListener('input',populate);
    $id('secCandSelect').addEventListener('change',e=>changeCandidate(e.target.value));
    populate();
  }

  const style=document.createElement('style');
  style.textContent=`
.seccandtools{margin-top:8px;max-width:660px}.seccandlabel{font-size:9px;font-weight:900;color:#475467;text-transform:uppercase;letter-spacing:.04em}.seccandgrid{display:grid;grid-template-columns:minmax(170px,.8fr) minmax(240px,1.2fr);gap:6px;align-items:center}.seccandsearch,.seccandselect{margin-top:4px!important;padding:7px 8px!important;font-size:11px!important}
@media(max-width:850px){.seccandtools{margin-top:7px}.seccandgrid{grid-template-columns:1fr}.seccandsearch,.seccandselect{font-size:11px!important;padding:8px!important;margin-top:4px!important}.sechead>div:first-child{min-width:0;flex:1}}
`;
  document.head.appendChild(style);

  install();
  const back=$id('secBack');
  if(back){
    const obs=new MutationObserver(()=>{
      if(back.classList.contains('show')){
        install();
        populate();
      }
    });
    obs.observe(back,{attributes:true,attributeFilter:['class']});
  }
})();
