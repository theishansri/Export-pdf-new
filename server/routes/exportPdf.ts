import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { getDb } from "../index";

export default async function exportPdf(req, res) {
  try {
    const { charts } = req.body;

    const db = getDb();
    console.log("Connected to database:", db.databaseName);
    const rows = await db.collection("EXPORT_PDF").find({}).toArray();
    // console.log(rows, rowsdb);
    if (
      (!charts || !Array.isArray(charts) || charts.length === 0) &&
      (!rows || !Array.isArray(rows) || rows.length === 0)
    ) {
      return res
        .status(400)
        .json({ error: "No charts or table data provided" });
    }

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const pageWidth = 800;
    const pageHeight = 1000;
    const margin = 40;
    const rowHeight = 25;
    const fontSize = 10;
    const headerFontSize = 12;
    const columnPadding = 5;

    const columns = [
      { header: "ID", key: "id", width: 50 },
      { header: "Customer", key: "customer", width: 120 },
      { header: "Email", key: "email", width: 200 },
      { header: "Amount", key: "amount", width: 80 },
      { header: "Status", key: "status", width: 80 },
      { header: "Date", key: "date", width: 100 },
    ];

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    // === 1. Add Charts ===
    if (charts && Array.isArray(charts) && charts.length > 0) {
      for (const chart of charts) {
        const base64Data = chart.replace(/^data:image\/\w+;base64,/, "");
        const pngBytes = Uint8Array.from(Buffer.from(base64Data, "base64"));
        const pngImage = await pdfDoc.embedPng(pngBytes);

        const imageWidth = pageWidth - 2 * margin;
        const imageHeight = (pngImage.height * imageWidth) / pngImage.width;

        if (y - imageHeight < margin) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }

        page.drawImage(pngImage, {
          x: margin,
          y: y - imageHeight,
          width: imageWidth,
          height: imageHeight,
        });

        y -= imageHeight + 20;
      }
    }

    // === 2. Add Table ===
    if (rows && Array.isArray(rows) && rows.length > 0) {
      let isHeaderDrawn = false;

      for (const row of rows) {
        if (y < margin + rowHeight) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }

        // Draw the header only once at the top of the table
        if (!isHeaderDrawn) {
          drawRow(
            columns.map((c) => c.header),
            y,
            true,
          );
          y -= rowHeight;
          isHeaderDrawn = true;
        }

        // Draw the row
        drawRow(
          columns.map((c) => row[c.key]),
          y,
        );
        y -= rowHeight;
      }
    }

    function drawRow(cells, yPos, isHeader = false) {
      let x = margin;
      cells.forEach((cell, i) => {
        const text = String(cell);
        const columnWidth = columns[i].width;

        // Style for headers
        if (isHeader) {
          page.drawRectangle({
            x,
            y: yPos - rowHeight,
            width: columnWidth,
            height: rowHeight,
            color: rgb(0.94, 0.94, 0.94), // Tailwind `bg-muted` (light muted gray)
          });
          page.drawText(text, {
            x: x + columnPadding,
            y: yPos - rowHeight + columnPadding,
            size: headerFontSize,
            font,
            color: rgb(0.4, 0.4, 0.4), // Tailwind `text-muted-foreground` (muted gray)
          });
        } else {
          // Style for rows
          const isEvenRow = Math.floor((yPos / rowHeight) % 2) === 0;

          // Background color for rows
          page.drawRectangle({
            x,
            y: yPos - rowHeight,
            width: columnWidth,
            height: rowHeight,
            color: isEvenRow ? rgb(1, 1, 1) : rgb(0.94, 0.94, 0.94), // Even: white, Odd: bg-muted/30
            opacity: isEvenRow ? 1 : 0.3,
          });

          // Conditional text color for specific columns
          let textColor = rgb(0, 0, 0); // Default black text
          if (columns[i].key === "status") {
            if (text.toLowerCase() === "pending") {
              textColor = rgb(0.98, 0.65, 0.22); // Tailwind `text-amber-600`
            } else if (text.toLowerCase() === "failed") {
              textColor = rgb(0.91, 0.11, 0.11); // Tailwind `text-red-600`
            } else if (text.toLowerCase() === "paid") {
              textColor = rgb(0.2, 0.8, 0.2); // Tailwind `text-green-600`
            }
          } else if (columns[i].key === "email") {
            textColor = rgb(0.6, 0.6, 0.6); // Tailwind `text-muted-foreground`
          }

          // Draw text
          page.drawText(text, {
            x: x + columnPadding,
            y: yPos - rowHeight + columnPadding,
            size: fontSize,
            font,
            color: textColor,
          });
        }

        x += columnWidth;
      });
    }

    const pdfBytes = await pdfDoc.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="report.pdf"');
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error("Error generating PDF:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
}
