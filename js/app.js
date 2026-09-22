/* 抓包變色龍 — 純前端、零後端。
   一局的全部資訊都塞在網址的 # 片段裡，# 不會送到伺服器，只在手機本機解讀。 */

const COLS = ['A', 'B', 'C', 'D'];

/* ── 工具 ───────────────────────────────────────────── */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const coordOf = (i) => COLS[i % 4] + (Math.floor(i / 4) + 1);
const randInt = (n) => Math.floor(Math.random() * n);

const b64url = {
  encode: (s) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  decode: (s) => atob(s.replace(/-/g, '+').replace(/_/g, '/')),
};

/* 一局 = 主題 / 秘密詞格子 / 變色龍座位 / 人數 / 起始玩家 / 亂數碼 */
function encodeRound(r) {
  return b64url.encode([r.topicId, r.wordIndex, r.chameleonSeat, r.players, r.startSeat, r.nonce].join('|'));
}
function decodeRound(hash) {
  const [topicId, wordIndex, chameleonSeat, players, startSeat, nonce] = b64url.decode(hash).split('|');
  const r = {
    topicId,
    wordIndex: +wordIndex, chameleonSeat: +chameleonSeat,
    players: +players, startSeat: +startSeat, nonce,
  };
  const ok = topicId && [r.wordIndex, r.chameleonSeat, r.players, r.startSeat].every(Number.isInteger);
  if (!ok) throw new Error('bad payload');
  return r;
}

/* ── 狀態 ───────────────────────────────────────────── */

const state = {
  topics: [],
  config: { minPlayers: 3, maxPlayers: 8 },  // 會被 topics.json 的 config 覆寫
  round: null,        // 目前這一局
  setup: { players: 6, topicId: null },  // topicId = null 代表隨機
  seat: null,         // 玩家自己的座位號
};

const topicById = (id) => state.topics.find((t) => t.id === id);

/* ── 畫面切換 ───────────────────────────────────────── */

function show(name) {
  $$('.screen').forEach((el) => { el.hidden = el.dataset.screen !== name; });
  window.scrollTo(0, 0);
}

/* ── 4×4 題目表 ─────────────────────────────────────── */

function renderGrid(container, topic, highlightIndex) {
  const cells = ['<div class="cell head"></div>'];
  COLS.forEach((c) => cells.push(`<div class="cell head">${c}</div>`));
  for (let row = 0; row < 4; row++) {
    cells.push(`<div class="cell head">${row + 1}</div>`);
    for (let col = 0; col < 4; col++) {
      const i = row * 4 + col;
      const mine = i === highlightIndex ? ' mine' : '';
      cells.push(`<div class="cell${mine}">${topic.words[i]}</div>`);
    }
  }
  container.innerHTML = cells.join('');
}

/* ── Host：設定畫面 ─────────────────────────────────── */

function renderSetup() {
  const { minPlayers, maxPlayers } = state.config;
  const counts = $('#playerCount');
  counts.innerHTML = Array.from({ length: maxPlayers - minPlayers + 1 }, (_, i) => minPlayers + i)
    .map((n) => `<button class="chip" data-count="${n}" aria-pressed="${n === state.setup.players}">${n}</button>`)
    .join('');

  const picker = $('#topicPicker');
  picker.innerHTML = [
    `<button class="chip" data-topic="" aria-pressed="${state.setup.topicId === null}">🎲 隨機</button>`,
    ...state.topics.map((t) =>
      `<button class="chip" data-topic="${t.id}" aria-pressed="${state.setup.topicId === t.id}">${t.emoji} ${t.name}</button>`),
  ].join('');
}

/* ── Host：產生一局 ─────────────────────────────────── */

function newRound() {
  const { players, topicId } = state.setup;
  const topic = topicId ? topicById(topicId) : state.topics[randInt(state.topics.length)];
  state.round = {
    topicId: topic.id,
    wordIndex: randInt(16),
    chameleonSeat: randInt(players) + 1,
    players,
    startSeat: randInt(players) + 1,
    nonce: Math.random().toString(36).slice(2, 8),
  };
  showQR();
}

function showQR() {
  const url = location.origin + location.pathname + '#' + encodeRound(state.round);
  $('#qrCount').textContent = state.round.players;
  $('#qrUrl').textContent = url;

  const box = $('#qrBox');
  box.innerHTML = '';
  new QRCode(box, { text: url, width: 480, height: 480, correctLevel: QRCode.CorrectLevel.M });

  show('qr');
}

function showBoard() {
  const topic = topicById(state.round.topicId);
  $('#boardTitle').textContent = `${topic.emoji} ${topic.name}`;
  renderGrid($('#boardGrid'), topic, -1);
  $('#startsWith').textContent = `由 ${state.round.startSeat} 號玩家開始說線索，然後依序輪流。`;
  show('board');
}

