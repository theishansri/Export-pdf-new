// import PDFDocument from "pdfkit";
// import sharp from "sharp"; // image processing library
// import { getDb } from "../index";
// import stream from "stream";
// import { LRUCache } from "lru-cache";

// // Create an in-memory cache for PDFs
// const pdfCache = new LRUCache<string, Buffer>({
//   max: 50, // Maximum number of cached PDFs
//   ttl: 1000 * 60 * 10, // Cache PDFs for 10 minutes
// });

// export default async function exportPdfKit(req, res) {
//   console.log("Received request to /export-pdfkit");
//   try {
//     const { charts } = req.body;
//     console.log("Received charts:", charts ? charts.length : 0);

//     const db = getDb();
//     const rows = (await db.collection("EXPORT_PDF").find({}).toArray()).sort(
//       (a, b) => a.id - b.id,
//     );

//     if (
//       (!charts || !Array.isArray(charts) || charts.length === 0) &&
//       (!rows || !Array.isArray(rows) || rows.length === 0)
//     ) {
//       return res
//         .status(400)
//         .json({ error: "No charts or table data provided" });
//     }

//     // Generate a unique cache key based on the request data
//     const cacheKey = JSON.stringify({ charts, rows });

//     // Check if the PDF is already cached
//     if (pdfCache.has(cacheKey)) {
//       console.log("Serving PDF from cache");
//       const cachedPdf = pdfCache.get(cacheKey);
//       if (cachedPdf) {
//         res.setHeader("Content-Type", "application/pdf");
//         res.setHeader(
//           "Content-Disposition",
//           'attachment; filename="cached-report.pdf"',
//         );
//         return res.send(cachedPdf);
//       }
//     }

//     const doc = new PDFDocument({ margin: 40, size: "A4" });

//     const passThroughStream = new stream.PassThrough();
//     const pdfBufferChunks: Buffer[] = []; // Collect PDF chunks for caching

//     res.setHeader("Content-Type", "application/pdf");
//     res.setHeader("Content-Disposition", 'attachment; filename="report.pdf"');
//     doc.pipe(passThroughStream);

//     // Collect the PDF data into a buffer
//     passThroughStream.on("data", (chunk) => pdfBufferChunks.push(chunk));

//     passThroughStream.pipe(res);

//     // === Add Header Text ===
//     // Top-left corner: "DH Measure Report"
//     doc.fontSize(14).fillColor("#666").text("dh Measurement report", 40, 20);

//     // Top-right corner: "dunnhumbymedia" with "media" in dark green
//     const text = "dunnhumbymedia";
//     const mediaIndex = text.indexOf("media");
//     const dunnhumbyText = text.slice(0, mediaIndex);
//     const mediaText = text.slice(mediaIndex);

//     const rightX = doc.page.width - 40; // Right margin
//     doc
//       .fontSize(20)
//       .fillColor("#666")
//       .text(dunnhumbyText, rightX, 20, { align: "right", continued: true })
//       .fillColor("#006400") // Dark green for "media"
//       .text(mediaText);

//     const pageWidth = doc.page.width;
//     const usableWidth =
//       pageWidth - doc.page.margins.left - doc.page.margins.right;
//     const rowHeight = 25;
//     const columnPadding = 5;

//     const columns = [
//       { header: "ID", key: "id", width: 50 },
//       { header: "Customer", key: "customer", width: 120 },
//       { header: "Email", key: "email", width: 200 },
//       { header: "Amount", key: "amount", width: 80 },
//       { header: "Status", key: "status", width: 80 },
//       { header: "Date", key: "date", width: 100 },
//     ];

//     // Dynamically adjust column widths to fit the usable width
//     const totalColumnWidth = columns.reduce((sum, col) => sum + col.width, 0);
//     const scaleFactor = usableWidth / totalColumnWidth;

//     const adjustedColumns = columns.map((col) => ({
//       ...col,
//       width: col.width * scaleFactor, // Scale each column width
//     }));

//     let y = 50;

