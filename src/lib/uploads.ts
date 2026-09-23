/**
 * Server-side upload validation — the client's checks are never trusted.
 *
 * Validates declared MIME type, file-signature (magic bytes) and size. Only
 * PDF / JPEG / PNG are accepted for lab reports; re-encoding or anti-malware
 * scanning would hook in here when production infrastructure provides it.
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

type Allowed = { mime: string; ext: string; magic: (b: Buffer) => boolean };

const ALLOWED: Allowed[] = [
  {
    mime: "application/pdf",
    ext: "pdf",
    magic: (b) => b.length >= 5 && b.subarray(0, 5).toString("latin1") === "%PDF-",
  },
  {
    mime: "image/jpeg",
    ext: "jpg",
    magic: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/png",
    ext: "png",
    magic: (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
];

export type ValidatedFile = {
  mime: string;
  ext: string;
  size: number;
  data: Buffer;
};

/**
 * Throws an HttpError-shaped object with a friendly message on any
 * validation failure.
 */
export function validateUpload(file: { name: string; type: string; size: number; data: Buffer }): ValidatedFile {
  if (file.size <= 0) {
    throw { status: 400, message: "The uploaded file is empty. Please choose a non-empty file." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw { status: 413, message: "File too large — maximum size is 5 MB. Please compress or split the file." };
  }
  const declared = (file.type ?? "").toLowerCase();
  const match = ALLOWED.find((a) => a.mime === declared);
  if (!match) {
    throw {
      status: 415,
      message: "Unsupported file type. Only PDF, JPG and PNG reports are accepted.",
    };
  }
  if (!match.magic(file.data)) {
    throw {
      status: 415,
      message: "The file does not match its declared type. Please upload a valid PDF, JPG or PNG.",
    };
  }
  return { mime: match.mime, ext: match.ext, size: file.size, data: file.data };
}

export function contentTypeFor(mime: string): string {
  return mime;
}