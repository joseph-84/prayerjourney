const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

// ── 옵션 A: 입체감 있는 기도손 + 황금 십자가 ─────────────────────────
const svgA = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0%" stop-color="#1C4210"/>
      <stop offset="100%" stop-color="#0C1E06"/>
    </linearGradient>
    <linearGradient id="handGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFF8EE"/>
      <stop offset="60%" stop-color="#FDF2E2"/>
      <stop offset="100%" stop-color="#EED9BE"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="58%" r="40%">
      <stop offset="0%" stop-color="rgba(255,230,160,0.20)"/>
      <stop offset="100%" stop-color="rgba(255,230,160,0)"/>
    </radialGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="12" stdDeviation="22" flood-color="rgba(0,0,0,0.45)"/>
    </filter>
    <filter id="crossGlow">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <rect width="1024" height="1024" rx="210" fill="url(#bg)"/>
  <ellipse cx="512" cy="510" rx="235" ry="275" fill="url(#halo)"/>

  <!-- 황금 십자가 -->
  <g filter="url(#crossGlow)">
    <rect x="501" y="138" width="22" height="88" rx="7" fill="#F0C040" opacity="0.92"/>
    <rect x="467" y="168" width="90" height="22" rx="7" fill="#F0C040" opacity="0.92"/>
    <rect x="501" y="138" width="10" height="88" rx="7" fill="rgba(255,255,220,0.40)"/>
    <rect x="467" y="168" width="90" height="10" rx="7" fill="rgba(255,255,220,0.40)"/>
  </g>
  <g stroke="#F0C040" stroke-width="2.5" stroke-linecap="round" opacity="0.30">
    <line x1="512" y1="130" x2="512" y2="114"/>
    <line x1="459" y1="153" x2="446" y2="142"/>
    <line x1="565" y1="153" x2="578" y2="142"/>
    <line x1="456" y1="179" x2="441" y2="179"/>
    <line x1="568" y1="179" x2="583" y2="179"/>
  </g>

  <!-- 기도손 -->
  <g filter="url(#shadow)">
    <path fill="url(#handGrad)"
      d="M 512 276
         C 533 276, 560 292, 576 321
         C 592 350, 598 382, 600 414
         C 625 434, 648 462, 652 496
         C 655 530, 645 568, 627 600
         C 609 630, 582 656, 554 674
         C 540 684, 526 696, 512 700
         C 498 696, 484 684, 470 674
         C 442 656, 415 630, 397 600
         C 379 568, 369 530, 372 496
         C 376 462, 399 434, 424 414
         C 426 382, 432 350, 448 321
         C 464 292, 491 276, 512 276 Z"
    />
    <!-- 오른쪽 엄지 -->
    <path fill="url(#handGrad)"
      d="M 650 492
         C 670 476, 698 480, 706 498
         C 714 516, 704 544, 682 550
         C 660 556, 644 540, 644 522 Z"
    />
    <!-- 왼쪽 엄지 -->
    <path fill="url(#handGrad)"
      d="M 374 492
         C 354 476, 326 480, 318 498
         C 310 516, 320 544, 342 550
         C 364 556, 380 540, 380 522 Z"
    />
  </g>

  <!-- 손가락 구분선 -->
  <g stroke="#C0A07A" stroke-width="2.2" stroke-linecap="round" opacity="0.46" fill="none">
    <line x1="512" y1="277" x2="512" y2="658"/>
    <path d="M 534 280 C 547 326, 549 382, 543 432"/>
    <path d="M 554 295 C 567 340, 566 392, 558 436"/>
    <path d="M 490 280 C 477 326, 475 382, 481 432"/>
    <path d="M 470 295 C 457 340, 458 392, 466 436"/>
  </g>

  <!-- 왼쪽 손 하이라이트 (입체감) -->
  <path fill="rgba(255,255,255,0.11)"
    d="M 512 276 C 495 276, 474 290, 460 314
       C 446 338, 436 366, 432 394
       C 414 414, 398 440, 374 494
       C 370 470, 370 446, 374 422
       C 380 394, 398 368, 416 344
       C 428 316, 450 290, 474 278 Z"
  />

  <!-- 손목 아래 마감 -->
  <path fill="rgba(180,148,108,0.35)"
    d="M 468 678 C 484 696, 500 708, 512 710
       C 524 708, 540 696, 556 678 Z"
  />
