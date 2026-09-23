/**
 * Demo lab-report PDF generator (seed only).
 *
 * Produces a minimal valid text PDF (uncompressed content streams,
 * Helvetica) containing the demo report's values + reference ranges, so the
 * seeded LR-1001 report has a real, readable file and the AI analysis is
 * grounded in actual extracted text instead of metadata.
 */

export function makeDemoReportPdf(): Buffer {
  const lines = [
    "AGRILAB TESTING CENTER - PLANT DISEASE ANALYSIS",
    "Sample: Tomato leaves (cv. Arka Rakshak) | Sample ID: AG-T-8821",
    "Test Date: 2026-09-01 | Report No: AL-2026-0912",
    "",
    "Parameter            Result   Reference Range",
    "Soil pH              5.2      6.5 - 8.5",
    "Available Nitrogen (kg/ha)  98      120 - 180",
    "Phosphorus (kg/ha)   24       20 - 60",
    "Potassium (kg/ha)    150      100 - 250",
    "Leaf spot incidence (%)  35   0 - 10",
    "",
    "Remarks: Acidic soil; nitrogen below optimal. Fungal leaf spot suspected.",
  ];

  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const content =
    "BT /F1 12 Tf 50 760 Td " +
    lines.map((l, i) => `0 -${i ? 16 : 0} Td (${esc(l)}) Tj`).join(" ") +
    " ET";

  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
  ];

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += String(o).padStart(10, "0") + " 00000 n \n";
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}