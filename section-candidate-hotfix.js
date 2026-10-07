'use strict';
(() => {
  let applying=false;

  function applySelectedCandidate(){
    const modal=document.getElementById('secBack');
    if(!modal?.classList.contains('show'))return;
    const sel=document.getElementById('secCandSelect');
    const main=document.getElementById('cand');
    if(!sel?.value)return;
    const chosen=String(sel.value);
    const currentMain=String(main?.value||'');
    if(chosen===currentMain)return;
    if(applying)return;
    applying=true;
    try{
      sel.dispatchEvent(new Event('change',{bubbles:true}));
    }finally{
      setTimeout(()=>{applying=false},0);
    }
  }

  document.addEventListener('input',e=>{
    if(e.target?.id==='secCandSearch'){
      setTimeout(applySelectedCandidate,0);
      return;
    }
    if(e.target?.id==='secCandSelect'){
      setTimeout(applySelectedCandidate,0);
    }
  },true);

  document.addEventListener('change',e=>{
    if(e.target?.id==='secCandSelect'){
      setTimeout(()=>{
        const sel=document.getElementById('secCandSelect');
        const main=document.getElementById('cand');
        if(sel?.value && String(main?.value||'')!==String(sel.value)){
          if(!applying){
            applying=true;
            sel.dispatchEvent(new Event('change',{bubbles:true}));
            setTimeout(()=>{applying=false},0);
          }
        }
      },0);
    }
  },true);
})();