/* ── 玩家 ───────────────────────────────────────────── */

const seatKey = () => 'seat:' + state.round.nonce;

function readSeat() {
  try { return +localStorage.getItem(seatKey()) || null; } catch { return null; }
}
function writeSeat(n) {
  try { localStorage.setItem(seatKey(), String(n)); } catch { /* 無痕模式：不記就算了 */ }
}

function renderSeatPicker() {
  $('#seatPicker').innerHTML = Array.from({ length: state.round.players }, (_, i) =>
    `<button class="seat" data-seat="${i + 1}">${i + 1}</button>`).join('');
  show('seat');
}

function showRole() {
  const { seat, round } = state;
  const topic = topicById(round.topicId);
  const isChameleon = seat === round.chameleonSeat;

  $('#roleCard').innerHTML = isChameleon
    ? `<div class="role chameleon">
         <div class="seat-tag">${seat} 號玩家</div>
         <div class="emoji">🦎</div>
         <div class="title">你是變色龍</div>
         <ul>
           <li>你<b>不知道</b>秘密詞是哪一個。</li>
           <li>從別人的線索推測那個詞，同時<b>裝作你也知道</b>，講一個混得過去的線索。</li>
           <li>沒被投出來就贏；被抓到還有<b>一次猜詞機會</b>，猜中一樣算贏。</li>
         </ul>
         <div class="topic-tag">主題：${topic.emoji} ${topic.name}</div>
       </div>`
    : `<div class="role civilian">
         <div class="seat-tag">${seat} 號玩家</div>
         <div class="title">你是平民</div>
         <div class="code">${coordOf(round.wordIndex)}</div>
         <ul>
           <li>等主持人公佈題目，找到 <b>${coordOf(round.wordIndex)}</b> 那格的詞，那就是秘密詞。</li>
           <li>講一個線索證明你知道，但<b>別講太明顯</b>，否則變色龍就猜到了。</li>
         </ul>
         <div class="topic-tag">主題：${topic.emoji} ${topic.name}</div>
       </div>`;

  show('role');
}

function showPlayerBoard() {
  const { seat, round } = state;
  const topic = topicById(round.topicId);
  const isChameleon = seat === round.chameleonSeat;

  $('#pbTitle').textContent = `${topic.emoji} ${topic.name}`;
  renderGrid($('#pbGrid'), topic, isChameleon ? -1 : round.wordIndex);
  $('#pbHint').textContent = isChameleon
    ? '你不知道是哪一個 —— 仔細聽大家的線索。'
    : `你的秘密詞是「${topic.words[round.wordIndex]}」（${coordOf(round.wordIndex)}）。`;

  show('playerBoard');
}

/* ── 事件 ───────────────────────────────────────────── */

function wireEvents() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    if (btn.dataset.go) {
      const dest = btn.dataset.go;
      if (dest === 'setup') renderSetup();
      if (dest === 'role') return showRole();
      return show(dest);
    }

    if (btn.dataset.count) {
      state.setup.players = +btn.dataset.count;
      return renderSetup();
    }
    if (btn.dataset.topic !== undefined) {
      state.setup.topicId = btn.dataset.topic || null;
      return renderSetup();
    }
    if (btn.dataset.seat) {
      state.seat = +btn.dataset.seat;
      writeSeat(state.seat);
      return showRole();
    }
  });

  $('#btnGenerate').onclick  = newRound;
  $('#btnRegen').onclick     = newRound;
  $('#btnNextRound').onclick = newRound;
  $('#btnStart').onclick     = showBoard;
  $('#btnShowBoard').onclick = showPlayerBoard;
  $('#btnReseat').onclick    = () => {
    try { localStorage.removeItem(seatKey()); } catch { /* ignore */ }
    state.seat = null;
    renderSeatPicker();
  };
}

/* ── 進入點 ─────────────────────────────────────────── */

async function main() {
  wireEvents();

  try {
    const data = await (await fetch('data/topics.json', { cache: 'no-cache' })).json();
    state.topics = data.topics;
    Object.assign(state.config, data.config || {});
    state.setup.players = Math.min(Math.max(6, state.config.minPlayers), state.config.maxPlayers);
  } catch {
    $('#errMsg').textContent = '無法載入題庫（data/topics.json）。';
    return show('error');
  }

  const hash = location.hash.slice(1);
  if (!hash) return show('home');        // 沒有 # → 主持人模式

  try {                                   // 有 # → 玩家模式
    state.round = decodeRound(hash);
    if (!topicById(state.round.topicId)) throw new Error('unknown topic');
  } catch {
    return show('error');
  }

  const saved = readSeat();
  if (saved && saved >= 1 && saved <= state.round.players) {
    state.seat = saved;
    showRole();
  } else {
    renderSeatPicker();
  }
}

main();
