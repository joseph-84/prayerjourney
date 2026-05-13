const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

// 옵션 B — 1.7배 스케일업, 여백 축소
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#244E12"/>
      <stop offset="100%" stop-color="#112608"/>
    </linearGradient>
    <radialGradient id="beam" cx="50%" cy="16%" r="60%">
      <stop offset="0%" stop-color="rgba(255,240,180,0.30)"/>
      <stop offset="100%" stop-color="rgba(255,240,180,0)"/>
    </radialGradient>
    <radialGradient id="handGlow" cx="38%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#E8D0A8"/>
    </radialGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="14" stdDeviation="26" flood-color="rgba(0,0,0,0.50)"/>
    </filter>
  </defs>

  <!-- 배경 -->
  <rect width="1024" height="1024" rx="210" fill="url(#bg)"/>

  <!-- 위에서 내리쬐는 빛 -->
  <ellipse cx="512" cy="120" rx="360" ry="240" fill="url(#beam)"/>

  <!-- 십자가 (크게) -->
  <rect x="492" y="28"  width="40" height="152" rx="12" fill="rgba(255,215,80,0.95)"/>
  <rect x="444" y="76"  width="136" height="40"  rx="12" fill="rgba(255,215,80,0.95)"/>
  <!-- 십자가 하이라이트 -->
  <rect x="492" y="28"  width="18" height="152" rx="12" fill="rgba(255,255,255,0.28)"/>
  <rect x="444" y="76"  width="136" height="18"  rx="12" fill="rgba(255,255,255,0.28)"/>

  <!-- 기도손 (크게) -->
  <g filter="url(#shadow)">

    <!-- 손 전체 실루엣 -->
    <path fill="url(#handGlow)"
      d="M 512 201
         C 542 201, 583 221, 609 265
         C 635 309, 646 359, 650 410
         C 687 441, 724 481, 731 535
         C 739 589, 724 647, 698 697
         C 672 745, 635 782, 594 809
         C 572 826, 542 843, 512 849
         C 482 843, 452 826, 430 809
         C 389 782, 352 745, 326 697
         C 300 647, 285 589, 293 535
         C 300 481, 337 441, 374 410
         C 378 359, 389 309, 415 265
         C 441 221, 482 201, 512 201
         Z"
    />

    <!-- 오른쪽 엄지 -->
    <path fill="url(#handGlow)"
      d="M 729 532
         C 754 514, 788 518, 797 542
         C 806 566, 792 600, 763 607
         C 734 614, 714 594, 717 570
         Z"
    />

    <!-- 왼쪽 엄지 -->
    <path fill="url(#handGlow)"
      d="M 295 532
         C 270 514, 236 518, 227 542
         C 218 566, 232 600, 261 607
         C 290 614, 310 594, 307 570
         Z"
    />
  </g>

  <!-- 손가락 구분선 -->
  <g stroke="#B8946A" stroke-width="2.4" stroke-linecap="round" opacity="0.40" fill="none">
    <!-- 가운데 (양손 경계) -->
    <line x1="512" y1="202" x2="512" y2="812"/>
    <!-- 오른손 검지-중지 -->
    <path d="M 545 207 C 560 274, 562 366, 548 444"/>
    <!-- 오른손 중지-약지 -->
    <path d="M 579 231 C 601 299, 601 383, 586 454"/>
    <!-- 왼손 검지-중지 (대칭) -->
    <path d="M 479 207 C 464 274, 462 366, 476 444"/>
    <!-- 왼손 중지-약지 (대칭) -->
    <path d="M 445 231 C 423 299, 423 383, 438 454"/>
  </g>
</svg>`;

const sizes = [
  { dir: 'mipmap-mdpi',    px: 48  },
  { dir: 'mipmap-hdpi',    px: 72  },
  { dir: 'mipmap-xhdpi',   px: 96  },
  { dir: 'mipmap-xxhdpi',  px: 144 },
  { dir: 'mipmap-xxxhdpi', px: 192 },
];

// 미리보기 (512px)
const outDir = path.join(__dirname, 'preview');
const resvgPrev = new Resvg(svg, { fitTo: { mode: 'width', value: 512 } });
fs.writeFileSync(path.join(outDir, 'option_B2_preview.png'), resvgPrev.render().asPng());
console.log('✓ 미리보기 저장: scripts/preview/option_B2_preview.png');

// 실제 아이콘 저장 여부 확인용 플래그 (apply 인수 전달 시 적용)
if (process.argv[2] === 'apply') {
  const resRoot = path.join(__dirname, '../android/app/src/main/res');
  for (const { dir, px } of sizes) {
    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: px } });
    const png   = resvg.render().asPng();
    const dirPath = path.join(resRoot, dir);
    for (const old of ['ic_launcher.webp', 'ic_launcher_round.webp', 'ic_launcher.png', 'ic_launcher_round.png']) {
      const fp = path.join(dirPath, old);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    fs.writeFileSync(path.join(dirPath, 'ic_launcher.png'), png);
    fs.writeFileSync(path.join(dirPath, 'ic_launcher_round.png'), png);
    console.log(`✓ ${dir}: ${px}×${px}px`);
  }
  console.log('\n✅ 아이콘 적용 완료!');
}
