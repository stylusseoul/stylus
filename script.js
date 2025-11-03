// ---------- STATE ----------
const state = {
  data: [],
  filtered: [],
  filters: { genres: new Set() },
  limit: 50,         // 1페이지 50개
  currentItem: null, // 상세에 보여줄 선택 항목
};

// ---------- DOM ----------
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

const appHeader = document.querySelector('.header'); // 공용 헤더(로고 포함)

// ---------- CONFIG (config.js에서 주입 필요) ----------
// 기대: window.SHEET_CSV_URL, window.COVER_PLACEHOLDER
const SHEET_CSV_URL = window.SHEET_CSV_URL;
const COVER_PLACEHOLDER = window.COVER_PLACEHOLDER || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

// ---------- HELPERS ----------
function toArray(s){
  if(Array.isArray(s)) return s;
  if(!s) return [];
  return s.split(/\s*;\s*|\s*·\s*|\s*\|\s*|\s*,\s*/).filter(Boolean);
}

function mapRow(row){
  const get = (k)=> row.hasOwnProperty(k) ? row[k] : (row[k?.toLowerCase?.()] ?? row[k?.toUpperCase?.()] ?? '');
  const artist = get('Artist');
  const album  = get('Album');
  const year   = String(get('Year')||'');
  const genre  = get('Genre');
  const cover  = get('Cover') || get('F') || get('cover') || get('COVER');
  const tracks = toArray(get('Tracks'));
  return { artist, album, year, genre, cover, tracks };
}

async function fetchCSV(){
  return new Promise((resolve, reject)=>{
    Papa.parse(SHEET_CSV_URL, {
      download: true, header: true, skipEmptyLines: true,
      complete: ({data}) => resolve(data.map(mapRow)),
      error: reject
    });
  });
}

function isValidItem(it){
  const hasAlbum  = (it.album || '').trim() !== '';
  const hasArtist = (it.artist || '').trim() !== '';
  const notStatus = !((it.album || '').trim().toUpperCase() === 'OK' || (it.artist || '').trim().toUpperCase() === 'OK');
  return (hasAlbum || hasArtist) && notStatus;
}

function defaultSortByArtist(arr){
  arr.sort((a,b)=>(a.artist||'').localeCompare(b.artist||'', 'ko', {sensitivity:'base'}));
}

