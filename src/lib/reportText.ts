/**
 * Lab-report text extraction.
 *
 * PDFs: real text is extracted with pdf-parse (pure JS, offline — no API
 * key, no external service). Image uploads (JPG/PNG) have no OCR in this
 * build, so they return the honest `image` kind — the analyze route routes
 * those to an explicit "unable to reliably read this report" message rather
 * than guessing. A PDF with no extractable text (scanned / image-only)
 * returns the `pdf-no-text` kind with the same honest treatment.
 *
 * Whatever is extracted is treated as untrusted DATA by the AI engine — it
 * is never instructions.
 */

import type { PDFParse } from "pdf-parse";

export type ExtractedReportText = {
  /** Raw extracted text (may be empty). */
  text: string;
  /** Number of extractable characters (0 when nothing was readable). */
  chars: number;
  /** Where the text came from — drives the honest user-facing reason. */
  kind: "pdf-text" | "pdf-no-text" | "image" | "missing";
};

const PDF_MIME = "application/pdf";
const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/jpg"]);

/** Strip pdf-parse's "-- N of M --" page separators and normalize whitespace. */
function cleanText(raw: string): string {
  return raw
    .replace(/^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gm, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Real PDF text extraction — pure JS via pdf-parse (bundled pdf.js). */
async function extractPdfText(data: Buffer): Promise<string> {
  // Dynamic import keeps the CJS dependency out of the client bundle.
  const mod = (await import("pdf-parse")) as typeof import("pdf-parse");
  const parser = new mod.PDFParse({ data });
  const res = await parser.getText();
  return typeof res.text === "string" ? res.text : "";
}

export async function extractReportText(input: {
  data?: Buffer;
  mimeType: string;
}): Promise<ExtractedReportText> {
  const { data, mimeType } = input;

  if (!data || data.length === 0) {
    return { text: "", chars: 0, kind: "missing" };
  }
  if (IMAGE_MIME.has(mimeType.toLowerCase())) {
    // No OCR in this build — honest path, never guess from a picture.
    return { text: "", chars: 0, kind: "image" };
  }
  if (mimeType !== PDF_MIME) {
    return { text: "", chars: 0, kind: "missing" };
  }

  try {
    const text = cleanText(await extractPdfText(data));
    if (text.length === 0) {
      return { text: "", chars: 0, kind: "pdf-no-text" };
    }
    return { text, chars: text.length, kind: "pdf-text" };
  } catch {
    // Corrupt/encrypted/unreadable PDF — same honest treatment as scanned.
    return { text: "", chars: 0, kind: "pdf-no-text" };
  }
}