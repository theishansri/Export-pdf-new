import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

self.onmessage = async (event) => {
  const { charts, rows } = event.data;

  try {
    const pdf = new jsPDF("p", "pt", "a4");
    let yOffset = 20;

    // === 1. Add Charts ===
    for (const chart of charts) {
      const imgProps = pdf.getImageProperties(chart);
      const pdfWidth = pdf.internal.pageSize.getWidth() - 40;
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      if (yOffset + pdfHeight > pdf.internal.pageSize.getHeight() - 20) {
        pdf.addPage();
        yOffset = 20;
      }

      pdf.addImage(chart, "PNG", 20, yOffset, pdfWidth, pdfHeight);
      yOffset += pdfHeight + 20;
    }

    // === 2. Add Table ===
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      const body = rows.map((row) => headers.map((key) => row[key]));

      autoTable(pdf, {
        head: [headers],
        body: body,
        startY: yOffset,
        styles: { fontSize: 9, cellPadding: 4 },
        margin: { left: 20, right: 20 },
        theme: "grid",
      });
    }

    // Send the generated PDF back to the main thread
    const pdfBlob = pdf.output("blob");
    self.postMessage({ success: true, pdfBlob });
  } catch (error) {
    self.postMessage({ success: false, error: error.message });
  }
};
