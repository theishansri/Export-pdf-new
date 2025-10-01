import PDFDocument from "pdfkit";
import { LRUCache } from "lru-cache";
import stream from "stream";

// Create an in-memory cache for PDFs
const pdfCache = new LRUCache<string, Buffer>({
  max: 50, // Maximum number of cached PDFs
  ttl: 1000 * 60 * 10, // Cache PDFs for 10 minutes
});

export default async function exportPdfKit(req, res) {
  try {
    const { html, css } = req.body;

    // Validate input
    if (!html || !css) {
      return res.status(400).json({ error: "HTML and CSS must be provided" });
    }

    // Generate a unique cache key based on the request data
    const cacheKey = JSON.stringify({ html, css });

    // Check if the PDF is already cached
    if (pdfCache.has(cacheKey)) {
      console.log("Serving PDF from cache");
      const cachedPdf = pdfCache.get(cacheKey);
      if (cachedPdf) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="cached-report.pdf"',
        );
        return res.send(cachedPdf);
      }
    }

    // Create a new PDF document
    const doc = new PDFDocument({ margin: 40, size: "A4" });

    const passThroughStream = new stream.PassThrough();
    const pdfBufferChunks: Buffer[] = []; // Collect PDF chunks for caching

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="report.pdf"');
    doc.pipe(passThroughStream);

    // Collect the PDF data into a buffer
    passThroughStream.on("data", (chunk) => pdfBufferChunks.push(chunk));
    passThroughStream.pipe(res);

    // === Render Content ===

    // 1. Render Header
    doc
      .fontSize(16)
      .fillColor("#333")
      .text("Generated PDF Report", { align: "center" });
    doc.moveDown();

    let y = doc.y; // Track the vertical position

    // 2. Parse and Render HTML Content
    const parsedContent = parseHtmlToText(html); // Parse HTML to extract text content
    parsedContent.forEach((block) => {
      const { type, content, styles } = block;

      // Apply styles (e.g., font size, color)
      if (styles.fontSize) doc.fontSize(styles.fontSize);
      if (styles.color) doc.fillColor(styles.color);

      // Render content based on type
      if (type === "text") {
        if (y + 20 > doc.page.height - 40) {
          doc.addPage();
          y = 40;
        }
        doc.text(content, { align: styles.align || "left" });
        y = doc.y;
      } else if (type === "lineBreak") {
        doc.moveDown();
        y = doc.y;
      }
    });

    // End the PDF document
    doc.end();

    // Cache the generated PDF
    passThroughStream.on("end", () => {
      const pdfBuffer = Buffer.concat(pdfBufferChunks);
      pdfCache.set(cacheKey, pdfBuffer);
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
}

// === Helper Functions ===

// Parse HTML to extract text content and styles
function parseHtmlToText(html) {
  const blocks = [];
  const divRegex = /<div.*?style="(.*?)".*?>(.*?)<\/div>/g;
  const pRegex = /<p.*?style="(.*?)".*?>(.*?)<\/p>/g;

  let match;

  // Parse <div> elements
  while ((match = divRegex.exec(html)) !== null) {
    const styles = parseInlineStyles(match[1]);
    blocks.push({ type: "text", content: match[2], styles });
  }

  // Parse <p> elements
  while ((match = pRegex.exec(html)) !== null) {
    const styles = parseInlineStyles(match[1]);
    blocks.push({ type: "text", content: match[2], styles });
  }

  // Add line breaks for <br> tags
  const brCount = (html.match(/<br\s*\/?>/g) || []).length;
  for (let i = 0; i < brCount; i++) {
    blocks.push({ type: "lineBreak", content: "", styles: {} });
  }

  return blocks;
}

// Parse inline CSS styles
function parseInlineStyles(styleString): {
  fontSize?: number;
  color?: string;
  align?: string;
} {
  const styles: { fontSize?: number; color?: string; align?: string } = {};
  const stylePairs = styleString.split(";");
  stylePairs.forEach((pair) => {
    const [key, value] = pair.split(":").map((s) => s.trim());
    if (key && value) {
      if (key === "font-size") styles.fontSize = parseInt(value, 10);
      if (key === "color") styles.color = value;
      if (key === "text-align") styles.align = value;
    }
  });
  return styles;
}
