/* 체스 기물 SVG (이 프로젝트용으로 직접 그린 도형, viewBox 45x45)
 * 글자(♟ 등) 대신 그림을 쓰므로 iOS 이모지 문제 없이 모든 기기에서 같은 모양으로 보인다. */
(function () {
  'use strict';
  // 각 기물: body = 채우는 도형들, lines = 안쪽 장식선
  const SHAPES = {
    p: {
      body: [
        'M22.5 9a4 4 0 0 0-3.2 6.4A6 6 0 0 0 17 20.5c0 1.9.9 3.6 2.3 4.7C16.3 26.3 12 30.7 12 38.5h21c0-7.8-4.3-12.2-7.3-13.3a6 6 0 0 0 2.3-4.7 6 6 0 0 0-2.3-5.1A4 4 0 0 0 22.5 9z',
      ],
      lines: [],
    },
    r: {
      body: [
        'M9 39h27v-3H9z',
        'M12 36l2-5h17l2 5z',
        'M14 31V17h17v14z',
        'M11 9h4v3h5V9h5v3h5V9h4v5l-3 3H14l-3-3z',
      ],
      lines: ['M14 17h17', 'M14 31h17'],
    },
    b: {
      body: [
        'M10 39h25v-2.5c-4-1.5-8.5-.5-12.5-2.5-4 2-8.5 1-12.5 2.5z',
        'M14.5 31.5h16c2.5-3 2.8-6.5-.2-11.5-2-3.4-4.8-6.2-7.8-8.5-3 2.3-5.8 5.1-7.8 8.5-3 5-2.7 8.5-.2 11.5z',
        'M14 31.5h17v3H14z',
        'M22.5 7.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 1 1 0-5z',
      ],
      lines: ['M20 25h5', 'M22.5 22.5v5', 'M26.5 16.5l-3.5 4'],
    },
    n: {
      body: [
        'M13 39h22c.5-9-1-17-4.5-21.5-2.3-3-5.3-5-8.5-5.8L21 8.5l-2.2 3.8c-2.3 1-4 2.8-5 5L9.2 24c-1 2 .3 3.8 2.3 3.6l4.3-2.1c2.3-.2 4.3-1.2 5.8-2.8-1 4-4 7.2-7 9.6-1.4 1.3-1.6 3.6-1.6 6.7z',
      ],
      lines: ['M12 24.5l1.2-.8', 'M29 18c2 4 3 10 2.8 18'],
      eye: [16.8, 17.6],
    },
    q: {
      body: [
        'M10 39h25l-1.5-4h-22z',
        'M11.5 35c.8-6 0-9.5-2.5-17l6.5 9.5L16.5 15l6 11.5 6-11.5 1 12.5L36 18c-2.5 7.5-3.3 11-2.5 17z',
        'M9 14.5a2 2 0 1 1 0 4 2 2 0 1 1 0-4zM15.5 12.5a2 2 0 1 1 0 4 2 2 0 1 1 0-4zM22.5 11a2 2 0 1 1 0 4 2 2 0 1 1 0-4zM29.5 12.5a2 2 0 1 1 0 4 2 2 0 1 1 0-4zM36 14.5a2 2 0 1 1 0 4 2 2 0 1 1 0-4z',
      ],
      lines: ['M12.5 31.5h20'],
    },
    k: {
      body: [
        'M11 39h23v-3H11z',
        'M12.5 36h20l-.8-5.5c4.3-3 6.6-7.2 3.6-10.3-3.1-3.1-8.3-1.2-12.8 4.3-4.5-5.5-9.7-7.4-12.8-4.3-3 3.1-.7 7.3 3.6 10.3z',
        'M22.5 24.5c-2.4-3.8-3.5-6.6-3.5-8.6a3.5 3.5 0 0 1 7 0c0 2-1.1 4.8-3.5 8.6z',
      ],
      lines: ['M13.5 31h18', 'M22.5 5.5v6.5', 'M19.5 8.5h6'],
      outerLines: true,
    },
  };

  function build(type, color) {
    const s = SHAPES[type];
    const fill = color === 'w' ? '#fafafa' : '#1b1b1b';
    const stroke = '#111';
    const detail = color === 'w' ? '#111' : '#e8e8e8';
    let out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">' +
      `<g fill="${fill}" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">`;
    for (const d of s.body) out += `<path d="${d}"/>`;
    out += '</g>';
    if (s.lines.length) {
      out += `<g fill="none" stroke-width="1.5" stroke-linecap="round">`;
      s.lines.forEach((d, i) => {
        // 킹의 십자가는 기물 바깥이라 항상 테두리 색
        const c = s.outerLines && i > 0 ? stroke : detail;
        out += `<path d="${d}" stroke="${c}"/>`;
      });
      out += '</g>';
    }
    if (s.eye) out += `<circle cx="${s.eye[0]}" cy="${s.eye[1]}" r="1.2" fill="${detail}"/>`;
    return out + '</svg>';
  }

  const PIECE_SVG = {};
  for (const c of ['w', 'b']) for (const t of 'pnbrqk') PIECE_SVG[c + t] = build(t, c);
  window.PIECE_SVG = PIECE_SVG;
})();