</svg>`;

// ── 옵션 B: 미니멀 — 십자가 + 기도 빛 + 깔끔한 손 실루엣 ────────────
const svgB = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#244E12"/>
      <stop offset="100%" stop-color="#112608"/>
    </linearGradient>
    <radialGradient id="beam" cx="50%" cy="22%" r="55%">
      <stop offset="0%" stop-color="rgba(255,240,180,0.28)"/>
      <stop offset="100%" stop-color="rgba(255,240,180,0)"/>
    </radialGradient>
    <radialGradient id="handGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#EDD9BB"/>
    </radialGradient>
    <filter id="sh2">
      <feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="rgba(0,0,0,0.5)"/>
    </filter>
  </defs>

  <rect width="1024" height="1024" rx="210" fill="url(#bg2)"/>

  <!-- 위에서 내리쬐는 빛 -->
  <ellipse cx="512" cy="180" rx="300" ry="200" fill="url(#beam)"/>

  <!-- 십자가 (크고 단순하게) -->
  <rect x="496" y="108" width="32" height="120" rx="10" fill="rgba(255,215,80,0.95)"/>
  <rect x="452" y="152" width="120" height="32" rx="10" fill="rgba(255,215,80,0.95)"/>
  <!-- 십자가 반짝임 -->
  <rect x="496" y="108" width="14" height="120" rx="10" fill="rgba(255,255,255,0.30)"/>
  <rect x="452" y="152" width="120" height="14" rx="10" fill="rgba(255,255,255,0.30)"/>

  <!-- 기도손 (더 단순한 실루엣) -->
  <g filter="url(#sh2)">
    <path fill="url(#handGlow)"
      d="M 512 308
         C 528 308, 550 320, 564 346
         C 578 372, 584 402, 586 432
         C 606 450, 626 474, 630 506
         C 634 538, 626 572, 612 602
         C 598 630, 578 652, 556 668
         C 544 678, 528 688, 512 692
         C 496 688, 480 678, 468 668
         C 446 652, 426 630, 412 602
         C 398 572, 390 538, 394 506
         C 398 474, 418 450, 438 432
         C 440 402, 446 372, 460 346
         C 474 320, 496 308, 512 308 Z"
    />
    <!-- 오른 엄지 -->
    <path fill="url(#handGlow)"
      d="M 628 502 C 648 488, 674 492, 680 510
         C 686 528, 676 552, 656 556
         C 636 560, 622 546, 624 530 Z"
    />
    <!-- 왼 엄지 -->
    <path fill="url(#handGlow)"
      d="M 396 502 C 376 488, 350 492, 344 510
         C 338 528, 348 552, 368 556
         C 388 560, 402 546, 400 530 Z"
    />
  </g>

  <!-- 손가락 선 (더 subtle) -->
  <g stroke="#B8946A" stroke-width="2" stroke-linecap="round" opacity="0.38" fill="none">
    <line x1="512" y1="309" x2="512" y2="660"/>
    <path d="M 530 312 C 542 354, 544 406, 538 452"/>
    <path d="M 548 326 C 560 366, 560 416, 552 458"/>
    <path d="M 494 312 C 482 354, 480 406, 486 452"/>
    <path d="M 476 326 C 464 366, 464 416, 472 458"/>
  </g>
</svg>`;

const outDir = path.join(__dirname, '../scripts/preview');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

// 512px 미리보기 생성
for (const [name, svg] of [['A_십자가+입체손', svgA], ['B_미니멀+빛', svgB]]) {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 512 } });
  const png = resvg.render().asPng();
  const file = path.join(outDir, `option_${name}.png`);
  fs.writeFileSync(file, png);
  fs.writeFileSync(path.join(outDir, `option_${name}.svg`), svg);
  console.log(`✓ ${file}`);
}

console.log('\n📂 scripts/preview/ 폴더에 미리보기 저장됨');
