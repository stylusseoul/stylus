// Stylus Vinyl — script.js (v10.9_stable)
// - 영어 헤더 기준 (Artist / Album / Year / Genre / Cover / Tracks)
// - 데이터 로드 후 렌더 타이밍 보장
// - config.js 불필요 (URL 내장)
// - like 검색, 50개씩 로딩, 상세/뒤로가기 안정화

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTXikyTZ6Abe3Ome-3JYTQK83jSC7vpQXKBPqLuGhNLVmn_1Dzh48iVB77w_9GbUCHO4VuK2K3LZ48P/pub?output=csv";
const COVER_PLACEHOLDER = "images/placeholder.png";

const state = {
  data: [],
  filtered: [],
  filters: { genres: new Set() },
  limit: 50,
  currentItem: null,
};

// DOM refs
const listPage = document.getElementById('listPage');
const detailPage = document.getElementById('detailPage');
const toolbar = document.getElementById('toolbar');
const detailHdr = document.getElementById('detailHeader');
const listEl = document.getElementById('list');
const inputEl = document.getElementById('searchInput');
const btnSearch = document.getElementById('btnSearch');
const btnReset = document.getElementById('btnReset');
const genreChips = document.getElementById('genreChips');
const countEl = document.getElementById('count');
const moreWrap = document.getElementById('moreWrap');
const dCover = document.getElementById('dCover');
const dAlbum = document.getElementById('dAlbum');
const dArtist = document.getElementById('dArtist');
const dTracks = document.getElementById('dTracks');
const btnBack = document.getElementById('btnBack');
const appHeader = document.querySelector('.header');

// --- Helpers ---
function toArray(s) {
  if (!s) return [];
  return s.split(/;|·|\||,/).map(x => x.trim()).filter(Boolean);
}
function mapRow(row) {
  return {
    artist: row["Artist"]?.trim() || "",
    album: row["Album"]?.trim() || "",
    year: String(row["Year"] || ""),
    genre: row["Genre"]?.trim() || "",
    cover: row["Cover"]?.trim() || "",
    tracks: toArray(row["Tracks"]),
  };
}
function proxify(url, { w = null, h = null, fit = 'cover' } = {}) {
  if (!url) return "";
  let clean = String(url).replace(/^https?:\/\//, '');
  let q = `https://images.weserv.nl/?url=${encodeURIComponent(clean)}&fit=${fit}`;
  if (w) q += `&w=${w}`;
  if (h) q += `&h=${h}`;
  return q;
}

// --- Core ---
async function fetchCSV() {
  return new Promise((resolve, reject) => {
    Papa.parse(SHEET_CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: res => resolve(res.data.map(mapRow)),
      error: reject,
    });
  });
}
function isValid(it) {
  return (it.album || it.artist) && it.album.toUpperCase() !== "OK";
}
function applyFilters() {
  const q = inputEl.value.toLowerCase();
  state.filtered = state.data.filter(it => {
    if (!isValid(it)) return false;
    const hay = `${it.artist} ${it.album} ${it.tracks.join(' ')} ${it.genre}`.toLowerCase();
    return hay.includes(q);
  });
  state.limit = 50;
  renderList();
}
function renderList() {
  const total = state.filtered.length;
  const shown = Math.min(total, state.limit);
  countEl.textContent = `${total}개 중 ${shown}개 표시`;
  listEl.innerHTML = "";

  const frag = document.createDocumentFragment();
  state.filtered.slice(0, shown).forEach(it => {
    const row = document.createElement('article');
    row.className = 'row';
    row.innerHTML = `
      <img class="thumb" src="${proxify(it.cover, { w:150, h:150 }) || COVER_PLACEHOLDER}" loading="lazy" alt="">
      <div class="info">
        <p class="album">${it.album}</p>
        <p class="artist">${it.artist}</p>
        <p class="meta">${[it.year, it.genre].filter(Boolean).join(' · ')}</p>
        <p class="tracks">${it.tracks.slice(0,3).join(' · ')}</p>
      </div>`;
    row.addEventListener('click', () => openDetail(it));
    frag.appendChild(row);
  });
  listEl.appendChild(frag);

  moreWrap.innerHTML = "";
  if (shown < total) {
    const btn = document.createElement('button');
    btn.textContent = "더보기";
    btn.className = "btn primary";
    btn.onclick = () => { state.limit += 50; renderList(); };
    moreWrap.appendChild(btn);
  }
}
function renderDetail(it) {
  dCover.src = proxify(it.cover, { w:900, h:900 }) || COVER_PLACEHOLDER;
  dAlbum.textContent = it.album;
  dArtist.textContent = it.artist;
  dTracks.innerHTML = it.tracks.map(t => `<li>${t}</li>`).join('');
}
function openDetail(it) {
  renderDetail(it);
  listPage.classList.add('hidden');
  toolbar.classList.add('hidden');
  detailPage.classList.remove('hidden');
  detailHdr.classList.remove('hidden');
  document.body.classList.add('detail-mode');
}
function backToList() {
  listPage.classList.remove('hidden');
  toolbar.classList.remove('hidden');
  detailPage.classList.add('hidden');
  detailHdr.classList.add('hidden');
  document.body.classList.remove('detail-mode');
}

// --- Init ---
async function init() {
  countEl.textContent = "불러오는 중…";
  const data = await fetchCSV();
  state.data = data.filter(isValid);
  state.filtered = [...state.data];
  renderList();
  countEl.textContent = `${state.filtered.length}개 앨범`;
}

btnSearch.onclick = applyFilters;
btnReset.onclick = () => { inputEl.value = ""; applyFilters(); };
btnBack.onclick = backToList;

init();
