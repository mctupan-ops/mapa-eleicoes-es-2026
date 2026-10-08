'use strict';
(() => {
  const qs = new URLSearchParams(location.search);
  if(qs.get('eleicao') === '2024') return;

  const panel = document.querySelector('.panel');
  if(!panel || document.getElementById('electionSwitcher')) return;

  const credit = panel.querySelector('.credit');
  const box = document.createElement('div');
  box.className = 'card';
  box.id = 'electionSwitcher';
  box.style.marginTop = '9px';
  box.innerHTML = `
    <div class="label">Eleição</div>
    <select id="electionYear">
      <option value="2026" selected>2026 · Estadual / Federal</option>
      <option value="2024">2024 · Municipal</option>
    </select>`;

  if(credit?.nextSibling) panel.insertBefore(box, credit.nextSibling);
  else panel.insertBefore(box, panel.firstChild);

  document.getElementById('electionYear').onchange = e => {
    if(e.target.value === '2024') location.href = location.pathname + '?eleicao=2024';
  };
})();