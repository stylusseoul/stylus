// Stylus Vinyl — script.js (v11.1_diagnose)
// - Google Sheet CSV URL "내장" (config.js 불필요)
// - fetch → text → Papa.parse(text)
// - header:true 실패 시 header:false 재파싱(열순서: Artist,Album,Year,Genre,Cover,Tracks 가정)
// - 진단 로그/배너 표시, 목록 즉시 렌더

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTXikyTZ6Abe3Ome-3JYTQK83jSC7vpQXKBPqLuGhNLVmn_1Dzh48iVB77w_9GbUCHO4VuK2K3LZ48P/pub?output=csv";
const COVER_PLACEHOLDER = "images/placeholder.png";

// --- State
const state = { data: [], filtered: [], filters: { genres: new Set() }, limit: 50, currentItem: null };

// --- DOM
const listPage   = document.getElementById('listPage');
const detailPage = document.getElementById('detailPage');
const toolbar    = document.getElementById('toolbar');
const detailHdr  = document.getElementById('detailHeader');

const listEl   = document.getElementById('list');
const inputEl  = document.getElementById('searchInput');
const btnSearch= document.getElementById('btnSearch');
const btnReset = document.getElementById('btnReset');
const genreChips = document.getElementById('genreChips');
const countEl  = document.getElementById('count');
const moreWrap = document.getElementById('moreWrap');

const dCover = document.getElementById('dCover');
const dAlbum = document.getElementById('dAlbum');
const dArtist= document.getElementById('dArtist');
const dTracks= document.getElementById('dTracks');
const btnBack= document.getElementById('btnBack');

const appHeader = document.querySelector('.header');

// --- Helpers
const norm = (v)=> (v==null?'':String(v).replace(/^\uFEFF/, '').trim());
const toArray = (s)=> {
  const t = norm(s); if(!t) return [];
  return t.split(/\s*;\s*|\s*·\s*|\s*\|\s*|\s*,\s*/).filter(Boolean);
};

