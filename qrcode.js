#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { parseArgs } = require("node:util");
const nodeCanvas = require("canvas");
const { generateQr, THEMES, DOT_STYLES, DEFAULTS } = require("./generate");

const USAGE = `
Uporaba:
  node qrcode.js --url "https://..." [opcije]

Opcije:
  --url            (obvezno) vsebina QR kode
  --logo           pot do logo slike (PNG/JPG/SVG), postavljen na sredino
  --text           tekst na sredini namesto loga (npr. "N7")
  --color          barva pik, default ${DEFAULTS.color}
  --bg             barva ozadja, default ${DEFAULTS.bg}
  --corner-color   barva kotnih kvadratkov (default: enaka --color)
  --dot-style      ${DOT_STYLES.join(" | ")}, default ${DEFAULTS.dotStyle}
  --gradient       dve barvi ločeni z vejico (npr. "#0ea5e9,#8b5cf6") za linearni gradient
  --size           velikost v px, default ${DEFAULTS.size}
  --theme          preset tema (na voljo: ${Object.keys(THEMES).join(", ")})
  --out            izhodna pot (ime datoteke ali polna pot), default ${DEFAULTS.out}
  --dir            ciljna mapa; --out se razreši znotraj nje (ustvari se, če ne obstaja)
  --help           izpiši to pomoč

Primer:
  node qrcode.js --url "https://n3x7.si" --logo ./logo.png --theme n3x7 --out qr.png
`;

function fail(message) {
  console.error(`Napaka: ${message}`);
  console.error(USAGE);
  process.exit(1);
}

function parseCliArgs() {
  let parsed;
  try {
    parsed = parseArgs({
      options: {
        url: { type: "string" },
        logo: { type: "string" },
        text: { type: "string" },
        color: { type: "string" },
        bg: { type: "string" },
        "corner-color": { type: "string" },
        "dot-style": { type: "string" },
        gradient: { type: "string" },
        size: { type: "string" },
        theme: { type: "string" },
        out: { type: "string" },
        dir: { type: "string" },
        help: { type: "boolean" },
      },
    });
  } catch (err) {
    fail(err.message);
  }
  return parsed.values;
}

function resolveOptions(args) {
  if (args.help) {
    console.log(USAGE);
    process.exit(0);
  }

  if (!args.url) fail("manjka obvezni parameter --url");
  if (args.logo && args.text)
    fail("--logo in --text se izključujeta, podaj samo enega");

  let theme = {};
  if (args.theme) {
    theme = THEMES[args.theme];
    if (!theme)
      fail(
        `neznana tema "${args.theme}" (na voljo: ${Object.keys(THEMES).join(", ")})`,
      );
  }

  // Prioriteta: eksplicitni CLI parametri > tema > defaulti.
  const opts = {
    url: args.url,
    logo: args.logo,
    text: args.text,
    color: args.color ?? theme.color ?? DEFAULTS.color,
    bg: args.bg ?? theme.bg ?? DEFAULTS.bg,
    cornerColor: args["corner-color"] ?? theme.cornerColor,
    dotStyle: args["dot-style"] ?? theme.dotStyle ?? DEFAULTS.dotStyle,
    gradient: args.gradient ?? theme.gradient,
    size: args.size ? Number(args.size) : DEFAULTS.size,
    out: args.out ?? DEFAULTS.out,
    dir: args.dir,
  };

  // Eksplicitna enotna barva izklopi gradient iz teme.
  if (args.color && !args.gradient) opts.gradient = undefined;

  if (!Number.isInteger(opts.size) || opts.size < 100 || opts.size > 4000) {
    fail(
      `--size mora biti celo število med 100 in 4000 (podano: "${args.size}")`,
    );
  }

  if (!DOT_STYLES.includes(opts.dotStyle)) {
    fail(
      `neveljaven --dot-style "${opts.dotStyle}" (na voljo: ${DOT_STYLES.join(" | ")})`,
    );
  }

  if (opts.logo && !fs.existsSync(opts.logo)) {
    fail(`logo datoteka ne obstaja: "${opts.logo}"`);
  }

  if (opts.gradient) {
    const stops = opts.gradient.split(",").map((s) => s.trim());
    if (
      stops.length !== 2 ||
      stops.some((s) => !/^#[0-9a-fA-F]{3,8}$/.test(s))
    ) {
      fail(
        `--gradient pričakuje dve hex barvi ločeni z vejico, npr. "#0ea5e9,#8b5cf6" (podano: "${opts.gradient}")`,
      );
    }
    opts.gradientStops = stops;
  }

  return opts;
}

async function main() {
  const opts = resolveOptions(parseCliArgs());
  const buffer = await generateQr(opts);

  // --dir: relativni --out se razreši znotraj podane mape (absoluten --out obvelja).
  const outPath = opts.dir
    ? path.resolve(opts.dir, opts.out)
    : path.resolve(opts.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buffer);

  const img = await nodeCanvas.loadImage(buffer);
  console.log(`QR koda shranjena: ${outPath}`);
  console.log(`Dimenzije: ${img.width} x ${img.height} px`);
}

main().catch((err) => {
  console.error(`Napaka pri generiranju QR kode: ${err.message}`);
  process.exit(1);
});