//     // === 1. Add Charts ===
//     if (charts && charts.length > 0) {
//       for (const chart of charts) {
//         const base64Data = chart.replace(/^data:image\/\w+;base64,/, ""); // Remove base64 header
//         const imageBuffer = Buffer.from(base64Data, "base64");

//         try {
//           // Use sharp to get image metadata (dimensions)
//           const metadata = await sharp(imageBuffer).metadata();

//           console.log("Image Metadata:", metadata);

//           if (!metadata.width || !metadata.height) {
//             throw new Error("Invalid image dimensions");
//           }

//           const imageWidth = metadata.width;
//           const imageHeight = metadata.height;

//           // Ensure the image fits within the allowed space
//           const maxWidth = usableWidth;
//           const scale = maxWidth / imageWidth;
//           const scaledHeight = imageHeight * scale;

//           // Check if the image fits on the current page
//           if (y + scaledHeight > doc.page.height - 40) {
//             doc.addPage();
//             y = 50; // Reset y for the new page
//           }

//           // Convert WebP to PNG for PDFKit compatibility
//           const pngBuffer = await sharp(imageBuffer).png().toBuffer();

//           // Render the image
//           doc.image(pngBuffer, 40, y, { width: maxWidth });

//           y += scaledHeight + 20; // Update y for the next graph
//         } catch (error) {
//           console.error("Error rendering image:", error.message);
//           continue; // Skip this image and move to the next one
//         }
//       }
//     }

//     // Ensure enough space before drawing the table
//     if (y + rowHeight > doc.page.height - 40) {
//       doc.addPage();
//       y = 50; // Reset y for the new page
//     }

//     // === 2. Draw Table Header ===
//     const drawRow = (cells, yPos, isHeader = false, isEvenRow = false) => {
//       let x = 40;
//       cells.forEach((cell, i) => {
//         const width = adjustedColumns[i].width; // Use adjusted column width
//         const text = String(cell);

//         if (isHeader) {
//           doc.rect(x, yPos, width, rowHeight).fill("#f0f0f0").stroke();
//           doc
//             .fillColor("#666")
//             .fontSize(12)
//             .text(text, x + columnPadding, yPos + 7);
//         } else {
//           doc
//             .rect(x, yPos, width, rowHeight)
//             .fill(isEvenRow ? "#f9f9f9" : "#ffffff")
//             .stroke();

//           let textColor = "#000000";

//           if (adjustedColumns[i].key === "status") {
//             if (text.toLowerCase() === "pending") {
//               textColor = "#f59e0b"; // amber-600
//             } else if (text.toLowerCase() === "failed") {
//               textColor = "#dc2626"; // red-600
//             } else if (text.toLowerCase() === "paid") {
//               textColor = "#16a34a"; // green-600
//             }
//           } else if (adjustedColumns[i].key === "email") {
//             textColor = "#999999";
//           }

//           doc
//             .fillColor(textColor)
//             .fontSize(10)
//             .text(text, x + columnPadding, yPos + 7);
//         }

//         x += width;
//       });
//     };

//     // === 3. Draw Table Data ===
//     if (rows.length > 0) {
//       drawRow(
//         adjustedColumns.map((c) => c.header),
//         y,
//         true,
//       );
//       y += rowHeight;

//       for (let i = 0; i < rows.length; i++) {
//         const row = rows[i];
//         const values = adjustedColumns.map((c) => row[c.key]);

//         if (y + rowHeight > doc.page.height - 40) {
//           doc.addPage();
//           y = 50; // Reset y for the new page
//         }

//         drawRow(values, y, false, i % 2 === 0);
//         y += rowHeight;
//       }
//     }

//     doc.end();

//     // Cache the generated PDF
//     passThroughStream.on("end", () => {
//       const pdfBuffer = Buffer.concat(pdfBufferChunks);
//       pdfCache.set(cacheKey, pdfBuffer);
//     });
//   } catch (error) {
//     console.error("Error generating PDF with PDFKit:", error);
//     res.status(500).json({ error: "Failed to generate PDF" });
//   }
// }
