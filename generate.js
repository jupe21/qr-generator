"use strict";

// Skupna logika generiranja — uporabljata jo CLI (qrcode.js) in web UI (server.js).

const path = require("path");
const nodeCanvas = require("canvas");
const { JSDOM } = require("jsdom");
const QRCodeStyling = require("qr-code-styling");

const DOT_STYLES = [
  "square",
  "dots",
  "rounded",
  "classy",
  "classy-rounded",
  "extra-rounded",
];

// Preset barvne teme — dodaj svoje po istem vzorcu.
const THEMES = {
  n3x7: {
    gradient: "#0ea5e9,#8b5cf6",
    bg: "#0b1220",
    cornerColor: "#22d3ee",
    dotStyle: "rounded",
  },
  oslea: {
    gradient: "#454547,#000000",
    bg: "#ede8e4",
    // Svetle barve kotov (npr. cyan) na svetlem ozadju uničijo kontrast
    // kotnih vzorcev in koda postane neberljiva.
    cornerColor: "#1c1c1e",
    dotStyle: "rounded",
  },
};

const DEFAULTS = {
  color: "#1e293b",
  bg: "#ffffff",
  dotStyle: "rounded",
  size: 1000,
  out: "./qr-output.png",
};

function buildQrConfig(opts) {
  const dotsColor = opts.gradientStops
    ? {
        gradient: {
          type: "linear",
          rotation: Math.PI / 4,
          colorStops: [
            { offset: 0, color: opts.gradientStops[0] },
            { offset: 1, color: opts.gradientStops[1] },
          ],
        },
      }
    : { color: opts.color };

  const cornerColor =
    opts.cornerColor ??
    (opts.gradientStops ? opts.gradientStops[0] : opts.color);

  // Kotni kvadratki naj slogovno sledijo izbranemu stilu pik.
  const cornerSquareType =
    opts.dotStyle === "dots"
      ? "dot"
      : opts.dotStyle === "square"
        ? "square"
        : "extra-rounded";

  return {
    nodeCanvas,
    jsdom: JSDOM,
    width: opts.size,
    height: opts.size,
    type: "canvas",
    data: opts.url,
    margin: Math.round(opts.size * 0.03),
    qrOptions: { errorCorrectionLevel: "H" },
    dotsOptions: { type: opts.dotStyle, ...dotsColor },
    backgroundOptions: { color: opts.bg },
    cornersSquareOptions: { type: cornerSquareType, color: cornerColor },
    cornersDotOptions: { color: cornerColor },
  };
}

// Zaobljena podlaga v barvi ozadja na sredini kode, da vsebina (tudi
// transparenten logo) ne seka pik. Vrne notranji kvadrat za vsebino.
function drawCenterPlate(ctx, opts, canvasSize) {
  const boxSize = Math.round(opts.size * 0.26); // vsebina + margina, ~6.8 % površine
  const margin = Math.round(opts.size * 0.02);
  const boxX = (canvasSize - boxSize) / 2;
  const boxY = (canvasSize - boxSize) / 2;

  const r = Math.round(boxSize * 0.18);
  ctx.beginPath();
  ctx.moveTo(boxX + r, boxY);
  ctx.arcTo(boxX + boxSize, boxY, boxX + boxSize, boxY + boxSize, r);
  ctx.arcTo(boxX + boxSize, boxY + boxSize, boxX, boxY + boxSize, r);
  ctx.arcTo(boxX, boxY + boxSize, boxX, boxY, r);
  ctx.arcTo(boxX, boxY, boxX + boxSize, boxY, r);
  ctx.closePath();
  ctx.fillStyle = opts.bg;
  ctx.fill();

  return boxSize - 2 * margin;
}

// Logo kompozitiramo sami z node-canvas: knjižnica QR interno rasterizira iz
// SVG-ja, v katerem librsvg (Windows build node-canvas) vgnezdenih <image>
// data-URI-jev ne izriše. Ročno risanje je poleg tega deterministično —
// vsebina pokrije ~7 % površine, kar errorCorrectionLevel "H" (30 %) zlahka prenese.
async function compositeLogo(qrBuffer, opts) {
  const logoSource = opts.logoBuffer ?? path.resolve(opts.logo);
  const [qrImg, logoImg] = await Promise.all([
    nodeCanvas.loadImage(qrBuffer),
    nodeCanvas.loadImage(logoSource),
  ]);

  const canvas = nodeCanvas.createCanvas(qrImg.width, qrImg.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(qrImg, 0, 0);

  const logoBox = drawCenterPlate(ctx, opts, qrImg.width);

  // Logo umerimo v kvadrat logoBox z ohranjenim razmerjem stranic.
  const scale = Math.min(logoBox / logoImg.width, logoBox / logoImg.height);
  const w = logoImg.width * scale;
  const h = logoImg.height * scale;
  ctx.drawImage(logoImg, (qrImg.width - w) / 2, (qrImg.height - h) / 2, w, h);

  return canvas.toBuffer("image/png");
}

// Tekst na sredini namesto loga — v barvi pik (oz. prve barve gradienta).
async function compositeText(qrBuffer, opts) {
  const qrImg = await nodeCanvas.loadImage(qrBuffer);
  const canvas = nodeCanvas.createCanvas(qrImg.width, qrImg.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(qrImg, 0, 0);

  const textBox = drawCenterPlate(ctx, opts, qrImg.width);

  const textColor = opts.gradientStops ? opts.gradientStops[0] : opts.color;
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Velikost pisave zmanjšujemo, dokler tekst ne gre v okvir.
  let fontSize = Math.round(textBox * 0.6);
  do {
    ctx.font = `bold ${fontSize}px sans-serif`;
    fontSize -= 2;
  } while (ctx.measureText(opts.text).width > textBox && fontSize > 8);

  ctx.fillText(opts.text, qrImg.width / 2, qrImg.height / 2);

  return canvas.toBuffer("image/png");
}

// opts: { url, size, color, bg, cornerColor?, dotStyle, gradientStops?,
//         logo? (pot) | logoBuffer? (Buffer) | text? }
// Vrne PNG Buffer.
async function generateQr(opts) {
  const qr = new QRCodeStyling(buildQrConfig(opts));
  let buffer = await qr.getRawData("png");
  if (opts.logo || opts.logoBuffer) buffer = await compositeLogo(buffer, opts);
  else if (opts.text) buffer = await compositeText(buffer, opts);
  return buffer;
}

module.exports = { generateQr, THEMES, DOT_STYLES, DEFAULTS };