function mapRowByHeader(row){
  return {
    artist: norm(row["Artist"]),
    album : norm(row["Album"]),
    year  : norm(row["Year"]),
    genre : norm(row["Genre"]),
    cover : norm(row["Cover"]),
    tracks: toArray(row["Tracks"])
  };
}
function mapRowByIndex(arr){ // [Artist,Album,Year,Genre,Cover,Tracks]
  return {
    artist: norm(arr[0]),
    album : norm(arr[1]),
    year  : norm(arr[2]),
    genre : norm(arr[3]),
    cover : norm(arr[4]),
    tracks: toArray(arr[5])
  };
}
function isHeaderShapeOK(obj){
  if (!obj || typeof obj !== 'object') return false;
  const keys = Object.keys(obj).map(k=>k.toLowerCase());
  return ["artist","album","year","genre","cover","tracks"].some(k => keys.includes(k));
}
function isValid(it){
  const a = norm(it.album).toUpperCase();
  const r = norm(it.artist).toUpperCase();
  const notStatus = (a !== "OK" && r !== "OK");
  return (norm(it.album) || norm(it.artist)) && notStatus;
}
function proxify(url, { w=null, h=null, fit='cover' } = {}){
  const u = norm(url); if(!u) return "";
  const core = u.replace(/^https?:\/\//, '');
  let q = `https://images.weserv.nl/?url=${encodeURIComponent(core)}&fit=${fit}`;
  if (w) q += `&w=${w}`; if (h) q += `&h=${h}`;
  return q;
}
function defaultSortByArtist(arr){
  arr.sort((a,b)=> norm(a.artist).localeCompare(norm(b.artist), 'ko', {sensitivity:'base'}));
}
function banner(msg){
  document.body.insertAdjacentHTML('beforeend',
    `<div style="position:sticky;bottom:0;left:0;right:0;background:#300;color:#fff;padding:10px;border-top:1px solid #900;z-index:9999">${msg}</div>`);
}

// --- Data load
async function fetchCSVText(url){
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}
function parseWithHeader(text){
  const p = Papa.parse(text, { header:true, skipEmptyLines:true });
  return p;
}
function parseNoHeader(text){
  const p = Papa.parse(text, { header:false, skipEmptyLines:true });
  return p;
}

// --- Filters
function matchesQuery(item, q){
  if(!q) return true;
  const hay = [item.album, item.artist, (item.tracks||[]).join(' '), item.genre].map(norm).join(' ').toLowerCase();
  return hay.includes(q);
}
function matchesFilters(item){
  const gs = state.filters.genres;
  return gs.size ? gs.has(norm(item.genre)) : true;
}
function applyFilters(){
  const q = norm(inputEl.value).toLowerCase();
  state.filtered = state.data.filter(isValid).filter(it => matchesQuery(it, q) && matchesFilters(it));
  defaultSortByArtist(state.filtered);
  state.limit = 50;
  renderList();
}
function clearAll(){
  inputEl.value = '';
  state.filters.genres.clear();
  Array.from(genreChips.children).forEach(c=> c.classList.remove('active'));
  applyFilters();
  inputEl.focus();
}
function buildGenreChips(){
  const set = new Set(state.data.map(d=> norm(d.genre)).filter(Boolean));
  const items = [...set].sort((a,b)=> a.localeCompare(b, 'ko', {sensitivity:'base'}));
  genreChips.innerHTML='';
  items.forEach(val=>{
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.textContent = val;
    btn.addEventListener('click', ()=>{
      if(state.filters.genres.has(val)) state.filters.genres.delete(val);
      else state.filters.genres.add(val);
      btn.classList.toggle('active');
      applyFilters();
    });
    genreChips.appendChild(btn);
  });
}

// --- Render
function renderList(){
  const total = state.filtered.length;
  const shown = Math.min(state.limit, total);
  countEl.textContent = `${total}개 앨범 중 ${shown}개 표시`;
  listEl.innerHTML = '';

  if (total === 0){
    listEl.innerHTML = `<p style="opacity:.9;margin:12px">표시할 항목이 없습니다.</p>`;
    moreWrap.innerHTML = '';
    return;
  }

  const frag = document.createDocumentFragment();
  state.filtered.slice(0, shown).forEach((item) => {
    const row = document.createElement('article'); row.className = 'row'; row.tabIndex = 0;
    row.addEventListener('click', ()=> openDetail(item));
    row.addEventListener('keydown', (e)=>{ if(e.key==='Enter') openDetail(item); });

    const img = document.createElement('img'); img.className='thumb'; img.loading='lazy';
    img.src = proxify(item.cover, { w:150, h:150, fit:'cover' }) || COVER_PLACEHOLDER;
    img.onerror = () => { img.src = COVER_PLACEHOLDER; };

    const info = document.createElement('div'); info.className='info';
    const album = document.createElement('p'); album.className='album'; album.textContent = norm(item.album) || '(제목 없음)';
    const artist = document.createElement('p'); artist.className='artist'; artist.textContent = norm(item.artist);
    const meta = document.createElement('p'); meta.className='meta'; meta.textContent = [norm(item.year), norm(item.genre)].filter(Boolean).join(' · ');
    const tracks = document.createElement('p'); tracks.className='tracks'; tracks.textContent = (item.tracks||[]).map(norm).join(' · ');

    info.appendChild(album);
    info.appendChild(artist);
    info.appendChild(meta);
    info.appendChild(tracks);
    row.appendChild(img);
    row.appendChild(info);
    frag.appendChild(row);
  });
  listEl.appendChild(frag);

  // load more
  moreWrap.innerHTML = '';
  if (shown < total){
    const more = document.createElement('button');
    more.id = 'btnLoadMore';
    more.className = 'btn primary';
    more.textContent = '더보기';
    more.addEventListener('click', ()=>{
      state.limit += 50;
      renderList();
    });
    moreWrap.appendChild(more);
  }
}

// --- Detail
function renderDetail(item){
  const base = item.cover || '';
  dCover.loading = 'lazy';
  dCover.src = proxify(base, { w:900, h:900, fit:'contain' }) || COVER_PLACEHOLDER;
  dCover.onerror = () => { dCover.src = COVER_PLACEHOLDER; };

  dAlbum.textContent = norm(item.album);
  dArtist.textContent = norm(item.artist);
  dTracks.innerHTML = '';
  (item.tracks||[]).forEach(t => {
    const li = document.createElement('li');
    li.textContent = norm(t);
    dTracks.appendChild(li);
  });
}
function openDetail(item){
  state.currentItem = item || null;
  if (state.currentItem) renderDetail(state.currentItem);

  listPage.classList.add('hidden');
  toolbar.classList.add('hidden');
  detailPage.classList.remove('hidden');
  detailHdr.classList.remove('hidden');
  document.body.classList.add('detail-mode');
  if (appHeader) appHeader.style.borderBottom = 'none';

  location.hash = '#detail';
}
function backToList(){
  state.currentItem = null;

  detailPage.classList.add('hidden');
  detailHdr.classList.add('hidden');
  listPage.classList.remove('hidden');
  toolbar.classList.remove('hidden');
  document.body.classList.remove('detail-mode');
  if (appHeader) appHeader.style.borderBottom = '1px solid rgba(255,255,255,0.28)';

  location.hash = '#list';
}

// --- Router
function enforceRoute(){
  const h = (location.hash || '').toLowerCase();
  if (h === '#detail'){
    if (!state.currentItem){
      backToList();
      return;
    }
    listPage.classList.add('hidden');
    toolbar.classList.add('hidden');
    detailPage.classList.remove('hidden');
    detailHdr.classList.remove('hidden');
    document.body.classList.add('detail-mode');
    if (appHeader) appHeader.style.borderBottom = 'none';
  }else{
    backToList();
  }
}

// --- Init
async function init(){
  try{
    countEl.textContent = '불러오는 중…';

    // 1) fetch CSV text
    const csvText = await fetchCSVText(SHEET_CSV_URL);
    console.log('[CSV bytes]', csvText.length);

    // 2) try parse with header:true
    let rows = [];
    let parsed = parseWithHeader(csvText);
    console.log('[Parsed(header:true) rows]', parsed.data.length);
    if (parsed.errors && parsed.errors.length){
      console.warn('[Papa errors(header:true)]', parsed.errors.slice(0,3));
    }
    if (parsed.data.length > 0 && isHeaderShapeOK(parsed.data[0])) {
      rows = parsed.data.map(mapRowByHeader);
    } else {
      // 3) fallback: header:false
      const parsed2 = parseNoHeader(csvText);
      console.log('[Parsed(header:false) rows]', parsed2.data.length);
      if (parsed2.errors && parsed2.errors.length){
        console.warn('[Papa errors(header:false)]', parsed2.errors.slice(0,3));
      }
      rows = parsed2.data.map(mapRowByIndex);
      if (parsed.data.length > 0 && !isHeaderShapeOK(parsed.data[0])) {
        banner(`CSV 헤더 인식 실패 → 열순서로 재파싱했습니다. 첫행 키: ${Object.keys(parsed.data[0]).join(', ')}`);
      }
    }

    // 4) validate + sort
    state.data = rows.filter(isValid);
    console.log('[Valid items]', state.data.length, state.data[0]);
    defaultSortByArtist(state.data);
    state.filtered = state.data.slice();

    // 5) UI
    buildGenreChips();
    renderList();
    enforceRoute();

    if (state.data.length === 0){
      banner('데이터가 0건입니다. 시트의 "Artist/Album" 중 하나라도 값이 있는지 확인하세요.');
    }
  }catch(err){
    console.error('LOAD ERROR:', err);
    banner(`데이터 로딩 실패: ${err && err.message ? err.message : String(err)}`);
  }
}

// Events
btnSearch.addEventListener('click', applyFilters);
inputEl.addEventListener('input', applyFilters);
inputEl.addEventListener('keydown', (e)=>{ if(e.key==='Enter') applyFilters(); });
btnReset.addEventListener('click', clearAll);
btnBack.addEventListener('click', backToList);
window.addEventListener('hashchange', enforceRoute);

// Go
init();
