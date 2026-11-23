/* 체스 이기기 연습
 * - 기보(PGN/SAN)와 시작 지점을 고르고, 이겨야 하는 색을 정한다.
 * - 이겨야 하는 색은 Stockfish 엔진이, 반대 색은 사용자가 둔다.
 */
(function () {
  'use strict';

  const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  const FILES = 'abcdefgh';
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const $ = (id) => document.getElementById(id);

  const state = {
    mode: 'setup',          // 'setup' | 'play' | 'over'
    baseStartFen: START_FEN,
    baseMoves: [],          // 불러온 기보의 SAN 목록
    startPly: 0,            // 몇 수 뒤 국면에서 시작할지
    view: new Chess(),      // setup 단계에서 보여줄 국면
    game: null,             // play 단계의 Chess 인스턴스
    playBaseLen: 0,         // 대국 시작 시점의 history 길이 (무르기 한계)
    engineColor: 'w',
    orientation: 'w',
    selected: null,
    thinking: false,
  };

  /* ---------------- 엔진 ---------------- */
  const engine = {
    worker: null,
    outstanding: 0,  // 응답을 기다리는 go 명령 수
    searchFen: null,
    ready: false,

    init() {
      try {
        this.worker = new Worker('vendor/stockfish.js');
      } catch (e) {
        setStatus('엔진을 불러오지 못했습니다. README의 실행 방법(로컬 서버)을 확인하세요.');
        return;
      }
      this.worker.onmessage = (e) => this.onLine(String(e.data));
      this.worker.onerror = () =>
        setStatus('엔진 오류: 파일을 직접 열면(file://) 동작하지 않습니다. 로컬 서버로 실행하세요.');
      this.send('uci');
      this.send('isready');
    },
    send(cmd) { if (this.worker) this.worker.postMessage(cmd); },

    think(fen, movetime, skill) {
      this.outstanding++;
      this.searchFen = fen;
      this.send('setoption name Skill Level value ' + skill);
      this.send('position fen ' + fen);
      this.send('go movetime ' + movetime);
    },
    stop() { if (this.outstanding > 0) this.send('stop'); },

    onLine(line) {
      if (line === 'readyok') { this.ready = true; return; }
      if (line.startsWith('info') && line.includes(' score ')) {
        const m = line.match(/score (cp|mate) (-?\d+)/);
        if (m && this.outstanding === 1) showEval(m[1], parseInt(m[2], 10));
        return;
      }
      if (line.startsWith('bestmove')) {
        this.outstanding--;
        if (this.outstanding > 0) return; // 이전에 취소된 탐색의 응답
        const uci = line.split(' ')[1];
        onEngineMove(this.searchFen, uci);
      }
    },
  };

  function showEval(kind, val) {
    // 엔진은 엔진 차례에서만 생각하므로 점수는 곧 엔진(이겨야 하는 색) 기준
    const el = $('eval');
    if (kind === 'mate') {
      el.textContent = val > 0 ? `#${val} (메이트까지 ${val}수)` : `#${val} (메이트 당함)`;
    } else {
      const p = (val / 100).toFixed(2);
      el.textContent = (val > 0 ? '+' : '') + p;
    }
  }

  /* ---------------- 보드 렌더링 ---------------- */
  function currentGame() { return state.mode === 'setup' ? state.view : state.game; }

  function renderBoard() {
    const g = currentGame();
    const board = $('board');
    board.innerHTML = '';
    const hist = g.history({ verbose: true });
    const last = hist[hist.length - 1];
    const targets = new Map();
    if (state.selected) {
      for (const m of g.moves({ square: state.selected, verbose: true })) {
        targets.set(m.to, m);
      }
    }
    let checkSq = null;
    if (g.in_check()) {
      checkSq = findKing(g, g.turn());
    }

    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const file = state.orientation === 'w' ? f : 7 - f;
        const rank = state.orientation === 'w' ? 8 - r : r + 1;
        const sq = FILES[file] + rank;
        const div = document.createElement('div');
        div.className = 'sq ' + ((file + rank) % 2 === 0 ? 'light' : 'dark');
        div.dataset.sq = sq;
        if (last && (last.from === sq || last.to === sq)) div.classList.add('last');
        if (state.selected === sq) div.classList.add('sel');
        if (checkSq === sq) div.classList.add('check');
        if (targets.has(sq)) {
          div.classList.add('target');
          if (targets.get(sq).captured) div.classList.add('capture');
        }
        const p = g.get(sq);
        if (p) {
          const s = document.createElement('span');
          s.className = 'piece ' + p.color;
          s.textContent = GLYPH[p.type];
          div.appendChild(s);
        }
        if (r === 7) addCoord(div, 'file', FILES[file]);
        if (f === 0) addCoord(div, 'rank', String(rank));
        board.appendChild(div);
      }
    }
  }
  function addCoord(div, cls, text) {
    const c = document.createElement('span');
    c.className = 'coord ' + cls;
    c.textContent = text;
    div.appendChild(c);
  }
  function findKing(g, color) {
    for (const f of FILES) for (let r = 1; r <= 8; r++) {
      const p = g.get(f + r);
      if (p && p.type === 'k' && p.color === color) return f + r;
    }
    return null;
  }

  /* ---------------- 수 목록 ---------------- */
  // sans: SAN 배열, fen: 첫 수 직전 국면, cur: 강조할 ply(1부터), engineFrom: 이 ply부터 엔진 수 굵게
  function renderMoveList(el, sans, fen, cur, onClick, engineFrom) {
    el.innerHTML = '';
    if (sans.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = '(수 없음)';
      el.appendChild(li);
      return;
    }
    const parts = fen.split(' ');
    let num = parseInt(parts[5], 10) || 1;
    let blackFirst = parts[1] === 'b';
    const add = (cls, text, ply) => {
      const li = document.createElement('li');
      li.className = cls;
      li.textContent = text;
      if (ply !== undefined) {
        if (ply === cur) li.classList.add('cur');
        if (engineFrom !== undefined && ply >= engineFrom) {
          const color = (blackFirst ? ply : ply - 1) % 2 === 0 ? 'w' : 'b';
          if (color === state.engineColor) li.classList.add('engine');
        }
        if (onClick) li.addEventListener('click', () => onClick(ply));
      }
      el.appendChild(li);
      return li;
    };
    let i = 0;
    if (blackFirst) {
      add('num', num + '.');
      add('', '…');
      add('mv', sans[0], 1);
      i = 1; num++;
    }
    for (; i < sans.length; i += 2) {
      add('num', num + '.');
      add('mv', sans[i], i + 1);
      if (i + 1 < sans.length) add('mv', sans[i + 1], i + 2);
      else add('', '');
      num++;
    }
    const curEl = el.querySelector('.cur');
    if (curEl) curEl.scrollIntoView({ block: 'nearest' });
  }

  /* ---------------- 1단계: 기보 불러오기 ---------------- */
  function loadGame() {
    $('loadError').textContent = '';
    let text = $('pgn').value.trim();
    const fen = $('fen').value.trim();
    const g = new Chess();

    if (fen) {
      const v = g.validate_fen(fen);
      if (!v.valid) {
        $('loadError').textContent = 'FEN 오류: ' + v.error;
        return false;
      }
      if (!/\[FEN /.test(text)) {
        text = `[SetUp "1"]\n[FEN "${fen}"]\n\n` + text;
      }
    }
    if (text) {
      if (!g.load_pgn(text, { sloppy: true })) {
        $('loadError').textContent = '기보를 읽을 수 없습니다. 수 표기(SAN, 예: Nf3, exd5, O-O)를 확인하세요.';
        return false;
      }
    } else if (fen) {
      g.load(fen);
    }

    const sans = g.history();
    while (g.undo()) { /* 시작 국면까지 되돌림 */ }
    state.baseStartFen = g.fen();
    state.baseMoves = sans;
    setStartPly(sans.length);
    return true;
  }

  function setStartPly(ply) {
    state.startPly = Math.max(0, Math.min(ply, state.baseMoves.length));
    const g = new Chess(state.baseStartFen);
    for (let i = 0; i < state.startPly; i++) g.move(state.baseMoves[i], { sloppy: true });
    state.view = g;
    state.selected = null;
    renderMoveList($('moveList'), state.baseMoves, state.baseStartFen, state.startPly, setStartPly);
    renderBoard();
    const turn = g.turn() === 'w' ? '백' : '흑';
    setStatus(`시작 국면: ${state.startPly}수 진행 후 · ${turn} 차례`);
  }

  /* ---------------- 2단계: 대국 ---------------- */
  function startPlay() {
    if (state.view.game_over()) {
      setStatus('이미 끝난 국면입니다. 다른 시작 지점을 고르세요.');
      return;
    }
    state.engineColor = document.querySelector('input[name=winner]:checked').value;
    const userColor = other(state.engineColor);
    state.game = new Chess(state.baseStartFen);
    for (let i = 0; i < state.startPly; i++) state.game.move(state.baseMoves[i], { sloppy: true });
    state.playBaseLen = state.startPly;
    state.orientation = userColor;
    state.selected = null;
    state.mode = 'play';
    $('setup').hidden = true;
    $('play').hidden = false;
    $('eval').textContent = '-';
    $('roles').textContent =
      `엔진: ${colorName(state.engineColor)} (이겨야 하는 색) · 나: ${colorName(userColor)} (막아야 하는 색)`;
    afterPositionChange();
  }

  function afterPositionChange() {
    state.selected = null;
    renderBoard();
    renderPlayList();
    const g = state.game;
    if (g.game_over()) {
      state.mode = 'over';
      setStatus(resultText(g));
      return;
    }
    state.mode = 'play';
    if (g.turn() === state.engineColor) {
      requestEngineMove();
    } else {
      setStatus(`내 차례 (${colorName(g.turn())})` + (g.in_check() ? ' · 체크!' : ''));
    }
  }

  function requestEngineMove() {
    state.thinking = true;
    setStatus('엔진이 생각 중…');
    const movetime = parseInt($('movetime').value, 10) || 1000;
    let skill = parseInt($('skill').value, 10);
    if (isNaN(skill)) skill = 20;
    skill = Math.max(0, Math.min(20, skill));
    engine.think(state.game.fen(), movetime, skill);
  }

  function onEngineMove(fen, uci) {
    state.thinking = false;
    if (!state.game || state.mode !== 'play' || state.game.fen() !== fen) return;
    if (!uci || uci === '(none)') { afterPositionChange(); return; }
    const mv = state.game.move({
      from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q',
    });
    if (!mv) { setStatus('엔진 수를 적용할 수 없습니다: ' + uci); return; }
    afterPositionChange();
  }

  function onSquareClick(sq) {
    if (state.mode !== 'play' || state.thinking) return;
    const g = state.game;
    if (g.turn() === state.engineColor) return;
    const piece = g.get(sq);

    if (state.selected) {
      const legal = g.moves({ square: state.selected, verbose: true }).find((m) => m.to === sq);
      if (legal) {
        g.move({ from: state.selected, to: sq, promotion: $('promo').value });
        afterPositionChange();
        return;
      }
    }
    if (piece && piece.color === g.turn()) {
      state.selected = state.selected === sq ? null : sq;
    } else {
      state.selected = null;
    }
    renderBoard();
  }

  function undo() {
    if (!state.game) return;
    const g = state.game;
    const userColor = other(state.engineColor);
    const played = g.history({ verbose: true }).slice(state.playBaseLen);
    if (!played.some((m) => m.color === userColor)) return; // 무를 내 수가 없음
    if (state.thinking) { engine.stop(); state.thinking = false; }
    // 내 마지막 수까지 되돌린다 (엔진 응수가 있으면 그것도)
    while (g.history().length > state.playBaseLen) {
      if (g.undo().color === userColor) break;
    }
    state.mode = 'play';
    afterPositionChange();
  }

  function restart() {
    if (!state.game) return;
    if (state.thinking) { engine.stop(); state.thinking = false; }
    while (state.game.history().length > state.playBaseLen) state.game.undo();
    $('eval').textContent = '-';
    state.mode = 'play';
    afterPositionChange();
  }

  function backToSetup() {
    if (state.thinking) { engine.stop(); state.thinking = false; }
    state.mode = 'setup';
    state.game = null;
    $('play').hidden = true;
    $('setup').hidden = false;
    $('eval').textContent = '-';
    state.orientation = 'w';
    setStartPly(state.startPly);
  }

  function renderPlayList() {
    const sans = state.game.history();
    renderMoveList($('playList'), sans, state.baseStartFen, sans.length, null, state.playBaseLen + 1);
  }

  function resultText(g) {
    if (g.in_checkmate()) {
      const winner = other(g.turn());
      return winner === state.engineColor
        ? `체크메이트 — ${colorName(winner)}(엔진) 승리. 다른 수비를 시도해 보세요!`
        : `체크메이트 — ${colorName(winner)}(나) 승리! 역전 성공!`;
    }
    let why = '무승부';
    if (g.in_stalemate()) why = '스테일메이트';
    else if (g.in_threefold_repetition()) why = '3회 동형 반복';
    else if (g.insufficient_material()) why = '기물 부족';
    else if (g.in_draw()) why = '50수 규칙';
    return `${why}로 무승부 — 수비 성공!`;
  }

  /* ---------------- 유틸 ---------------- */
  function other(c) { return c === 'w' ? 'b' : 'w'; }
  function colorName(c) { return c === 'w' ? '백' : '흑'; }
  function setStatus(t) { $('status').textContent = t; }

  /* ---------------- 이벤트 ---------------- */
  $('board').addEventListener('click', (e) => {
    const sqEl = e.target.closest('.sq');
    if (sqEl) onSquareClick(sqEl.dataset.sq);
  });
  $('loadBtn').addEventListener('click', loadGame);
  $('startBtn').addEventListener('click', () => {
    // 입력이 바뀌었으면 자동으로 다시 불러온다
    if ($('pgn').dataset.loaded !== $('pgn').value + '|' + $('fen').value) {
      if (!loadGame()) return;
      $('pgn').dataset.loaded = $('pgn').value + '|' + $('fen').value;
    }
    startPlay();
  });
  $('loadBtn').addEventListener('click', () => {
    $('pgn').dataset.loaded = $('pgn').value + '|' + $('fen').value;
  });
  document.querySelectorAll('[data-nav]').forEach((b) =>
    b.addEventListener('click', () => {
      const n = state.baseMoves.length;
      const p = { first: 0, prev: state.startPly - 1, next: state.startPly + 1, last: n }[b.dataset.nav];
      setStartPly(p);
    }));
  document.addEventListener('keydown', (e) => {
    if (state.mode !== 'setup' || /TEXTAREA|INPUT/.test(document.activeElement.tagName)) return;
    if (e.key === 'ArrowLeft') setStartPly(state.startPly - 1);
    if (e.key === 'ArrowRight') setStartPly(state.startPly + 1);
  });
  $('undoBtn').addEventListener('click', undo);
  $('restartBtn').addEventListener('click', restart);
  $('flipBtn').addEventListener('click', () => {
    state.orientation = other(state.orientation);
    renderBoard();
  });
  $('backBtn').addEventListener('click', backToSetup);
  $('copyBtn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(state.game.pgn());
      setStatus('PGN을 클립보드에 복사했습니다.');
    } catch (e) {
      prompt('PGN', state.game.pgn());
    }
  });

  engine.init();
  setStartPly(0);
  $('pgn').dataset.loaded = '|';
})();
