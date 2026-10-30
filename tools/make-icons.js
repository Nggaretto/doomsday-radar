// بيعمل أيقونات PNG من الروبوت: node tools/make-icons.js
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const bot = `
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a2a8f"/><stop offset="1" stop-color="#050a1f"/></linearGradient>
  <linearGradient id="bw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#c7d3ff"/></linearGradient>
  <linearGradient id="bb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6d8bff"/><stop offset="1" stop-color="#2b3fd6"/></linearGradient>
</defs>
<rect width="512" height="512" fill="url(#bg)"/>
<circle cx="256" cy="230" r="170" fill="#4361ff" opacity=".28"/>
<g transform="translate(131 118) scale(1.25)">
  <line x1="100" y1="36" x2="100" y2="20" stroke="#9db4ff" stroke-width="5" stroke-linecap="round"/>
  <circle cx="100" cy="14" r="8" fill="#35e6ff"/>
  <circle cx="32" cy="84" r="13" fill="url(#bb)"/><circle cx="168" cy="84" r="13" fill="url(#bb)"/>
  <rect x="40" y="36" width="120" height="94" rx="44" fill="url(#bw)"/>
  <rect x="54" y="52" width="92" height="60" rx="28" fill="#0a1236"/>
  <circle cx="80" cy="80" r="10" fill="#35e6ff"/><circle cx="120" cy="80" r="10" fill="#35e6ff"/>
  <circle cx="83" cy="77" r="3.5" fill="#fff"/><circle cx="123" cy="77" r="3.5" fill="#fff"/>
  <path d="M88 98q12 9 24 0" stroke="#35e6ff" stroke-width="4" fill="none" stroke-linecap="round"/>
  <rect x="64" y="132" width="72" height="62" rx="28" fill="url(#bw)"/>
  <circle cx="100" cy="160" r="9" fill="#35e6ff"/><circle cx="100" cy="160" r="4" fill="#fff"/>
  <circle cx="56" cy="164" r="13" fill="url(#bw)"/>
  <path d="M116 150h60l-8 52h-44z" fill="#fff"/>
  <path d="M116 150h10L131.3 202H124z" fill="#ff2d55"/><path d="M136 150h10L146 202H138.7z" fill="#ff2d55"/><path d="M156 150h10L160.7 202H153.3z" fill="#ff2d55"/>
  <g fill="#fff3c4"><circle cx="128" cy="146" r="9"/><circle cx="146" cy="140" r="10"/><circle cx="164" cy="146" r="9"/><circle cx="137" cy="135" r="8"/><circle cx="156" cy="134" r="8"/></g>
</g>`;
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bot}</svg>`);
const out = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(out, { recursive: true });

(async () => {
  await sharp(svg).resize(192, 192).png().toFile(path.join(out, 'icon-192.png'));
  await sharp(svg).resize(512, 512).png().toFile(path.join(out, 'icon-512.png'));
  await sharp(svg).resize(512, 512).png().toFile(path.join(out, 'icon-maskable-512.png'));
  console.log('✅ icons done');
})();