// Discogs 이미지 프록시 (트래픽 절약)
function proxify(rawUrl, { w=null, h=null, fit='cover' } = {}){
  if(!rawUrl) return '';
  let s = String(rawUrl).trim().replace(/&amp;/g, '&');
  if (s.startsWith('//')) s = 'https:' + s;
  const core = s.replace(/^https?:\/\//, '');
  let q = `https://images.weserv.nl/?url=${encodeURIComponent(core)}`;
  if (w) q += `&w=${w}`;
  if (h) q += `&h=${h}`;
  q += `&fit=${fit}`;
  return q;
}
const coverThumb = (u)=> proxify(u, { w:150, h:150, fit:'cover' });
const coverLarge = (u)=> proxify(u, { w:900, h:900, fit:'contain' });

// ---------- FILTER ----------
function matchesQuery(item, q){
  if(!q) return true;
  const hay = [(item.album||''), (item.artist||''), (item.tracks||[]).join(' '), (item.genre||'')].join(' ').toLowerCase();
  return hay.includes(q);
}
function matchesFilters(item){
  const gs = state.filters.genres;
  return gs.size ? gs.has((item.genre||'').trim()) : true;
}
function applyFilters(){
  const q = (inputEl.value||'').trim().toLowerCase();
  state.filtered = state.data
    .filter(isValidItem)
    .filter(it => matchesQuery(it, q) && matchesFilters(it));
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
  const set = new Set(state.data.map(d=> (d.genre||'').trim()).filter(Boolean));
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

// ---------- RENDER ----------
function renderList(){
  const total = state.filtered.length;
  const shown = Math.min(state.limit, total);
  countEl.textContent = `${total}개 앨범 중 ${shown}개 표시`;

  listEl.innerHTML = '';
  const frag = document.createDocumentFragment();
  state.filtered.slice(0, shown).forEach((item) => {
    const row = document.createElement('article'); row.className = 'row'; row.tabIndex = 0;
    row.addEventListener('click', ()=> openDetail(item));
    row.addEventListener('keydown', (e)=>{ if(e.key==='Enter') openDetail(item); });

    const img = document.createElement('img'); img.className='thumb'; img.loading='lazy';
    img.src = coverThumb(item.cover) || COVER_PLACEHOLDER;
    img.onerror = () => { img.src = COVER_PLACEHOLDER; };

    const info = document.createElement('div'); info.className='info';
    const album = document.createElement('p'); album.className='album'; album.textContent = item.album || '(제목 없음)';
    const artist = document.createElement('p'); artist.className='artist'; artist.textContent = item.artist || '';
    const meta = document.createElement('p'); meta.className='meta'; meta.textContent = [item.year, item.genre].filter(Boolean).join(' · ');
    const tracks = document.createElement('p'); tracks.className='tracks'; tracks.textContent = (item.tracks||[]).join(' · ');

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

// ---------- DETAIL ----------
function renderDetail(item){
  const base = item.cover || '';
  dCover.loading = 'lazy';
  dCover.src = proxify(base, { w:900, h:900, fit:'contain' }) || COVER_PLACEHOLDER;
  dCover.srcset = [
    proxify(base, { w:320,  h:320,  fit:'contain' }) + ' 320w',
    proxify(base, { w:640,  h:640,  fit:'contain' }) + ' 640w',
    proxify(base, { w:900,  h:900,  fit:'contain' }) + ' 900w',
    proxify(base, { w:1200, h:1200, fit:'contain' }) + ' 1200w'
  ].join(', ');
  dCover.sizes = '(max-width: 420px) 90vw, 560px';
  dCover.onerror = () => { dCover.src = COVER_PLACEHOLDER; dCover.removeAttribute('srcset'); };

  dAlbum.textContent = item.album || '';
  dArtist.textContent = item.artist || '';
  dTracks.innerHTML = '';
  (item.tracks||[]).forEach(t => {
    const li = document.createElement('li');
    li.textContent = t;
    dTracks.appendChild(li);
  });
}

function openDetail(item){
  state.currentItem = item || null;
  if (state.currentItem) renderDetail(state.currentItem);

  // 화면 전환
  listPage.classList.add('hidden');
  toolbar.classList.add('hidden');
  detailPage.classList.remove('hidden');
  detailHdr.classList.remove('hidden');
  document.body.classList.add('detail-mode');

  // 공용 헤더 라인 제거(보조)
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

  // 공용 헤더 라인 복구(보조)
  if (appHeader) appHeader.style.borderBottom = '1px solid rgba(255,255,255,0.28)';

  location.hash = '#list';
}

// ---------- ROUTER (해시 기반 화면 상태 강제) ----------
function enforceRoute(){
  const h = (location.hash || '').toLowerCase();
  if (h === '#detail'){
    // 항목 없이 직접 상세 해시로 들어온 경우: 목록으로 복귀
    if (!state.currentItem){
      backToList();
      return;
    }
    // 상세 상태 보장
    listPage.classList.add('hidden');
    toolbar.classList.add('hidden');
    detailPage.classList.remove('hidden');
    detailHdr.classList.remove('hidden');
    document.body.classList.add('detail-mode');
    if (appHeader) appHeader.style.borderBottom = 'none';
  }else{
    // 기본: 목록 상태 보장
    backToList();
  }
}

// ---------- INIT ----------
async function load(){
  try{
    countEl.textContent = '불러오는 중…';
    const data = await fetchCSV();
    state.data = data.filter(isValidItem);
    defaultSortByArtist(state.data);
    state.filtered = state.data.slice();
    buildGenreChips();
    renderList();

    // 초기 라우트 강제
    enforceRoute();
  }catch(e){
    document.body.insertAdjacentHTML('beforeend', `<div style="color:#300;padding:10px;background:#fff8;border-top:1px solid #900">불러오기 실패: ${e.message}</div>`);
  }
}

// Events
btnSearch.addEventListener('click', applyFilters);
inputEl.addEventListener('input', applyFilters);
inputEl.addEventListener('keydown', (e)=>{ if(e.key==='Enter') applyFilters(); });
btnReset.addEventListener('click', clearAll);
btnBack.addEventListener('click', backToList);

window.addEventListener('hashchange', enforceRoute);

// GO
load();
