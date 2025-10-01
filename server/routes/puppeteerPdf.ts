import * as puppeteer from "puppeteer";
import { Request, Response } from "express";
import { LRUCache } from "lru-cache";
import sharp from "sharp";
import { execFile } from "child_process";
import { promisify } from "util";
import { minify } from "html-minifier";
import tmp from "tmp-promise";
import fs from "fs/promises";
import * as csso from "csso";

const execFileAsync = promisify(execFile);

// ---------- Ghostscript PDF compression ----------
const compressPdfGs = async (
  inputBuffer: Buffer,
  quality: "screen" | "ebook" | "printer" | "prepress" = "screen",
) => {
  const inputFile = await tmp.file();
  const outputFile = await tmp.file();
  await fs.writeFile(inputFile.path, inputBuffer);

  const args = [
    "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=1.4",
    "-dPDFSETTINGS=/" + quality,
    "-dNOPAUSE",
    "-dQUIET",
    "-dBATCH",
    `-sOutputFile=${outputFile.path}`,
    inputFile.path,
  ];

  await execFileAsync("gs", args);
  const compressedBuffer = await fs.readFile(outputFile.path);
  await inputFile.cleanup();
  await outputFile.cleanup();

  return compressedBuffer;
};

// ---------- PDF Cache ----------
const pdfCache = new LRUCache<string, Buffer>({ max: 50, ttl: 1000 * 60 * 10 });

// ---------- Browser Pool ----------
let browser: puppeteer.Browser | null = null;

// Launch Puppeteer on server start for faster first request
(async () => {
  browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-gpu",
    ],
  });
})();

const getBrowser = async () => {
  if (!browser) throw new Error("Puppeteer browser not initialized");
  return browser;
};

// ---------- Image Compression ----------
const compressImages = async (html: string) => {
  const imgRegex = /<img[^>]+src="([^">]+)"/g;
  const matches: string[] = [];
  let match;

  while ((match = imgRegex.exec(html)) !== null) matches.push(match[1]);

  const replacements = await Promise.all(
    matches.map(async (url) => {
      if (!url.startsWith("data:image")) return url;

      const base64 = url.split(",")[1];
      const buffer = Buffer.from(base64, "base64");

      const compressed = await sharp(buffer)
        .resize({ width: 400, withoutEnlargement: true }) // small width
        .jpeg({ quality: 30, mozjpeg: true }) // aggressive compression
        .toBuffer();

      return `data:image/jpeg;base64,${compressed.toString("base64")}`;
    }),
  );

  let optimizedHtml = html;
  matches.forEach(
    (orig, i) => (optimizedHtml = optimizedHtml.replace(orig, replacements[i])),
  );
  return optimizedHtml;
};

// ---------- Inline CSS ----------
const inlineCssHtml = (html: string, css: string) => `
<html>
<head>
<style>${css}</style>
</head>
<body>${html}</body>
</html>
`;

// ---------- PDF Handler ----------
export async function handleDownloadPdfPuppeteer(req: Request, res: Response) {
  try {
    const {
      html,
      css,
      format = "A4",
      orientation = "portrait",
      compress = true,
    } = req.body;

    if (!html || !css)
      return res.status(400).json({ error: "HTML and CSS required" });

    // Use a cache key that uniquely identifies the request
    const cacheKey = `${html}-${css}-${format}-${orientation}-${compress}`;

    // Check if PDF is already cached
    if (pdfCache.has(cacheKey)) {
      const cachedPdf = pdfCache.get(cacheKey)!;
      return res
        .status(200)
        .set("Content-Type", "application/pdf")
        .set("Content-Disposition", 'attachment; filename="report.pdf"')
        .send(cachedPdf);
    }

    // Minify CSS using csso
    const minifiedCss = csso.minify(css).css;

    const optimizedHtml = await compressImages(html);

    // Inline CSS + minify HTML
    const minifiedHtml = minify(
      `<html><head><style>${minifiedCss}</style></head><body>${optimizedHtml}</body></html>`,
      {
        collapseWhitespace: true,
        removeComments: true,
        minifyCSS: true,
        minifyJS: true,
      },
    );

    const page = await (await getBrowser()).newPage();
    await page.setContent(minifiedHtml, { waitUntil: "domcontentloaded" });
    await page.emulateMediaType("screen");
    await page.setViewport({ width: 800, height: 1000 });

    let pdfBuffer = await page.pdf({
      format,
      printBackground: !compress,
      landscape: orientation === "landscape",
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
      preferCSSPageSize: true,
    });

    await page.close();

    if (compress && pdfBuffer.length > 5 * 1024 * 1024) {
      pdfBuffer = await compressPdfGs(Buffer.from(pdfBuffer), "screen");
    }

    // Store PDF in cache
    pdfCache.set(cacheKey, Buffer.from(pdfBuffer));

    res
      .status(200)
      .set("Content-Type", "application/pdf")
      .set("Content-Disposition", 'attachment; filename="report.pdf"')
      .send(pdfBuffer);
  } catch (err) {
    console.error("PDF generation error:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
}
