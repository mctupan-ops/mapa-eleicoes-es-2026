'use strict';
(() => {
  const map=document.getElementById('map');
  if(!map)return;

  const desktop=()=>window.matchMedia('(min-width:851px)').matches;

  const style=document.createElement('style');
  style.textContent=`
@media(min-width:851px){
  .mapdetail.show{
    display:block!important;
    position:absolute;
    left:12px;
    top:58px;
    z-index:80;
    width:285px;
    max-height:calc(100% - 80px);
    overflow:auto;
    background:rgba(255,255,255,.98);
    border:1px solid #cfd7e4;
    border-radius:12px;
    box-shadow:0 10px 28px #0f172a2d;
    padding:10px;
  }
  .mapdetail.show .mdcity{font-size:15px}
  .mapdetail.show .mdrow{font-size:11px}
  .mapdetail.show .secopen{margin-top:8px!important}
  .mun{pointer-events:all!important;cursor:pointer!important}
}
`;
  document.head.appendChild(style);

  function keyForPath(el){
    if(!el)return '';
    if(el.dataset?.mapKey)return el.dataset.mapKey;
    try{
      if(typeof paths!=='undefined'){
        for(const [k,p] of Object.entries(paths)){
          if(p===el){el.dataset.mapKey=k;return k}
        }
      }
    }catch(_){ }
    return '';
  }

  function selectPath(el,e){
    if(!desktop()||!el)return;
    const k=keyForPath(el);
    if(!k)return;
    if(e){e.preventDefault();e.stopPropagation()}
    try{ if(typeof show==='function') show(k) }catch(err){ console.error('Falha ao abrir município',err) }
  }

  function bindPaths(){
    if(!desktop())return;
    let list=[...map.querySelectorAll('.mun')];
    if(!list.length)return;
    for(const el of list){
      const k=keyForPath(el);
      if(k)el.dataset.mapKey=k;

      // O código original trazia o município para frente no mouseenter.
      // No desktop isso pode remover/reinserir o SVG antes do click e perder o clique.
      el.onmouseenter=null;
      el.onmouseleave=()=>{const tip=document.getElementById('tip');if(tip)tip.style.display='none'};

      // Clique direto e estável no próprio município.
      el.onpointerdown=e=>{
        if(e.pointerType==='mouse'||e.pointerType==='pen'||!e.pointerType)selectPath(el,e)
      };
      el.onclick=e=>selectPath(el,e);
    }
  }

  // Delegação como segunda garantia caso o SVG seja recriado.
  map.addEventListener('pointerdown',e=>{
    if(!desktop())return;
    const el=e.target?.closest?.('.mun');
    if(el&&map.contains(el))selectPath(el,e)
  },true);

  map.addEventListener('click',e=>{
    if(!desktop())return;
    const el=e.target?.closest?.('.mun');
    if(el&&map.contains(el))selectPath(el,e)
  },true);

  const obs=new MutationObserver(bindPaths);
  obs.observe(map,{childList:true,subtree:true});
  bindPaths();
  setTimeout(bindPaths,300);
  setTimeout(bindPaths,1200);
})();
