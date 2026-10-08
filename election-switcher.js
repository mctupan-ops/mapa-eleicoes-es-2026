'use strict';
(() => {
  if(document.getElementById('analysisModulesLoader')) return;
  const s = document.createElement('script');
  s.id = 'analysisModulesLoader';
  s.src = 'analysis-modules.js?v=20261008b';
  document.head.appendChild(s);
})();
