"use strict";

// Lokalni web UI za generiranje QR kod: node server.js -> http://localhost:3777

const fs = require("fs");
const path = require("path");
const http = require("http");
const { generateQr, THEMES, DOT_STYLES, DEFAULTS } = require("./generate");

const PORT = 3777;
const OUT_DIR = path.join(__dirname, "izhod");
const MAX_BODY = 25 * 1024 * 1024; // 25 MB (logo se pošlje kot base64)

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("Telo zahteve je preveliko (logo nad 25 MB?)"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function validate(body) {
  if (!body.url || typeof body.url !== "string" || !body.url.trim())
    throw new Error("URL / vsebina kode je obvezna");

  const hex = /^#[0-9a-fA-F]{3,8}$/;
  for (const [key, label] of [
    ["color", "barva pik"],
    ["bg", "barva ozadja"],
    ["cornerColor", "barva kotov"],
    ["gradient2", "druga barva gradienta"],
  ]) {
    if (body[key] != null && body[key] !== "" && !hex.test(body[key]))
      throw new Error(`Neveljavna hex vrednost za ${label}: "${body[key]}"`);
  }

  if (body.dotStyle && !DOT_STYLES.includes(body.dotStyle))
    throw new Error(`Neveljaven stil pik: "${body.dotStyle}"`);

  const size = Number(body.size) || DEFAULTS.size;
  if (!Number.isInteger(size) || size < 100 || size > 4000)
    throw new Error("Velikost mora biti med 100 in 4000 px");

  return size;
}

async function handleGenerate(req, res) {
  let body;
  try {
    body = JSON.parse((await readBody(req)).toString("utf8"));
  } catch (err) {
    return sendJson(res, 400, { error: `Neveljavna zahteva: ${err.message}` });
  }

  try {
    const size = validate(body);

    const opts = {
      url: body.url.trim(),
      size,
      color: body.color || DEFAULTS.color,
      bg: body.bg || DEFAULTS.bg,
      cornerColor: body.cornerColor || undefined,
      dotStyle: body.dotStyle || DEFAULTS.dotStyle,
    };

    if (body.gradient2) {
      opts.gradientStops = [opts.color, body.gradient2];
    }

    if (body.centerType === "image" && body.imageData) {
      // data URL (base64) iz brskalnika -> Buffer; SVG/PNG/JPG vse podpira loadImage.
      const match = /^data:[^;]+;base64,(.+)$/.exec(body.imageData);
      if (!match) throw new Error("Neveljaven format naložene slike");
      opts.logoBuffer = Buffer.from(match[1], "base64");
    } else if (body.centerType === "text" && body.text && body.text.trim()) {
      opts.text = body.text.trim();
    }

    const buffer = await generateQr(opts);

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const requested = (body.filename || "").trim().replace(/[<>:"/\\|?*]/g, "");
    const name = requested
      ? requested.endsWith(".png")
        ? requested
        : `${requested}.png`
      : `qr-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.png`;
    const outPath = path.join(OUT_DIR, name);
    fs.writeFileSync(outPath, buffer);

    sendJson(res, 200, {
      savedPath: outPath,
      filename: name,
      size,
      image: `data:image/png;base64,${buffer.toString("base64")}`,
    });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fs.readFileSync(path.join(__dirname, "public", "index.html")));
  } else if (req.method === "GET" && req.url === "/config") {
    sendJson(res, 200, { themes: THEMES, dotStyles: DOT_STYLES, defaults: DEFAULTS });
  } else if (req.method === "POST" && req.url === "/generate") {
    await handleGenerate(req, res);
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`QR generator teče na http://localhost:${PORT}`);
  console.log(`Kode se shranjujejo v: ${OUT_DIR}`);
});
