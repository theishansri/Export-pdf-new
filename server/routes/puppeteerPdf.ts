import { RequestHandler } from "express";
import { PDFGenerationRequest, PDFGenerationResponse } from "@shared/api";
import { browserPool } from "../utils/browser-pool";
import { pdfCache } from "../utils/pdf-cache";

/**
 * Generate PDF from HTML content using Puppeteer
 * This runs server-side to avoid blocking the client and provide optimal RUM scores
 */
export const generatePDF: RequestHandler = async (req, res) => {
  const startTime = Date.now();
  let page;

  try {
    const {
      html,
      css,
      title = "RUM Dashboard",
      format = "A4",
      orientation = "portrait",
      compress = true,
      quality = "high",
      cssOnly = false,
    } = req.body as PDFGenerationRequest;

    if (!html) {
      const errorResponse: PDFGenerationResponse = {
        success: false,
        error: "HTML content is required",
      };
      return res.status(400).json(errorResponse);
    }

    // Check cache first
    const cacheKey = pdfCache.generateKey(html, css, {
      format,
      orientation,
      compress,
      quality,
    });
    const cached = pdfCache.get(cacheKey);

    if (cached) {
      console.log(`Serving cached PDF in ${Date.now() - startTime}ms`);
      res.setHeader("Content-Type", cached.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${cached.filename}"`,
      );
      res.setHeader("Content-Length", cached.buffer.length);
      return res.send(cached.buffer);
    }

    console.log("Cache miss, generating new PDF...");
    console.log("Getting page from browser pool...");
    page = await browserPool.getPage();
    console.log(`Page acquired in ${Date.now() - startTime}ms`);

    try {
      // Prepare optimized CSS
      const optimizedCSS = css
        .replace(/\/\*[\s\S]*?\*\//g, "") // Remove comments
        .replace(/\s+/g, " ") // Compress whitespace
        .replace(/;\s*}/g, "}") // Remove unnecessary semicolons
        .replace(/{\s*/g, "{") // Remove space after {
        .replace(/;\s*/g, ";") // Compress around semicolons
        .trim();

      if (cssOnly) {
        console.log("CSS-only mode enabled, sending optimized CSS...");
        res.setHeader("Content-Type", "text/css");
        res.setHeader(
          "Content-Length",
          Buffer.byteLength(optimizedCSS, "utf-8"),
        );
        return res.send(optimizedCSS);
      }

      // Add a robust CSS style tag to force color for all elements
      const colorOverrideCss = `
        * {
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          background-color: inherit !important;
        }
          .grid {
          display: block !important;
          grid-template-columns: unset !important;
          gap: unset !important;
        }
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            box-shadow: none !important;
          }
          @page { margin: 0.3in; size: ${format}; }
        }
        .print\\:hidden { display: none !important; }
        img, svg { max-width: 100%; height: auto; }
        table { font-size: 11px; }
        .recharts-wrapper { transform: scale(1); }
      `;

      // Prepare the complete HTML document
      const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title>
<meta name="author" content="Your Author Name">
<meta name="description" content="Description of the document for accessibility">
<meta name="keywords" content="PDF, Accessibility, UA-PDF, Puppeteer">
<meta name="generator" content="Puppeteer PDF Generator">
<style>
${optimizedCSS}
${colorOverrideCss}
body {
  margin: 0;
  padding: 15px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
  line-height: 1.4;
}
  .grid {
  display: block !important;
}
  .text-muted-foreground{
  color: red !important;
  }
</style>
</head>
<body>${html}</body>
</html>`;

      // Set the HTML content with a longer timeout for complex pages
      await page.setContent(fullHtml, {
        waitUntil: "networkidle0", // Better for complex pages
        timeout: 30000,
      });
      console.log(`Content set in ${Date.now() - startTime}ms`);

      // Emulate the 'screen' media type to ensure color rendering, then wait
      await page.emulateMediaType("screen");
      await new Promise((resolve) => setTimeout(resolve, 500)); // A more generous wait for rendering

      console.log("Starting PDF generation...");
      const settings = {
        high: { scale: 1.0, margin: "15px" },
        medium: { scale: 0.85, margin: "10px" },
        low: { scale: 0.7, margin: "8px" },
      };
      const qualitySetting = settings[quality] || settings.medium;

      // Generate PDF with required options
      const pdfBuffer = await page.pdf({
        format: format as any,
        landscape: orientation === "landscape",
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
        margin: {
          top: qualitySetting.margin,
          right: qualitySetting.margin,
          bottom: qualitySetting.margin,
          left: qualitySetting.margin,
        },
        tagged: false,
        omitBackground: false,
        scale: compress ? qualitySetting.scale : 1.0,
      });

      await browserPool.releasePage(page);
      console.log(`PDF generated successfully in ${Date.now() - startTime}ms`);

      const contentType = "application/pdf";
      const filename = `${title.replace(/\s+/g, "_")}_${Date.now()}.pdf`;

      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.setHeader("Content-Length", pdfBuffer.length);

      pdfCache.set(cacheKey, {
        buffer: pdfBuffer,
        contentType,
        filename,
        timestamp: Date.now(),
      });

      res.send(pdfBuffer);
    } catch (pageError) {
      if (page) {
        await browserPool.releasePage(page);
      }
      throw pageError;
    }
  } catch (error) {
    console.error("PDF generation error:", error);
    console.log(`PDF generation failed in ${Date.now() - startTime}ms`);

    if (page) {
      try {
        await browserPool.releasePage(page);
      } catch (cleanupError) {
        console.error("Error during page cleanup:", cleanupError);
      }
    }

    const errorResponse: PDFGenerationResponse = {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error occurred during PDF generation",
    };

    res.status(500).json(errorResponse);
  }
};

/**
 * Health check endpoint for PDF service
 */
export const pdfHealthCheck: RequestHandler = async (req, res) => {
  try {
    await browserPool.initialize();
    res.json({
      success: true,
      message: "PDF service is healthy and optimized",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: "PDF service unavailable",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
