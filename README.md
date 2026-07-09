# qr-styler

CLI orodje + lokalni web UI za generiranje styliziranih QR kod z logotipom ali tekstom na sredini. Uporablja
[qr-code-styling](https://github.com/kozakdenys/qr-code-styling) + [node-canvas](https://github.com/Automattic/node-canvas)
za headless generiranje PNG datotek. Vse kode se generirajo z `errorCorrectionLevel: "H"`,
tako da ostanejo berljive kljub logu čez sredino (logo pokrije ~7 % površine, H prenese do 30 %).

## Namestitev

```bash
npm install
```

> Opomba: `package.json` vsebuje samo odvisnosti za statični deploy. Za lokalni
> CLI (`qrcode.js`) ali lokalni strežnik (`server.js`) namesti še:
> `npm install --no-save canvas jsdom`

## Statična stran (za deploy)

Mapa `site/` je samostojna statična stran — vse (PNG **in SVG** izvoz) se
generira v obiskovalčevem brskalniku, strežnik ni potreben. Deploy: usmeri
Vercel/Netlify na mapo `site/` in dodaj poddomeno (npr. `qr-generator.n3x7.si`).

## Web UI (najlažji način)

```bash
npm run web
```

Odpri **http://localhost:3777** — obrazec z vsemi opcijami: URL, slika ali tekst na
sredini, hex barve (color picker + ročni vnos), gradient, oblika pik, velikost.
Klik na "Zaženi" generira kodo, jo prikaže in shrani v mapo `izhod/`.

## CLI uporaba

```bash
# Minimalno — default barvna shema, brez loga
node qrcode.js --url "https://n3x7.si"

# Z logom na sredini (avtomatska margina v barvi ozadja)
node qrcode.js --url "https://n3x7.si" --logo ./logo.png

# Polna kontrola
node qrcode.js --url "https://n3x7.si" --logo ./logo.png --color "#0ea5e9" --bg "#ffffff" --out qr.png

# Linearni gradient namesto ene barve
node qrcode.js --url "https://n3x7.si" --gradient "#0ea5e9,#8b5cf6" --dot-style extra-rounded

# Preset tema
node qrcode.js --url "https://n3x7.si" --logo ./logo.png --theme n3x7 --out qr-n3x7.png

# Shrani v določeno mapo (ustvari se, če ne obstaja)
node qrcode.js --url "https://n3x7.si" --dir "C:\Users\pesak\Desktop" --out moja-koda.png
```

## Parametri

| Parameter | Opis | Default |
|---|---|---|
| `--url` | **(obvezen)** vsebina QR kode | — |
| `--logo` | pot do logo slike (PNG/JPG/SVG), centriran z margino | brez loga |
| `--text` | tekst na sredini namesto loga (izključuje se z `--logo`) | — |
| `--color` | barva pik | `#1e293b` |
| `--bg` | barva ozadja | `#ffffff` |
| `--corner-color` | barva kotnih kvadratkov | enaka `--color` |
| `--dot-style` | `square` \| `dots` \| `rounded` \| `classy` \| `classy-rounded` \| `extra-rounded` | `rounded` |
| `--gradient` | dve hex barvi ločeni z vejico, npr. `"#0ea5e9,#8b5cf6"` | — |
| `--size` | velikost v px (100–4000); za tisk uporabi 2000+ | `1000` |
| `--theme` | preset tema (glej spodaj) | — |
| `--out` | izhodna pot (ime datoteke ali polna pot) | `./qr-output.png` |
| `--dir` | ciljna mapa; `--out` se razreši znotraj nje, mapa se ustvari, če ne obstaja | trenutna mapa |
| `--help` | izpiši pomoč | — |

Eksplicitni parametri imajo prednost pred temo, tema pred defaulti.

## Teme

Teme so definirane v objektu `THEMES` na vrhu [qrcode.js](qrcode.js) — dodaj svojo po istem vzorcu.

| Tema | Opis |
|---|---|
| `n3x7` | temno ozadje `#0b1220`, gradient `#0ea5e9 → #8b5cf6`, cyan koti `#22d3ee`, rounded pike |

## Claude Code slash command

V repozitoriju je tudi `.claude/commands/qrcode.md`, tako da lahko znotraj Claude Code seje pokličeš:

```
/qrcode url:https://n3x7.si logo:./logo.png color:#0ea5e9
```

Claude sparsa argumente, požene skripto in vrne pot do generirane slike.

## Opomba o skenabilnosti

- Logo se kompozitira ročno preko node-canvas (knjižnična vgradnja slike v Node okolju na Windows ne deluje zanesljivo) na zaobljeno podlago v barvi ozadja, velikosti ~26 % širine kode.
- Pri temnih temah (svetle pike na temnem ozadju) gre za "inverted" QR — večina modernih telefonov jih bere, nekateri starejši čitalniki pa ne. Za maksimalno kompatibilnost uporabi svetlo ozadje.
