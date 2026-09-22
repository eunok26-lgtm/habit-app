/* ==========================================================
   엄마표 영어 (잠수네 방식) — "영어" 탭

   index.html 의 전역(db, save, $, esc, toast, todayKey, 소리 …)을 그대로 씁니다.
   기록은 db.english 에 들어가서 습관 앱 기록과 함께 저장됩니다.

   db.english = {
     level:'J2', goals:{listen,focus,read,korean}(분),
     books:[{id,title,level,series,yt,where,due,react,reads,listens,hears,lastAt,addedAt,updatedAt}],
            (listens = 집중듣기 횟수, hears = 흘려듣기 횟수, reads = 읽기 횟수)
     log:{ 'YYYY-MM-DD': {listen,focus,read,korean}(초) + books:[{id,title,t:'focus'|'listen'|'read',at}] },
     videos:[{id,title,yt,views,lastAt,addedAt,updatedAt}],   ← 흘려듣기 영상
     log[날짜].vids:[{id,title,at}]                             ← 그 날 본 영상
     run:{ 카테고리: {startedAt, day} }      ← 켜져 있는 스톱워치
   }
   ========================================================== */
(function(){

const CATS = [
  {id:'listen', name:'흘려듣기',   emo:'🎧', desc:'영상·오디오 틀어두기',   c:'#8ecae6'},
  {id:'focus',  name:'집중듣기',   emo:'👂', desc:'들으면서 글자 따라가기', c:'#ff9f43'},
  {id:'read',   name:'영어책 읽기', emo:'📖', desc:'쉬운 책을 소리 내어',   c:'#2ec27e'},
  {id:'korean', name:'한글책',     emo:'📚', desc:'한글책도 꼭 함께',      c:'#b8a4e3'}
];
const CAT = Object.fromEntries(CATS.map(c=>[c.id, c]));
const LEVELS = ['J1','J2','J3','J4','J5','J6','J7','J8','J9'];
/* J2 무렵(적응~발전 과정)에 맞춘 시작값 — 설정에서 바꿀 수 있습니다 */
const DEFAULT_GOALS = {listen:60, focus:20, read:20, korean:30};
const REACT = [['love','😍 좋아해요'], ['ok','🙂 그냥 그래요'], ['no','🙅 싫어해요']];
const REACT_EMO = {love:'😍', ok:'🙂', no:'🙅'};
const MAX_RUN = 3*60*60;     // 스톱워치를 켜 두고 잊어도 3시간까지만 셉니다
const COVER_COLORS = ['#ffd97d','#8ecae6','#b8a4e3','#f6a6c1','#9fd8a0','#ffc49b','#a6d8d4'];

/* ---------- 저장소 ---------- */
function E(){
  const e = db.english || (db.english = {});
  e.level = e.level || 'J2';
  e.goals = e.goals || {...DEFAULT_GOALS};
  e.books = e.books || [];
  e.log   = e.log   || {};
  e.run   = e.run   || {};
  e.videos = e.videos || [];
  return e;
}
function peek(k){ return E().log[k] || null; }
function logOf(k){
  const L = E().log;
  return L[k] || (L[k] = {listen:0, focus:0, read:0, korean:0, books:[]});
}
function bookOf(id){ return E().books.find(b=>b.id === id); }
function vidOf(id){ return E().videos.find(v=>v.id === id); }

/* ---------- 시간 ---------- */
const pad = n => String(n).padStart(2,'0');
function runSec(cat){
  const r = E().run[cat];
  return r ? Math.min(MAX_RUN, Math.max(0, Math.floor((Date.now() - r.startedAt)/1000))) : 0;
}
function secOf(cat, k){
  const l = peek(k);
  let s = l ? (l[cat] || 0) : 0;
  const r = E().run[cat];
  if(r && r.day === k) s += runSec(cat);
  if(P && cat === P.cat && k === todayKey()) s += pendingSec();
  return s;
}
function fmtMin(s){
  const m = Math.floor(s/60);
  if(m < 60) return m + '분';
  return Math.floor(m/60) + '시간' + (m%60 ? ' ' + (m%60) + '분' : '');
}
function clockOf(s){
  const h = Math.floor(s/3600), m = Math.floor(s%3600/60);
  return (h ? h + ':' + pad(m) : m) + ':' + pad(s%60);
}
function daysLeft(k){ return Math.round((parseKey(k) - parseKey(todayKey())) / 86400000); }

function addSec(k, cat, s){
  if(!s) return;
  const l = logOf(k);
  l[cat] = Math.max(0, (l[cat] || 0) + s);
  save();
  checkGoals();
}

function startRun(cat){
  E().run[cat] = {startedAt:Date.now(), day:todayKey()};
  save(); soundStart();
}
function stopRun(cat){
  const r = E().run[cat]; if(!r) return;
  const raw = Math.floor((Date.now() - r.startedAt)/1000);
  const s = runSec(cat);
  delete E().run[cat];
  addSec(r.day, cat, s);
  soundCheck();
  if(raw > MAX_RUN) toast('너무 오래 켜져 있어서 3시간까지만 넣었어요');
}

/* 목표를 처음 채운 순간에만 알려 줍니다 */
function checkGoals(){
  const k = todayKey(), g = E().goals;
  const withGoal = CATS.filter(c => g[c.id] > 0);
  if(!withGoal.length) return;
  const l = logOf(k);
  l.hit = l.hit || {};
  let fresh = null;
  withGoal.forEach(c=>{
    if(!l.hit[c.id] && secOf(c.id, k) >= g[c.id]*60){ l.hit[c.id] = 1; fresh = c; }
  });
  if(!fresh) return;
  save();
  if(!l.allHit && withGoal.every(c => l.hit[c.id])){
    l.allHit = 1; save();
    $('#cheerTitle').textContent = '오늘 영어 끝!';
    $('#cheerSub').textContent   = '듣고, 읽고, 다 해냈어요. 정말 멋져요!';
    celebrate();
  }else{
    soundFinish();
    toast(`${fresh.emo} ${fresh.name} 목표를 채웠어요! 🌟`);
  }
  if(isOpen() && tab === 'today') paintToday();
}
/* 축하 화면 문구를 원래대로 (할 일 탭과 같이 씁니다) */
$('#cheerClose').addEventListener('click', ()=>{
  $('#cheerTitle').textContent = '오늘 할 일 끝!';
  $('#cheerSub').textContent   = '전부 다 해냈어요. 정말 잘했어요!';
});

/* ---------- 유튜브 주소 ---------- */
function parseYT(s){
  s = (s || '').trim();
  if(!s) return null;
  if(/^[\w-]{11}$/.test(s)) return {v:s, list:null};
  let u;
  try{ u = new URL(/^https?:\/\//.test(s) ? s : 'https://' + s); }catch(e){ return null; }
  const h = u.hostname.replace(/^(www|m|music)\./, '');
  let v = null;
  if(h === 'youtu.be') v = u.pathname.slice(1).split('/')[0];
  else if(/^youtube(-nocookie)?\.com$/.test(h)){
    v = u.searchParams.get('v');
    const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([\w-]{11})/);
    if(m) v = m[2];
  }else return null;
  if(v && !/^[\w-]{11}$/.test(v)) v = null;
  const list = u.searchParams.get('list');
  if(!v && !list) return null;
  return {v, list};
}
function ytWatchURL(y){
  if(!y) return '';
  return y.v ? `https://www.youtube.com/watch?v=${y.v}` + (y.list ? `&list=${y.list}` : '')
             : `https://www.youtube.com/playlist?list=${y.list}`;
}
function ytSearch(q){
  window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(q), '_blank');
}

/* ---------- 표지 ---------- */
function colorOf(s){
  let h = 0; for(const ch of String(s)) h = (h*31 + ch.charCodeAt(0)) >>> 0;
  return COVER_COLORS[h % COVER_COLORS.length];
}
function coverHTML(b, cls){
  const y = parseYT(b.yt);
  if(y && y.v)
    return `<div class="en-cover ${cls||''}" style="background-image:url('https://i.ytimg.com/vi/${y.v}/mqdefault.jpg')"></div>`;
  return `<div class="en-cover txt ${cls||''}" style="background:${colorOf(b.series || b.title)}"><span>${esc(b.title)}</span></div>`;
}
function dueTag(b){
  if(b.where !== 'lib' || !b.due) return '';
  const d = daysLeft(b.due);
  const t = d < 0 ? `반납 ${-d}일 지남` : d === 0 ? '오늘 반납' : `반납 D-${d}`;
  return `<span class="en-duetag ${d <= 2 ? 'soon' : ''}">${t}</span>`;
}

/* ==========================================================
   모달 — 이 파일에서 쓰는 창들을 만들어 붙입니다
   ========================================================== */
document.body.insertAdjacentHTML('beforeend', `
<div class="modal" id="enAddModal">
  <div class="sheet" style="max-width:420px">
    <h3 id="enAddTitle">시간 넣기</h3>
    <p class="sub">차에서 들었거나 타이머를 깜빡했을 때 여기서 넣어요.</p>
    <div class="en-quick" id="enAddPlus">
      <button data-q="300">+5분</button><button data-q="600">+10분</button>
      <button data-q="1200">+20분</button><button data-q="1800">+30분</button>
      <button data-q="3600">+1시간</button>
    </div>
    <div class="en-quick minus" id="enAddMinus" style="margin-top:8px">
      <button data-q="-300">−5분</button><button data-q="-600">−10분</button>
    </div>
    <p class="en-sum">오늘 합계<b id="enAddSum">0분</b></p>
    <div class="row"><button class="btn ghost wide" data-enclose>닫기</button></div>
  </div>
</div>

<div class="modal" id="enPickModal">
  <div class="sheet tall" style="max-width:520px">
    <h3 id="enPickTitle">책 고르기</h3>
    <p class="sub" id="enPickSub"></p>
    <div class="en-seg en-pseg" id="enPickSeg">
      <button type="button" data-src="book">📚 책 음원</button>
      <button type="button" data-src="video">📺 영상</button>
    </div>
    <input type="text" id="enPickQ" placeholder="🔎 제목이나 시리즈로 찾기">
    <div class="en-plist" id="enPickList"></div>
    <div class="row">
      <button class="btn ghost" data-enclose>닫기</button>
      <button class="btn accent" id="enPickNew">＋ 새 책 넣기</button>
    </div>
  </div>
</div>

<div class="modal" id="enPlayModal">
  <div class="sheet en-psheet">
    <div class="en-ptitle" id="enPTitle"></div>
    <div id="enPVid"></div>
    <div class="en-pinfo" id="enPInfo"></div>
    <div class="row">
      <button class="btn ghost" id="enPClose">닫기</button>
      <button class="btn" id="enPToggle">⏸ 잠깐 멈춤</button>
      <button class="btn accent" id="enPDone">다 들었어요 ✓</button>
    </div>
  </div>
</div>

<div class="modal" id="enFormModal">
  <div class="sheet tall">
    <h3 id="enFTitle">책 넣기</h3>
    <p class="sub" id="enFSub">레벨은 대충 맞아도 괜찮아요. 나중에 고칠 수 있어요.</p>

    <div class="pick" id="enFMode">
      <button type="button" data-fm="one">한 권</button>
      <button type="button" data-fm="many">여러 권 한꺼번에</button>
    </div>

    <div id="enFOne">
      <label class="fl">책 제목</label>
      <input type="text" id="enFName" placeholder="예: Biff's Aeroplane" autocomplete="off">
    </div>
    <div id="enFMany" style="display:none">
      <label class="fl">책 제목 — 한 줄에 한 권</label>
      <textarea id="enFList" placeholder="Floppy's Bone | https://youtu.be/…&#10;The Big Egg&#10;Hide and Seek | https://youtu.be/…"></textarea>
      <p class="hint" style="margin-top:8px">제목 뒤에 <b>|</b> 를 넣고 유튜브 주소를 붙이면 집중듣기 영상도 같이 들어가요.</p>
    </div>

    <label class="fl">레벨</label>
    <div class="pick" id="enFLevel"></div>

    <label class="fl">시리즈 <span style="font-weight:600">— 없으면 비워 두세요</span></label>
    <input type="text" id="enFSeries" list="enSeriesList" placeholder="예: Oxford Reading Tree 2" autocomplete="off">
    <datalist id="enSeriesList"></datalist>

    <div id="enFYtWrap">
      <label class="fl">집중듣기 유튜브 주소</label>
      <div class="en-ytrow">
        <input type="text" id="enFYt" placeholder="https://youtu.be/…" autocomplete="off">
        <button type="button" class="btn ghost" id="enFFind">🔎 찾기</button>
      </div>
      <div class="en-ytprev" id="enFYtPrev"></div>
    </div>

    <label class="fl">어디 있는 책?</label>
    <div class="pick" id="enFWhere">
      <button type="button" data-w="home">🏠 우리집</button>
      <button type="button" data-w="lib">🏛 도서관</button>
    </div>
    <div id="enFDueWrap" style="display:none">
      <label class="fl">반납일</label>
      <input type="date" id="enFDue">
    </div>

    <label class="fl">아이 반응</label>
    <div class="pick en-react" id="enFReact"></div>

    <div class="row">
      <button class="btn ghost" data-enclose>취소</button>
      <button class="btn accent" id="enFSave">넣기</button>
    </div>
    <button class="btn ghost wide" id="enFDel" style="margin:10px 0 22px; color:#c0392b">🗑 이 책 지우기</button>
  </div>
</div>

<div class="modal" id="enVidModal">
  <div class="sheet" style="max-width:460px">
    <h3 id="enVTitle">영상 넣기</h3>
    <p class="sub">흘려듣기로 볼 영상이에요. 재생목록 주소를 넣으면 차례로 이어서 나와요.</p>
    <label class="fl">이름</label>
    <input type="text" id="enVName" placeholder="예: Peppa Pig 시즌 1" autocomplete="off">
    <label class="fl">유튜브 주소</label>
    <div class="en-ytrow">
      <input type="text" id="enVYt" placeholder="https://youtu.be/… 또는 재생목록 주소" autocomplete="off">
      <button type="button" class="btn ghost" id="enVFind">🔎 찾기</button>
    </div>
    <div class="en-ytprev" id="enVYtPrev"></div>
    <div class="row">
      <button class="btn ghost" data-enclose>취소</button>
      <button class="btn accent" id="enVSave">넣기</button>
    </div>
    <button class="btn ghost wide" id="enVDel" style="margin-top:10px; color:#c0392b">🗑 이 영상 지우기</button>
  </div>
</div>

<div class="modal" id="enDetailModal">
  <div class="sheet" style="max-width:440px" id="enDetail"></div>
</div>
`);

function openM(id){ $('#' + id).classList.add('open'); }
function closeM(id){ $('#' + id).classList.remove('open'); }
document.querySelectorAll('#enAddModal,#enPickModal,#enFormModal,#enVidModal,#enDetailModal').forEach(m=>{
  m.addEventListener('click', e=>{
    if(e.target === m || e.target.closest('[data-enclose]')) closeM(m.id);
  });
});
$('#enPlayModal').addEventListener('click', e=>{ if(e.target.id === 'enPlayModal') closePlayer(); });

/* ==========================================================
   화면
   ========================================================== */
let tab = 'today';
let shelfF = 'all', shelfQ = '';
const isOpen = () => $('#viewEng') && $('#viewEng').style.display !== 'none';

function render(){
  $('#viewEng').innerHTML = `
    <div class="en-seg" id="enSeg">
      ${[['today','오늘'],['shelf','책장'],['stats','기록']]
        .map(([id,n])=>`<button data-tab="${id}" class="${tab===id?'on':''}">${n}</button>`).join('')}
    </div>
    <div id="enBody"></div>`;
  paint();
}
function paint(){
  if(tab === 'today') paintToday();
  else if(tab === 'shelf') paintShelf();
  else paintStats();
}

/* ---------- 오늘 ---------- */
function paintToday(){
  const e = E(), k = todayKey(), l = peek(k);
  const got = (l && l.books) || [];

  const due = e.books.filter(b => b.where === 'lib' && b.due && daysLeft(b.due) <= 3)
                     .sort((a,b)=> a.due < b.due ? -1 : 1);
  const dueHTML = due.length
    ? `<div class="en-due">🏛 도서관 반납 — ${due.map(b=>{
        const d = daysLeft(b.due);
        return `<b>${esc(b.title)}</b> ${d < 0 ? `(${-d}일 지났어요)` : d === 0 ? '(오늘!)' : `(${d}일 남음)`}`;
      }).join(', ')}</div>`
    : '';

  $('#enBody').innerHTML = dueHTML + CATS.map(c=>{
    const chips = got.map((b,i)=>({...b, i})).filter(b => b.t === c.id);
    const vids = ((l && l.vids) || []).map((v,i)=>({...v, i}));
    const sub = c.id === 'listen' ? `
      <div class="en-sub">
        <button class="en-pickbtn" data-pick="watch">🎧 골라서 듣기·보기</button>
        ${chips.map(b=>`<span class="en-chip"><span class="t">${esc(b.title)}</span><button class="x" data-unlog="${b.i}" aria-label="빼기">✕</button></span>`).join('')}
        ${vids.map(v=>`<span class="en-chip"><span class="t">${esc(v.title)}</span><button class="x" data-unvid="${v.i}" aria-label="빼기">✕</button></span>`).join('')}
        <button class="en-addt" data-addt="${c.id}">＋ 시간 넣기</button>
      </div>`
    : (c.id === 'focus' || c.id === 'read') ? `
      <div class="en-sub">
        <button class="en-pickbtn" data-pick="${c.id}">${c.id === 'focus' ? '📕 책 골라서 듣기' : '📗 읽은 책 체크'}</button>
        ${chips.map(b=>`<span class="en-chip"><span class="t">${esc(b.title)}</span><button class="x" data-unlog="${b.i}" aria-label="빼기">✕</button></span>`).join('')}
        <button class="en-addt" data-addt="${c.id}">＋ 시간 넣기</button>
      </div>` : `
      <div class="en-sub" style="border-top:none; padding-top:0; margin-top:4px">
        <button class="en-addt" data-addt="${c.id}">＋ 시간 넣기</button>
      </div>`;
    return `
      <div class="en-card" data-cat="${c.id}" style="--c:${c.c}">
        <div class="en-row">
          <span class="en-ico">${c.emo}</span>
          <div class="en-main">
            <div class="en-name">${c.name} <span class="en-desc">${c.desc}</span></div>
            <div class="en-bar"><i></i></div>
            <div class="en-min"></div>
          </div>
          <button class="en-go" data-go="${c.id}"></button>
        </div>
        ${sub}
      </div>`;
  }).join('') + `
    <p class="en-foot">지금 레벨 <b>${esc(e.level)}</b> · 목표 시간은 ⚙️ 설정에서 바꿀 수 있어요.<br>
    다 못 채워도 괜찮아요. 매일 조금씩이 제일 중요해요.</p>`;

  updateCards();
}

/* 1초마다 숫자만 바꿉니다 (전체를 다시 그리지 않게) */
function updateCards(){
  const k = todayKey(), g = E().goals;
  CATS.forEach(c=>{
    const card = document.querySelector(`.en-card[data-cat="${c.id}"]`); if(!card) return;
    const s = secOf(c.id, k), goal = (g[c.id] || 0) * 60;
    const hit = goal > 0 && s >= goal;
    card.classList.toggle('hit', hit);
    card.querySelector('.en-bar').style.display = goal ? '' : 'none';
    card.querySelector('.en-bar i').style.width = (goal ? Math.min(100, s/goal*100) : 0) + '%';
    card.querySelector('.en-min').innerHTML = hit
      ? `<b>${fmtMin(s)}</b> · 목표를 채웠어요! 🌟`
      : `<b>${fmtMin(s)}</b>${goal ? ` / ${g[c.id]}분` : ''}`;
    const btn = card.querySelector('.en-go');
    const run = E().run[c.id];
    btn.classList.toggle('run', !!run);
    btn.textContent = run ? `⏸ ${clockOf(runSec(c.id))}` : '▶ 시작';
  });
}

$('#viewEng').addEventListener('click', e=>{
  const t = e.target;

  const sg = t.closest('#enSeg [data-tab]');
  if(sg){
    tab = sg.dataset.tab;
    document.querySelectorAll('#enSeg button').forEach(b=>b.classList.toggle('on', b === sg));
    return paint();
  }

  const go = t.closest('[data-go]');
  if(go){
    const c = go.dataset.go;
    if(E().run[c]) stopRun(c); else startRun(c);
    return paintToday();
  }

  const ad = t.closest('[data-addt]');
  if(ad) return openAdd(ad.dataset.addt);

  const pk = t.closest('[data-pick]');
  if(pk) return openPick(pk.dataset.pick);

  const uv = t.closest('[data-unvid]');
  if(uv){
    const l = peek(todayKey()); if(!l || !l.vids) return;
    const [x] = l.vids.splice(Number(uv.dataset.unvid), 1);
    const v = x && vidOf(x.id);
    if(v){ v.views = Math.max(0, (v.views||0) - 1); v.updatedAt = Date.now(); }
    save(); soundUndo(); paintToday();
    return toast('뺐어요');
  }

  const un = t.closest('[data-unlog]');
  if(un){
    const l = peek(todayKey()); if(!l) return;
    const [x] = l.books.splice(Number(un.dataset.unlog), 1);
    const b = x && bookOf(x.id);
    if(b){
      const f = x.t === 'read' ? 'reads' : x.t === 'listen' ? 'hears' : 'listens';
      b[f] = Math.max(0, (b[f]||0) - 1);
      b.updatedAt = Date.now();
    }
    save(); soundUndo(); paintToday();
    return toast('뺐어요');
  }

  /* 책장 */
  if(t.id === 'enNew') return openForm(null);
  const fb = t.closest('[data-f]');
  if(fb){ shelfF = fb.dataset.f; return paintShelf(); }
  const tl = t.closest('[data-book]');
  if(tl) return openDetail(tl.dataset.book);
});
$('#viewEng').addEventListener('input', e=>{
  if(e.target.id === 'enQ'){ shelfQ = e.target.value; paintShelfGrid(); }
});

/* ---------- 시간 직접 넣기 ---------- */
let addCat = null;
function openAdd(cat){
  addCat = cat;
  $('#enAddTitle').textContent = `${CAT[cat].emo} ${CAT[cat].name} 시간 넣기`;
  $('#enAddSum').textContent = fmtMin(secOf(cat, todayKey()));
  openM('enAddModal');
}
$('#enAddModal').addEventListener('click', e=>{
  const b = e.target.closest('[data-q]'); if(!b || !addCat) return;
  const q = Number(b.dataset.q);
  const k = todayKey(), l = logOf(k);
  if(q < 0 && (l[addCat] || 0) <= 0) return toast('뺄 시간이 없어요');
  addSec(k, addCat, q);
  q > 0 ? soundCheck() : soundUndo();
  $('#enAddSum').textContent = fmtMin(secOf(addCat, k));
  if(isOpen() && tab === 'today') paintToday();
});

/* ---------- 책 고르기 ---------- */
let pickMode = 'focus';
let pickSrc  = 'book';        // 흘려듣기에서 고르는 것: 'book'(책 음원) | 'video'(영상)
const pickVideo = () => pickMode === 'watch' && pickSrc === 'video';
function openPick(mode){
  pickMode = mode;
  $('#enPickTitle').textContent = mode === 'focus' ? '📕 어떤 책을 들을까?'
                                : mode === 'watch' ? '🎧 무엇을 들을까?' : '📗 어떤 책을 읽었나요?';
  $('#enPickSeg').style.display = mode === 'watch' ? '' : 'none';
  $('#enPickQ').value = '';
  paintPickHead();
  paintPick();
  openM('enPickModal');
}
function paintPickHead(){
  [...$('#enPickSeg').children].forEach(b=>b.classList.toggle('on', b.dataset.src === pickSrc));
  $('#enPickSub').textContent = pickMode === 'focus'
    ? '▶ 가 붙은 책은 바로 영상이 나와요. 없는 책은 CD나 세이펜으로 들어요.'
    : pickMode === 'watch'
      ? (pickSrc === 'video'
          ? '영상이 끝나면 화면이 저절로 닫혀요. 보는 동안 흘려듣기 시간이 쌓여요.'
          : '집중듣기로 들었던 책을 편하게 틀어 두어요. 끝나면 저절로 닫혀요.')
    : '누르면 바로 체크돼요. 같은 책을 여러 번 읽어도 좋아요!';
  $('#enPickQ').placeholder = pickVideo() ? '🔎 영상 이름으로 찾기' : '🔎 제목이나 시리즈로 찾기';
  $('#enPickNew').textContent = pickVideo() ? '＋ 새 영상 넣기' : '＋ 새 책 넣기';
}
$('#enPickSeg').addEventListener('click', e=>{
  const b = e.target.closest('[data-src]'); if(!b) return;
  pickSrc = b.dataset.src;
  $('#enPickQ').value = '';
  paintPickHead(); paintPick();
});
function paintPick(){
  const q = $('#enPickQ').value.trim().toLowerCase();
  if(pickVideo()){
    const vs = E().videos.filter(v => !q || v.title.toLowerCase().includes(q))
      .sort((a,b)=> (b.lastAt||0) - (a.lastAt||0) || a.title.localeCompare(b.title));
    $('#enPickList').innerHTML = vs.length ? vs.map(v=>{
      const y = parseYT(v.yt);
      return `
      <div class="en-prow" data-pv="${v.id}" role="button">
        ${coverHTML(v, 'sm')}
        <span class="m">
          <span class="n">${esc(v.title)}</span>
          <span class="s">📺 ${v.views||0}번 봤어요${y && y.list ? ' · 재생목록' : ''}</span>
        </span>
        <button class="en-vedit" data-ve="${v.id}" aria-label="고치기">✏️</button>
        <span class="go">▶</span>
      </div>`;
    }).join('')
    : `<div class="empty" style="padding:30px"><b>📺</b>${q ? '찾는 영상이 없어요.' : '아직 영상이 없어요.<br>아래 <b>＋ 새 영상 넣기</b>로 시작해요.'}</div>`;
    return;
  }
  let list = E().books.filter(b => !q || (b.title + ' ' + (b.series||'')).toLowerCase().includes(q));
  const rank = b => (pickMode !== 'read' && !parseYT(b.yt) ? 2 : 0) + (b.react === 'no' ? 1 : 0);
  list.sort((a,b)=> rank(a) - rank(b) || (b.lastAt||0) - (a.lastAt||0) || a.title.localeCompare(b.title));

  $('#enPickList').innerHTML = list.length ? list.map(b=>`
    <button class="en-prow" data-pb="${b.id}">
      ${coverHTML(b, 'sm')}
      <span class="m">
        <span class="n">${esc(b.title)}</span>
        <span class="s"><span class="en-lv">${esc(b.level)}</span>
          🎧${b.hears||0} 👂${b.listens||0} 📖${b.reads||0} ${REACT_EMO[b.react]||''} ${dueTag(b)}</span>
      </span>
      <span class="go">${pickMode === 'read' ? '✓' : (parseYT(b.yt) ? '▶' : '💿')}</span>
    </button>`).join('')
  : `<div class="empty" style="padding:30px"><b>📚</b>${q ? '찾는 책이 없어요.' : '아직 책장이 비어 있어요.<br>아래 <b>＋ 새 책 넣기</b>로 시작해요.'}</div>`;
}
$('#enPickQ').addEventListener('input', paintPick);
$('#enPickList').addEventListener('click', e=>{
  const ve = e.target.closest('[data-ve]');
  if(ve){ closeM('enPickModal'); return openVid(ve.dataset.ve); }
  const pv = e.target.closest('[data-pv]');
  if(pv){
    const v = vidOf(pv.dataset.pv); if(!v) return;
    closeM('enPickModal');
    return openPlayer(v, 'listen');
  }
  const r = e.target.closest('[data-pb]'); if(!r) return;
  const b = bookOf(r.dataset.pb); if(!b) return;
  closeM('enPickModal');
  pickMode === 'read' ? markRead(b) : openPlayer(b, pickMode === 'watch' ? 'listen' : 'focus');
});
$('#enPickNew').addEventListener('click', ()=>{
  const mode = pickMode;
  closeM('enPickModal');
  if(pickVideo()) return openVid(null);
  openForm(null, b => mode === 'read' ? markRead(b) : openPlayer(b, mode === 'watch' ? 'listen' : 'focus'));
});

/* ---------- 흘려듣기 영상 넣기 / 고치기 ---------- */
let vidId = null;
function openVid(id){
  const v = id ? vidOf(id) : null;
  vidId = id;
  $('#enVTitle').textContent = v ? '영상 고치기' : '영상 넣기';
  $('#enVSave').textContent  = v ? '저장' : '넣기';
  $('#enVDel').style.display = v ? '' : 'none';
  $('#enVName').value = v ? v.title : '';
  $('#enVYt').value   = v ? v.yt : '';
  paintVidPrev();
  openM('enVidModal');
  if(!v) setTimeout(()=>$('#enVName').focus(), 80);
}
function paintVidPrev(){
  const s = $('#enVYt').value.trim(), y = parseYT(s), el = $('#enVYtPrev');
  el.className = 'en-ytprev';
  if(!s){ el.innerHTML = '<span>🔎 찾기를 누르면 이름으로 유튜브를 찾아 줘요.</span>'; return; }
  if(!y){ el.classList.add('bad'); el.innerHTML = '유튜브 주소가 아닌 것 같아요'; return; }
  el.classList.add('ok');
  el.innerHTML = y.v
    ? `<img src="https://i.ytimg.com/vi/${y.v}/mqdefault.jpg" alt=""><span>✓ 영상 확인${y.list ? ' · 재생목록으로 이어져요' : ''}</span>`
    : '<span>✓ 재생목록 확인 — 처음부터 차례로 나와요</span>';
}
$('#enVYt').addEventListener('input', paintVidPrev);
$('#enVFind').addEventListener('click', ()=>{
  const q = $('#enVName').value.trim();
  if(!q) return toast('이름을 먼저 적어 주세요');
  ytSearch(q);
  toast('찾은 영상 주소를 복사해서 붙여 넣어 주세요');
});
$('#enVSave').addEventListener('click', ()=>{
  const title = $('#enVName').value.trim(), yt = $('#enVYt').value.trim();
  if(!title) return toast('이름을 적어 주세요');
  if(!parseYT(yt)) return toast('유튜브 주소를 넣어 주세요');
  const v = vidId ? vidOf(vidId) : null;
  if(v) Object.assign(v, {title, yt, updatedAt:Date.now()});
  else E().videos.push({id:uid(), title, yt, views:0, lastAt:0, addedAt:Date.now(), updatedAt:Date.now()});
  save(); closeM('enVidModal');
  toast(v ? '고쳤어요' : `📺 "${title}"을 넣었어요`);
  openPick('watch');
});
$('#enVDel').addEventListener('click', ()=>{
  const v = vidOf(vidId); if(!v) return;
  if(!confirm(`"${v.title}"을 지울까요?\n지금까지 본 기록은 그대로 남아요.`)) return;
  E().videos = E().videos.filter(x=>x.id !== v.id);
  save(); closeM('enVidModal');
  toast('지웠어요');
  openPick('watch');
});

function logBook(b, t){
  const l = logOf(todayKey());
  l.books.push({id:b.id, title:b.title, t, at:Date.now()});
  b.lastAt = Date.now(); b.updatedAt = Date.now();
}
function markRead(b){
  b.reads = (b.reads || 0) + 1;
  logBook(b, 'read');
  save(); soundCheck();
  toast(`📖 "${b.title}" ${b.reads}번째 읽었어요! 👏`);
  refresh();
}

/* ==========================================================
   플레이어 — 집중듣기(책)와 흘려듣기(영상)가 같이 씁니다.
   · 영상이 재생되는 동안만 시간을 셉니다.
   · 영상이 끝나면 바로 닫습니다. 유튜브가 끝 화면에 추천 영상을 띄우기 때문입니다.
     (재생목록은 마지막 영상이 끝날 때 닫습니다)
   ========================================================== */
let P = null;          // {item, cat, y, player, since, pend, marked}
let ytReady = null;

function loadYT(){
  if(window.YT && YT.Player) return Promise.resolve();
  if(ytReady) return ytReady;
  ytReady = new Promise((res, rej)=>{
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = ()=>{ if(prev) prev(); res(); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = ()=>{ ytReady = null; rej(); };
    document.head.appendChild(s);
    setTimeout(()=>{ if(!(window.YT && YT.Player)){ ytReady = null; rej(); } }, 15000);
  });
  return ytReady;
}

function pendingSec(){
  if(!P) return 0;
  return Math.floor(P.pend + (P.since ? (Date.now() - P.since)/1000 : 0));
}
/* 쌓인 시간을 기록으로 옮깁니다 (앱이 갑자기 닫혀도 잃지 않게 수시로) */
function flushPlayer(){
  if(!P) return;
  let s = P.pend + (P.since ? (Date.now() - P.since)/1000 : 0);
  if(P.since) P.since = Date.now();
  const whole = Math.floor(s);
  P.pend = s - whole;
  if(whole > 0) addSec(todayKey(), P.cat, whole);
}

/* cat: 'focus' 는 집중듣기, 'listen' 은 흘려듣기.
   item 은 책장의 책이거나 흘려듣기 영상 — 흘려듣기에서는 둘 다 틀 수 있습니다. */
function openPlayer(item, cat){
  cat = cat || 'focus';
  if(E().run[cat]) stopRun(cat);            // 스톱워치와 겹쳐 세지 않게
  const y = parseYT(item.yt);
  const watch = cat === 'listen';
  const isBook = !!bookOf(item.id);
  P = {item, cat, y, isBook, player:null, since:null, pend:0, marked:false};

  $('#enPTitle').innerHTML = esc(item.title) + (isBook ? ` <span class="en-lv">${esc(item.level)}</span>` : '');
  $('#enPToggle').style.display = watch && y ? '' : 'none';
  const box = $('#enPVid');
  if(y){
    box.className = 'en-video';
    box.innerHTML = '<div id="enYT"></div>';
    const me = P;
    loadYT().then(()=>{
      if(P !== me) return;
      /* 흘려듣기는 유튜브 버튼을 끄고 아래 앱 버튼으로만 조작합니다 */
      const pv = {playsinline:1, rel:0, iv_load_policy:3, controls: watch ? 0 : 1, disablekb: watch ? 1 : 0};
      if(y.list){ pv.list = y.list; if(!y.v) pv.listType = 'playlist'; }
      const opts = {host:'https://www.youtube-nocookie.com', width:'100%', height:'100%', playerVars:pv,
                    events:{onReady:onYTReady, onStateChange:onYTState, onError:onYTError}};
      if(y.v) opts.videoId = y.v;
      P.player = new YT.Player('enYT', opts);
    }).catch(()=> vidMsg('유튜브를 불러오지 못했어요.<br>인터넷 연결을 확인해 주세요.'));
  }else{
    box.className = 'en-novid';
    box.innerHTML = `<div class="e">💿</div>
      <div>이 책은 영상이 없어요.<br>CD나 세이펜으로 듣고, 다 들으면 아래 버튼을 눌러요.</div>`;
    P.since = Date.now();                    // 영상이 없으면 연 순간부터 셉니다
  }
  paintPlayer();
  openM('enPlayModal');
}

function vidMsg(html){
  if(!P) return;
  const url = ytWatchURL(P.y);
  $('#enPVid').innerHTML = `<div class="en-vmsg"><div style="font-size:40px">😢</div><div>${html}</div>
    ${url ? `<a href="${url}" target="_blank" rel="noopener">유튜브에서 직접 열기 ↗</a>` : ''}</div>`;
  P.player = null;
  if(P.isBook && !P.since) P.since = Date.now();   // 밖에서 듣는 동안도 세어 둡니다
  $('#enPToggle').style.display = 'none';
  paintPlayer();
}

function onYTReady(){
  if(!P || !P.player) return;
  const me = P;
  try{ P.player.playVideo(); }catch(e){}
  /* 아이패드는 한 번 직접 눌러야 재생되는 경우가 있어요 */
  setTimeout(()=>{ if(P === me && !P.started) paintPlayer(); }, 1500);
}

function onYTState(ev){
  if(!P) return;
  const S = YT.PlayerState;
  if(ev.data === S.PLAYING){ P.started = true; if(!P.since) P.since = Date.now(); }
  else if(P.since){
    P.pend += (Date.now() - P.since)/1000; P.since = null;
    flushPlayer();
  }
  if(ev.data === S.ENDED && !moreInList()){
    markDone(true);
    return closePlayer();
  }
  paintPlayer();
}
/* 재생목록에서 아직 뒤에 영상이 남았는지 */
function moreInList(){
  try{
    const pl = P.player && P.player.getPlaylist && P.player.getPlaylist();
    return !!(pl && pl.length && P.player.getPlaylistIndex() < pl.length - 1);
  }catch(e){ return false; }
}
function onYTError(ev){
  const c = ev.data;
  vidMsg(c === 101 || c === 150
    ? '이 영상은 만든 사람이 다른 곳에서<br>재생하지 못하게 막아 두었어요.'
    : c === 100 ? '지워졌거나 비공개로 바뀐 영상이에요.<br>주소를 바꿔 주세요.'
    : '영상을 재생하지 못했어요.');
}

/* 다 들었어요 / 다 봤어요 — 한 번 열 때 한 번만 셉니다 */
function markDone(auto){
  if(!P || P.marked) return;
  P.marked = true;
  const it = P.item;
  if(P.cat === 'listen' && P.isBook){
    it.hears = (it.hears || 0) + 1;
    logBook(it, 'listen');
    save(); soundCheck();
    toast(`다 들었어요! 🎧 ${it.hears}번째`);
  }else if(P.cat === 'listen'){
    it.views = (it.views || 0) + 1;
    it.lastAt = Date.now(); it.updatedAt = Date.now();
    logOf(todayKey()).vids = (logOf(todayKey()).vids || []);
    logOf(todayKey()).vids.push({id:it.id, title:it.title, at:Date.now()});
    save(); soundCheck();
    toast(`다 봤어요! 📺 ${it.views}번째`);
  }else{
    it.listens = (it.listens || 0) + 1;
    logBook(it, 'focus');
    save(); soundCheck();
    toast(auto ? `끝까지 들었어요! 👂 ${it.listens}번째` : `다 들었어요! 👂 ${it.listens}번째`);
  }
  paintPlayer();
}

function paintPlayer(){
  if(!P) return;
  const it = P.item, live = !!P.since, watch = P.cat === 'listen';
  const tapHint = P.player && !P.started ? `<span>▶ 영상을 한 번 눌러 주세요</span>` : '';
  const f = watch ? 'hears' : 'listens';
  $('#enPInfo').innerHTML = `
    <span>오늘 ${watch ? '흘려듣기' : '집중듣기'} <b class="${live?'live':''}">${clockOf(secOf(P.cat, todayKey()))}</b></span>
    ${!P.isBook ? tapHint
      : `<span>${P.marked ? `이 책 <b>${it[f]}번</b> 들었어요 ✓` : `이 책 <b>${(it[f]||0) + 1}번째</b> 듣는 중`}</span>${tapHint}`}`;
  $('#enPDone').style.display = P.isBook ? '' : 'none';
  $('#enPDone').textContent = P.marked ? '닫기' : '다 들었어요 ✓';
  if(watch) $('#enPToggle').textContent = live ? '⏸ 잠깐 멈춤' : '▶ 계속 보기';
}

function closePlayer(){
  if(!P) return;
  flushPlayer();
  try{ if(P.player && P.player.destroy) P.player.destroy(); }catch(e){}
  $('#enPVid').innerHTML = '';
  P = null;
  closeM('enPlayModal');
  refresh();
}
$('#enPClose').addEventListener('click', closePlayer);
$('#enPDone').addEventListener('click', ()=>{ markDone(false); closePlayer(); });
$('#enPToggle').addEventListener('click', ()=>{
  if(!P || !P.player || !P.player.getPlayerState) return;
  try{
    P.player.getPlayerState() === YT.PlayerState.PLAYING ? P.player.pauseVideo() : P.player.playVideo();
  }catch(e){}
});

document.addEventListener('visibilitychange', ()=>{ if(document.hidden) flushPlayer(); });
window.addEventListener('pagehide', flushPlayer);

/* ---------- 1초마다 ---------- */
let tickN = 0;
setInterval(()=>{
  tickN++;
  if(P){
    paintPlayer();
    if(P.since && tickN % 15 === 0) flushPlayer();
  }
  if(Object.keys(E().run).length || (P && P.since)){
    if(tickN % 5 === 0) checkGoals();
    if(isOpen() && tab === 'today') updateCards();
  }
}, 1000);

/* ==========================================================
   책장
   ========================================================== */
function paintShelf(){
  $('#enBody').innerHTML = `
    <div class="en-tools">
      <input type="text" id="enQ" placeholder="🔎 제목이나 시리즈로 찾기" value="${esc(shelfQ)}">
      <button class="btn accent" id="enNew">＋ 책 넣기</button>
    </div>
    <div class="en-filter" id="enFilter"></div>
    <div id="enGrid"></div>`;
  paintShelfGrid();
}
function paintShelfGrid(){
  const books = E().books;
  const lvs = LEVELS.filter(l => books.some(b => b.level === l));
  const fs = [['all',`전체 ${books.length}`], ...lvs.map(l=>[l,l]),
              ['lib','🏛 도서관'], ['love','😍 좋아함'], ['nolink','🔗 영상 없음']];
  $('#enFilter').innerHTML = fs.map(([id,n])=>`<button data-f="${id}" class="${shelfF===id?'on':''}">${n}</button>`).join('');

  const q = shelfQ.trim().toLowerCase();
  const list = books.filter(b=>{
    if(q && !(b.title + ' ' + (b.series||'')).toLowerCase().includes(q)) return false;
    if(shelfF === 'all') return true;
    if(shelfF === 'lib')    return b.where === 'lib';
    if(shelfF === 'love')   return b.react === 'love';
    if(shelfF === 'nolink') return !parseYT(b.yt);
    return b.level === shelfF;
  }).sort((a,b)=> (a.series||'~').localeCompare(b.series||'~') || a.title.localeCompare(b.title));

  $('#enGrid').innerHTML = list.length
    ? `<div class="en-grid">${list.map(b=>`
        <button class="en-tile" data-book="${b.id}">
          ${coverHTML(b)}
          <div class="en-tt">${esc(b.title)}</div>
          <div class="en-tm">
            <span class="en-lv">${esc(b.level)}</span>
            <span>🎧${b.hears||0}</span><span>👂${b.listens||0}</span><span>📖${b.reads||0}</span>
            ${REACT_EMO[b.react] ? `<span>${REACT_EMO[b.react]}</span>` : ''}
            ${parseYT(b.yt) ? '' : '<span class="en-nolink">영상 없음</span>'}
            ${dueTag(b)}
          </div>
        </button>`).join('')}</div>`
    : `<div class="empty"><b>📚</b>${books.length ? '해당하는 책이 없어요.' : '책장이 비어 있어요.<br>집에 있는 영어책부터 넣어 볼까요?'}</div>`;
}

/* ---------- 책 자세히 ---------- */
let detailId = null;
function openDetail(id){
  const b = bookOf(id); if(!b) return;
  detailId = id;
  const y = parseYT(b.yt);
  $('#enDetail').innerHTML = `
    <div class="en-dhead">
      ${coverHTML(b)}
      <div style="min-width:0">
        <h3>${esc(b.title)}</h3>
        <div class="en-dmeta">
          <span class="en-lv">${esc(b.level)}</span>
          ${b.series ? `<span>${esc(b.series)}</span>` : ''}
          <span>${b.where === 'lib' ? '🏛 도서관' : '🏠 우리집'}</span> ${dueTag(b)}
        </div>
      </div>
    </div>
    <div class="en-dstat">
      <div>🎧 흘려듣기<b>${b.hears||0}번</b></div>
      <div>👂 집중듣기<b>${b.listens||0}번</b></div>
      <div>📖 읽기<b>${b.reads||0}번</b></div>
    </div>
    <label class="fl">아이 반응</label>
    <div class="pick en-react">${REACT.map(([id,n])=>`<button data-dr="${id}" class="${b.react===id?'on':''}">${n}</button>`).join('')}</div>
    <div class="en-dact">
      <button class="btn accent" data-da="listen">${y ? '▶ 집중듣기' : '💿 집중듣기'}</button>
      <button class="btn" data-da="read">📖 읽었어요</button>
    </div>
    <button class="btn ghost wide" data-da="hear" style="margin-top:10px">🎧 흘려듣기로 틀기</button>
    <div class="row">
      <button class="btn ghost" data-da="edit">✏️ 고치기</button>
      <button class="btn ghost" data-enclose>닫기</button>
    </div>`;
  openM('enDetailModal');
}
$('#enDetail').addEventListener('click', e=>{
  const b = bookOf(detailId); if(!b) return;
  const r = e.target.closest('[data-dr]');
  if(r){
    b.react = b.react === r.dataset.dr ? '' : r.dataset.dr;
    b.updatedAt = Date.now(); save();
    return openDetail(b.id);
  }
  const a = e.target.closest('[data-da]'); if(!a) return;
  closeM('enDetailModal');
  if(a.dataset.da === 'listen') openPlayer(b, 'focus');
  if(a.dataset.da === 'hear')   openPlayer(b, 'listen');
  if(a.dataset.da === 'read')   markRead(b);
  if(a.dataset.da === 'edit')   openForm(b.id);
});

/* ---------- 책 넣기 / 고치기 ---------- */
let F = null;     // {id, mode, level, where, react, then}
function openForm(id, then){
  const b = id ? bookOf(id) : null;
  F = {id, mode:'one', level: b ? b.level : E().level, where: b ? b.where : 'home',
       react: b ? (b.react||'') : '', then: then || null};

  $('#enFTitle').textContent = b ? '책 고치기' : '책 넣기';
  $('#enFSave').textContent  = b ? '저장' : '넣기';
  $('#enFMode').style.display = b ? 'none' : '';
  $('#enFDel').style.display  = b ? '' : 'none';
  $('#enFName').value   = b ? b.title : '';
  $('#enFList').value   = '';
  $('#enFSeries').value = b ? (b.series||'') : '';
  $('#enFYt').value     = b ? (b.yt||'') : '';
  $('#enFDue').value    = b && b.due ? b.due : addDays(todayKey(), 14);
  $('#enSeriesList').innerHTML = [...new Set(E().books.map(x=>x.series).filter(Boolean))]
    .map(s=>`<option value="${esc(s)}">`).join('');

  paintForm();
  openM('enFormModal');
  if(!b) setTimeout(()=>$('#enFName').focus(), 80);
}
function paintForm(){
  [...$('#enFMode').children].forEach(x=>x.classList.toggle('on', x.dataset.fm === F.mode));
  $('#enFOne').style.display     = F.mode === 'one'  ? '' : 'none';
  $('#enFMany').style.display    = F.mode === 'many' ? '' : 'none';
  $('#enFYtWrap').style.display  = F.mode === 'one'  ? '' : 'none';
  $('#enFLevel').innerHTML = LEVELS.map(l=>`<button type="button" data-lv="${l}" class="${F.level===l?'on':''}">${l}</button>`).join('');
  [...$('#enFWhere').children].forEach(x=>x.classList.toggle('on', x.dataset.w === F.where));
  $('#enFDueWrap').style.display = F.where === 'lib' ? '' : 'none';
  $('#enFReact').innerHTML = REACT.map(([id,n])=>`<button type="button" data-rc="${id}" class="${F.react===id?'on':''}">${n}</button>`).join('');
  paintYtPrev();
}
function paintYtPrev(){
  const s = $('#enFYt').value.trim(), y = parseYT(s), el = $('#enFYtPrev');
  el.className = 'en-ytprev';
  if(!s){ el.innerHTML = '<span>없어도 괜찮아요. 🔎 찾기를 누르면 유튜브에서 이 책을 찾아 줘요.</span>'; return; }
  if(!y){ el.classList.add('bad'); el.innerHTML = '유튜브 주소가 아닌 것 같아요'; return; }
  el.classList.add('ok');
  el.innerHTML = y.v
    ? `<img src="https://i.ytimg.com/vi/${y.v}/mqdefault.jpg" alt=""><span>✓ 영상 확인</span>`
    : '<span>✓ 재생목록 확인 — 처음부터 차례로 나와요</span>';
}
$('#enFormModal').addEventListener('click', e=>{
  const t = e.target;
  const fm = t.closest('[data-fm]'); if(fm){ F.mode = fm.dataset.fm; return paintForm(); }
  const lv = t.closest('[data-lv]'); if(lv){ F.level = lv.dataset.lv; return paintForm(); }
  const w  = t.closest('[data-w]');  if(w){ F.where = w.dataset.w; return paintForm(); }
  const rc = t.closest('[data-rc]'); if(rc){ F.react = F.react === rc.dataset.rc ? '' : rc.dataset.rc; return paintForm(); }
});
$('#enFYt').addEventListener('input', paintYtPrev);
$('#enFFind').addEventListener('click', ()=>{
  const title = $('#enFName').value.trim();
  if(!title) return toast('책 제목을 먼저 적어 주세요');
  ytSearch(title + ' read aloud');
  toast('찾은 영상 주소를 복사해서 붙여 넣어 주세요');
});

function newBook(title, yt){
  return {id:uid(), title, level:F.level, series:$('#enFSeries').value.trim(),
          yt:yt||'', where:F.where, due: F.where === 'lib' ? $('#enFDue').value : '',
          react:F.react, reads:0, listens:0, lastAt:0, addedAt:Date.now(), updatedAt:Date.now()};
}
$('#enFSave').addEventListener('click', ()=>{
  const e = E();
  const due = F.where === 'lib' ? $('#enFDue').value : '';

  if(F.id){
    const b = bookOf(F.id); if(!b) return;
    const title = $('#enFName').value.trim();
    if(!title) return toast('책 제목을 적어 주세요');
    const yt = $('#enFYt').value.trim();
    if(yt && !parseYT(yt)) return toast('유튜브 주소를 확인해 주세요');
    Object.assign(b, {title, level:F.level, series:$('#enFSeries').value.trim(), yt,
                      where:F.where, due, react:F.react, updatedAt:Date.now()});
    save(); closeM('enFormModal'); refresh();
    return toast('고쳤어요');
  }

  const have = new Set(e.books.map(b=>b.title.toLowerCase()));
  if(F.mode === 'one'){
    const title = $('#enFName').value.trim();
    if(!title) return toast('책 제목을 적어 주세요');
    const yt = $('#enFYt').value.trim();
    if(yt && !parseYT(yt)) return toast('유튜브 주소를 확인해 주세요');
    if(have.has(title.toLowerCase()) && !confirm(`"${title}"은 이미 책장에 있어요. 한 권 더 넣을까요?`)) return;
    const b = newBook(title, yt);
    e.books.push(b);
    save(); closeM('enFormModal');
    toast(`📚 "${title}"을 넣었어요`);
    if(F.then) F.then(b); else refresh();
    return;
  }

  /* 여러 권 — 한 줄에 "제목 | 유튜브주소" */
  let added = 0, dup = 0, badLink = 0;
  $('#enFList').value.split('\n').forEach(line=>{
    const [rawT, rawU] = line.split('|');
    const title = (rawT||'').trim(); if(!title) return;
    if(have.has(title.toLowerCase())){ dup++; return; }
    let yt = (rawU||'').trim();
    if(yt && !parseYT(yt)){ badLink++; yt = ''; }
    e.books.push(newBook(title, yt));
    have.add(title.toLowerCase());
    added++;
  });
  if(!added && !dup) return toast('책 제목을 한 줄에 하나씩 적어 주세요');
  save(); closeM('enFormModal'); refresh();
  toast(`📚 ${added}권 넣었어요` + (dup ? ` · 이미 있는 ${dup}권은 건너뛰었어요` : '')
        + (badLink ? ` · 주소가 이상한 ${badLink}개는 빼고 넣었어요` : ''));
});
$('#enFDel').addEventListener('click', ()=>{
  const b = bookOf(F.id); if(!b) return;
  if(!confirm(`"${b.title}"을 책장에서 지울까요?\n지금까지 들은·읽은 기록은 그대로 남아요.`)) return;
  E().books = E().books.filter(x=>x.id !== b.id);
  save(); closeM('enFormModal'); refresh();
  toast('지웠어요');
});

/* ==========================================================
   기록
   ========================================================== */
function paintStats(){
  const e = E(), L = e.log, tk = todayKey();
  const tot = {listen:0, focus:0, read:0, korean:0};
  let reads = 0, listens = 0, hears = 0, days = 0, views = 0;
  const seen = new Set(), cnt = {};
  Object.keys(L).forEach(k=>{
    const l = L[k]; let any = false;
    CATS.forEach(c=>{ const s = secOf(c.id, k); tot[c.id] += s; if(s > 0) any = true; });
    if((l.vids||[]).length){ any = true; views += l.vids.length; }
    (l.books||[]).forEach(b=>{
      any = true; seen.add(b.id);
      if(b.t === 'read') reads++; else if(b.t === 'listen') hears++; else listens++;
      const x = cnt[b.id] || (cnt[b.id] = {title:b.title, n:0});
      x.n++;
    });
    if(any) days++;
  });
  const met = reads + listens;

  /* 이번 주 */
  const ws = weekStart(tk);
  const week = [0,1,2,3,4,5,6].map(i=>{
    const k = addDays(ws, i);
    const v = Object.fromEntries(CATS.map(c=>[c.id, secOf(c.id, k)]));
    return {k, v, sum: CATS.reduce((s,c)=>s + v[c.id], 0)};
  });
  const goalSum = CATS.reduce((s,c)=>s + (e.goals[c.id]||0)*60, 0) || 3600;
  const scale = Math.max(goalSum, ...week.map(d=>d.sum));

  /* 최근 5주 달력 */
  const calStart = addDays(ws, -28);
  const cal = [...Array(35)].map((_,i)=>{
    const k = addDays(calStart, i);
    const s = CATS.reduce((a,c)=>a + secOf(c.id, k), 0) + (((L[k]||{}).books||[]).length ? 1 : 0);
    const r = s / goalSum;
    const lv = !s ? 0 : r < .34 ? 1 : r < .67 ? 2 : r < 1 ? 3 : 4;
    return `<div class="c l${lv} ${k===tk?'today':''} ${k>tk?'fut':''}">${parseKey(k).getDate()}</div>`;
  }).join('');

  const top = Object.entries(cnt).sort((a,b)=>b[1].n - a[1].n).slice(0,5);
  const lvCount = LEVELS.map(l=>[l, e.books.filter(b=>b.level===l).length]).filter(x=>x[1]);
  const GOAL_BOOKS = 1000;

  $('#enBody').innerHTML = `
    <div class="en-stats">
      <div class="en-stat"><div class="l">🌟 영어 한 날</div><div class="v">${days}일</div></div>
      <div class="en-stat"><div class="l">📚 만난 책</div><div class="v">${seen.size}권</div>
        <div class="s">👂${listens} · 📖${reads}번</div></div>
      <div class="en-stat"><div class="l">👂 집중듣기</div><div class="v">${fmtMin(tot.focus)}</div></div>
      <div class="en-stat"><div class="l">🎧 흘려듣기</div><div class="v">${fmtMin(tot.listen)}</div>
        ${views || hears ? `<div class="s">${[views ? `📺 영상 ${views}번` : '', hears ? `📚 책 ${hears}번` : ''].filter(Boolean).join(' · ')}</div>` : ''}</div>
    </div>

    <div class="en-box">
      <h4>📚 책 ${GOAL_BOOKS}번 만나기 <span>${met} / ${GOAL_BOOKS}</span></h4>
      <div class="en-big"><i style="width:${Math.min(100, met/GOAL_BOOKS*100)}%"></i></div>
      <p class="hint" style="margin-top:9px">같은 책을 다시 듣고 읽어도 한 번씩 셉니다. 반복이 제일 좋은 공부예요.</p>
    </div>

    <div class="en-box">
      <h4>📅 이번 주</h4>
      <div class="en-legend">${CATS.map(c=>`<span><i style="background:${c.c}"></i>${c.name}</span>`).join('')}</div>
      ${week.map((d,i)=>`
        <div class="en-wk">
          <span class="d ${d.k===tk?'today':''}">${DAYS[i]}</span>
          <span class="b">${CATS.map(c=>d.v[c.id] ? `<i style="width:${d.v[c.id]/scale*100}%; background:${c.c}"></i>` : '').join('')}</span>
          <span class="n">${d.sum ? fmtMin(d.sum) : (d.k > tk ? '' : '—')}</span>
        </div>`).join('')}
    </div>

    <div class="en-box">
      <h4>🗓 최근 5주 <span>진할수록 목표에 가까워요</span></h4>
      <div class="en-cal">${DAYS.map(d=>`<div class="h">${d}</div>`).join('')}${cal}</div>
    </div>

    <div class="en-box">
      <h4>🔁 제일 많이 만난 책</h4>
      ${top.length ? top.map(([id,x],i)=>{
        const b = bookOf(id);
        return `<div class="en-top"><span class="r">${i+1}</span>
          <span class="t">${esc(b ? b.title : x.title)}</span><span class="n">${x.n}번</span></div>`;
      }).join('') : '<p class="hint" style="margin:0">아직 기록이 없어요. 오늘 첫 책을 들어 볼까요?</p>'}
    </div>

    ${lvCount.length ? `<div class="en-box">
      <h4>📊 책장 레벨</h4>
      <div class="en-lvs">${lvCount.map(([l,n])=>`<span><b>${l}</b> ${n}권</span>`).join('')}</div>
    </div>` : ''}`;
}

function refresh(){ if(isOpen()) paint(); }

/* ==========================================================
   부모 모드 카드 — index.html 의 renderParent() 가 끼워 넣습니다
   ========================================================== */
function parentCard(){
  const e = E();
  return `
    <div class="pcard">
      <h4>🔤 엄마표 영어</h4>
      <label class="fl" style="margin-top:4px">지금 레벨 <span style="font-weight:600">— 새 책을 넣을 때 기본값이 돼요</span></label>
      <select id="enLevel">${LEVELS.map(l=>`<option ${e.level===l?'selected':''}>${l}</option>`).join('')}</select>
      <label class="fl">하루 목표 (분) <span style="font-weight:600">— 0 으로 두면 목표 없이 기록만 해요</span></label>
      <div class="en-goals">
        ${CATS.map(c=>`<label>${c.emo} ${c.name}
          <input type="number" min="0" max="300" step="5" data-goal="${c.id}" value="${e.goals[c.id]||0}"></label>`).join('')}
      </div>
      <div class="row" style="margin-top:14px"><button class="btn accent" id="enSaveCfg">저장</button></div>
      <p class="hint">
        책 ${e.books.length}권 · 기록 ${Object.keys(e.log).length}일.
        이 기록은 이 기기에만 있어요. 가끔 백업해 두세요.
      </p>
      <div class="row" style="margin-top:10px">
        <button class="btn ghost" id="enExport">백업 받기</button>
        <button class="btn ghost" id="enImport">백업 불러오기</button>
      </div>
      <input type="file" id="enImportFile" accept="application/json,.json" style="display:none">
    </div>`;
}

$('#viewParent').addEventListener('click', e=>{
  const t = e.target;
  if(t.id === 'enSaveCfg'){
    const en = E();
    en.level = $('#enLevel').value;
    document.querySelectorAll('[data-goal]').forEach(i=>{
      en.goals[i.dataset.goal] = Math.max(0, Math.min(300, Math.round(Number(i.value) || 0)));
    });
    save();
    return toast('영어 설정을 저장했어요');
  }
  if(t.id === 'enExport'){
    const blob = new Blob([JSON.stringify({kind:'english-backup', savedAt:new Date().toISOString(), english:E()}, null, 1)],
                          {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `영어기록-${todayKey()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
    return;
  }
  if(t.id === 'enImport') return $('#enImportFile').click();
});
$('#viewParent').addEventListener('change', async e=>{
  if(e.target.id !== 'enImportFile') return;
  const f = e.target.files[0]; if(!f) return;
  try{
    const data = JSON.parse(await f.text());
    const en = data && data.kind === 'english-backup' ? data.english : null;
    if(!en || !Array.isArray(en.books) || typeof en.log !== 'object') throw 0;
    if(!confirm(`백업을 불러올까요?\n책 ${en.books.length}권 · 기록 ${Object.keys(en.log).length}일\n\n지금 이 기기의 영어 기록은 백업 내용으로 바뀝니다.`)) return;
    en.run = {};
    db.english = en; E(); save();
    renderParent();
    toast('백업을 불러왔어요');
  }catch(err){
    toast('영어 기록 백업 파일이 아니에요');
  }finally{
    e.target.value = '';
  }
});

/* index.html 에서 부르는 것들 */
window.renderEnglish   = render;
window.enParentCard    = parentCard;

})();
