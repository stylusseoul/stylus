// Stylus Vinyl — script.js (v11_fetchText)
// - Google Sheet CSV URL "직접 내장" (config.js 불필요)
// - fetch → text → Papa.parse(text) 로 파싱 (CORS/비동기 안정화)
// - 영어 헤더 기준: Artist, Album, Year, Genre, Cover, Tracks
// - 목록 50개 + 더보기, like 검색, 상세 라우팅/뒤로가기, 에러 가시화

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTXikyTZ6Abe3Ome-3JYTQK83jSC7vpQXKBPqLuGhNLVmn_1Dzh48iVB77w_9GbUCHO4VuK2K3LZ48P/pub?output=csv";
const COVER_PLACEHOLDER = "images/placeholder.png";

const state = {
  data: [],
  filtered: [],
  filters: { genres: new Set() },
  limit: 50,
  currentItem: null,
};

// DOM
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

// ----- Helpers
function toArray(s){
  if (!s) return [];
  return String(s).split(/;|·|\||,/).map(x=>x.trim()).filter(Boolean);
}
function mapRow(row){
  return {
    artist: row["Artist"]?.trim() || "",
    album : row["Album"]?.trim() || "",
    year  : String(row["Year"] ?? "").trim(),
    genre : row["Genre"]?.trim() || "",
    cover : row["Cover"]?.trim() || "",
    tracks: toArray(row["Tracks"]),
  };
}
function isValid(it){
  // 최소한 artist 또는 album 중 하나만 있으면 표시, "OK" 행은 제외
  const a = (it.album||"").trim().toUpperCase();
  const r = (it.artist||"").trim().toUpperCase();
  const notStatus = (a !== "OK" && r !== "OK");
  return (it.album || it.artist) && notStatus;
}
function proxify(url, { w=null, h=null, fit='cover' } = {}){
  if(!url) return "";
  let clean = String(url).replace(/^https?:\/\//, "");
  let q = `https://images.weserv.nl/?url=${encodeURIComponent(clean)}&fit=${fit}`;
  if (w) q += `&w=${w}`;
  if (h) q += `&h=${h}`;
  return q;
}
function defaultSortByArtist(arr){
  arr.sort((a,b)=>(a.artist||"").localeCompare(b.artist||"", 'ko', {sensitivity:'base'}));
}

// ----- Data
async function fetchCSVText(url){
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} — CSV 응답 실패`);
  }
  return await res.text();
}
function parseCSVText(text){
  const parsed = Papa.parse(text, { header:true, skipEmptyLines:true });
  if (parsed.errors && parsed.errors.length){
    console.warn("Papa.parse errors:", parsed.errors.slice(0,3));
  }
  return parsed.data.map(mapRow);
}

// ----- Filters
function matchesQuery(item, q){
  if(!q) return true;
  const hay = `${item.artist} ${item.album} ${item.tracks.join(" ")} ${item.genre}`.toLowerCase();
  return hay.includes(q);
}
function matchesFilters(item){
  const gs = state.filters.genres;
  return gs.size ? gs.has((item.genre||"").trim()) : true;
}
function applyFilters(){
  const q = (inputEl.value||"").trim().toLowerCase();
  state.filtered = state.data
    .filter(isValid)
    .filter(it => matchesQuery(it, q) && matchesFilters(it));
  defaultSortByArtist(state.filtered);
  state.limit = 50;
  renderList();
}
function clearAll(){
  inputEl.value = "";
  state.filters.genres.clear();
  Array.from(genreChips.children).forEach(c=> c.classList.remove('active'));
  applyFilters();
  inputEl.focus();
}
function buildGenreChips(){
  const set = new Set(state.data.map(d => (d.genre||"").trim()).filter(Boolean));
  const arr = [...set].sort((a,b)=> a.localeCompare(b, 'ko', {sensitivity:'base'}));
  genreChips.innerHTML = "";
  arr.forEach(val=>{
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

// ----- Render
function renderList(){
  const total = state.filtered.length;
  const shown = Math.min(state.limit, total);
  countEl.textContent = `${total}개 앨범 중 ${shown}개 표시`;
  listEl.innerHTML = "";

  if (total === 0){
    listEl.innerHTML = `<p style="opacity:.9;margin:12px">표시할 항목이 없습니다.</p>`;
    moreWrap.innerHTML = "";
    return;
  }

  const frag = document.createDocumentFragment();
  state.filtered.slice(0, shown).forEach(it=>{
    const row = document.createElement('article');
    row.className = 'row';
    row.tabIndex = 0;
    row.addEventListener('click', ()=> openDetail(it));
    row.addEventListener('keydown', (e)=>{ if(e.key==='Enter') openDetail(it); });

    const img = document.createElement('img');
    img.className = 'thumb';
    img.loading = 'lazy';
    img.src = proxify(it.cover, { w:150, h:150, fit:'cover' }) || COVER_PLACEHOLDER;
    img.onerror = ()=>{ img.src = COVER_PLACEHOLDER; };

    const info = document.createElement('div');
    info.className = 'info';

    const album = document.createElement('p');
    album.className = 'album';
    album.textContent = it.album || "(제목 없음)";

    const artist = document.createElement('p');
    artist.className = 'artist';
    artist.textContent = it.artist || "";

    const meta = document.createElement('p');
    meta.className = 'meta';
    meta.textContent = [it.year, it.genre].filter(Boolean).join(' · ');

    const tracks = document.createElement('p');
    tracks.className = 'tracks';
    tracks.textContent = (it.tracks||[]).join(' · ');

    info.appendChild(album);
    info.appendChild(artist);
    info.appendChild(meta);
    info.appendChild(tracks);

    row.appendChild(img);
    row.appendChild(info);
    frag.appendChild(row);
  });
  listEl.appendChild(frag);

  moreWrap.innerHTML = "";
  if (shown < total){
    const more = document.createElement('button');
    more.className = 'btn primary';
    more.textContent = '더보기';
    more.addEventListener('click', ()=>{ state.limit += 50; renderList(); });
    moreWrap.appendChild(more);
  }
}

// ----- Detail
function renderDetail(it){
  dCover.loading = 'lazy';
  dCover.src = proxify(it.cover, { w:900, h:900, fit:'contain' }) || COVER_PLACEHOLDER;
  dCover.onerror = ()=>{ dCover.src = COVER_PLACEHOLDER; };

  dAlbum.textContent = it.album || "";
  dArtist.textContent = it.artist || "";
  dTracks.innerHTML = (it.tracks||[]).map(t=>`<li>${t}</li>`).join('');
}
function openDetail(it){
  state.currentItem = it;
  renderDetail(it);

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

// ----- Router (direct link safe)
function enforceRoute(){
  const h = (location.hash||"").toLowerCase();
  if (h === '#detail'){
    if (!state.currentItem){
      backToList();
    }else{
      listPage.classList.add('hidden');
      toolbar.classList.add('hidden');
      detailPage.classList.remove('hidden');
      detailHdr.classList.remove('hidden');
      document.body.classList.add('detail-mode');
      if (appHeader) appHeader.style.borderBottom = 'none';
    }
  }else{
    backToList();
  }
}

// ----- Init
async function init(){
  try{
    countEl.textContent = '불러오는 중…';
    // 1) fetch raw CSV text
    const csvText = await fetchCSVText(SHEET_CSV_URL);
    console.log('[CSV bytes]', csvText.length);

    // 2) parse text to rows
    const rows = parseCSVText(csvText);
    console.log('[Parsed rows]', rows.length, rows[0]);

    // 3) map + filter
    state.data = rows.map(mapRow).filter(isValid);
    console.log('[Valid items]', state.data.length);

    // 4) build UI
    defaultSortByArtist(state.data);
    state.filtered = state.data.slice();
    buildGenreChips();
    renderList();

    // 5) routing
    enforceRoute();
  }catch(err){
    console.error('LOAD ERROR:', err);
    const msg = (err && err.message) ? err.message : String(err);
    document.body.insertAdjacentHTML('beforeend',
      `<div style="position:sticky;bottom:0;left:0;right:0;background:#300;color:#fff;padding:10px;border-top:1px solid #900;z-index:9999">
         데이터 로딩 실패: ${msg}<br>
         <small>CSV URL 접근/공유, 네트워크, CORS 상태를 확인하세요.</small>
       </div>`);
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
