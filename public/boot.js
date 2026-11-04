/* Runs before first paint: apply the saved theme and hide the English prerender
   for visitors who will see another language (no flash of the wrong language). */
(function () {
  var d = document.documentElement;
  try {
    var t = localStorage.getItem('lor.theme');
    var dark = t === 'dark' || ((!t || t === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) { d.classList.add('dark'); d.setAttribute('data-theme', 'dark'); }
    var l = localStorage.getItem('lor.lang');
    var nav = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    if (l === 'nl' || (!l && /^nl\b/i.test(nav))) d.classList.add('lang-pending');
  } catch (e) {}
})();
