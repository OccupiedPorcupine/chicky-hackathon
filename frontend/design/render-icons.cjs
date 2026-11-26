// Builds the favicon and home-screen icons in frontend/images/icons/ from the logo in images/brand/,
// and the link preview, images/brand/og-card.png, from design/og-card.html.
// Run from the repo root after changing a logo SVG (Playwright as in capture-screenshots.cjs):
//   PW=/tmp/chicky-pw/node_modules/playwright node frontend/design/render-icons.cjs
//
// - icon.svg, the favicon, is a copy of logo-mark-small.svg (the mark drawn for 16-32px), and
//   icon-32.png is it rendered for browsers without SVG favicons.
// - apple-touch-icon.png, icon-192.png and icon-512.png are the full mark (logo-mark.svg) on a
//   full-bleed Cream square. The mark stays inside the central 80% circle that Android may mask
//   to, so icon-512.png also serves as the manifest's maskable icon.
const { chromium } = require(process.env.PW || "playwright");
const fs = require("fs");
const path = require("path");

const images = path.join(__dirname, "..", "images");
const icons = path.join(images, "icons");
const brand = path.join(images, "brand");
const CREAM = "#FFF4DD";
// Width of the mark as a share of the icon. The mark's box is about 128 x 120, so at 56% its
// corners sit 38% from the centre: inside the 40% radius of the maskable safe zone.
const MARK_SHARE = 0.56;

const small = fs.readFileSync(path.join(brand, "logo-mark-small.svg"), "utf8");
const mark = fs.readFileSync(path.join(brand, "logo-mark.svg"), "utf8");
fs.writeFileSync(path.join(icons, "icon.svg"), small);

const appIcon = size => `<style>html,body{margin:0}body{width:${size}px;height:${size}px;display:grid;place-items:center;background:${CREAM}}
  svg{display:block;width:${Math.round(size * MARK_SHARE)}px;height:auto}</style>${mark}`;
const favicon = size => `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${small}`;

const outputs = [
  ["icon-32.png", 32, favicon, true],
  ["apple-touch-icon.png", 180, appIcon, false],
  ["icon-192.png", 192, appIcon, false],
  ["icon-512.png", 512, appIcon, false]
];

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  for (const [file, size, html, transparent] of outputs) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(html(size));
    await page.screenshot({ path: path.join(icons, file), omitBackground: transparent });
    console.log(file, size);
  }
  // The link preview (og:image): Chicky and the wordmark on Cream, from design/og-card.html.
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto("file://" + path.join(__dirname, "og-card.html"));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(brand, "og-card.png") });
  console.log("og-card.png", "1200x630");
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
