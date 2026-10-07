'use strict';
(() => {
  const map=document.getElementById('map');
  if(!map)return;

  const style=document.createElement('style');
  style.textContent=`
@media(min-width:851px){
  .mapdetail.show{
    display:block;
    position:absolute;
    left:12px;
    top:58px;
    z-index:80;
    width:270px;
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
}
`;
  document.head.appendChild(style);

  function keyForPath(el){
    if(typeof paths==='undefined'||!el)return '';
    for(const [k,p] of Object.entries(paths))if(p===el)return k;
    return '';
  }

  function handle(e){
    const el=e.target?.closest?.('.mun');
    if(!el||!map.contains(el))return;
    const k=keyForPath(el);
    if(!k)return;
    e.preventDefault();
    e.stopPropagation();
    if(typeof show==='function')show(k);
  }

  map.addEventListener('click',handle,true);
  map.addEventListener('pointerup',e=>{
    if(e.pointerType==='mouse')return;
    handle(e);
  },true);
})();
