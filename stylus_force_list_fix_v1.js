
// stylus_force_list_fix_v1.js
// Purpose: if the app accidentally stays in detail-mode (so list looks empty),
// force it back to the List view on initial load and on pageshow (back/forward cache).

(function(){
  function forceList(){
    try {
      if (typeof backToList === 'function' && (location.hash || '').toLowerCase() !== '#detail'){
        backToList();
      }
    } catch(e){ /* ignore */ }
    // Ensure DOM visibility even if backToList isn't available
    var listPage = document.getElementById('listPage');
    var detailPage = document.getElementById('detailPage');
    var toolbar = document.getElementById('toolbar');
    var detailHdr = document.getElementById('detailHeader');
    if (listPage) listPage.classList.remove('hidden');
    if (detailPage) detailPage.classList.add('hidden');
    if (toolbar) toolbar.classList.remove('hidden');
    if (detailHdr) detailHdr.classList.add('hidden');
    document.body && document.body.classList.remove('detail-mode');
    // Normalize hash
    if ((location.hash || '').toLowerCase() !== '#detail'){
      location.hash = '#list';
    }
  }

  // Run after main app script likely attached events/rendered
  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(forceList, 100);
  });

  // Handle BFCache restores where the UI might be stuck
  window.addEventListener('pageshow', function(){
    setTimeout(forceList, 50);
  });
})();
