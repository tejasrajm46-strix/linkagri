/**
 * Private file storage abstraction.
 *
 * Lab reports and crop-health images are PRIVATE farmer documents. Files are
 * stored under `.uploads/` (outside `public/`, so Next.js never serves them
 * statically) and are only ever delivered through the authorized download
 * endpoint (`/api/lab-reports/[id]/file`), which checks ownership first.
 *
 * The interface is intentionally small so a real backend (S3 / Cloudflare R2 /
 * Supabase Storage / any S3-compatible bucket) can replace the local disk
 * implementation without touching the routes: implement `saveBuffer`,
 * `readBuffer`, `deleteFile` and `fileExists` against the provider.
 *
 * Files are served only via signed/authorized routes — never placed in
 * `public/`.
 */

import { randomBytes } from "crypto";
import path from "path";
import fs from "fs";

const ROOT = path.join(process.cwd(), ".uploads");

function dirFor(kind: "lab-reports" | "crop-images"): string {
  return path.join(ROOT, kind);
}

/** Server-side generated storage name — never derived from the client filename. */
export function newStoredName(kind: "lab-reports" | "crop-images", ext: string): string {
  const safeExt = /^[a-z0-9]{1,8}$/i.test(ext) ? ext : "bin";
  return `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.${safeExt}`;
}

/** Resolve a stored name to an absolute path, rejecting any traversal attempt. */
function resolve(kind: "lab-reports" | "crop-images", storedName: string): string {
  const base = path.basename(storedName);
  if (base !== storedName || base.includes("..") || base.includes("/") || base.includes("\\")) {
    throw { status: 400, message: "Invalid file reference" };
  }
  return path.join(dirFor(kind), base);
}

export function saveBuffer(
  kind: "lab-reports" | "crop-images",
  storedName: string,
  data: Buffer
): void {
  const target = resolve(kind, storedName);
  fs.mkdirSync(dirFor(kind), { recursive: true });
  fs.writeFileSync(target, data);
}

export function readBuffer(kind: "lab-reports" | "crop-images", storedName: string): Buffer {
  const target = resolve(kind, storedName);
  return fs.readFileSync(target);
}

export function fileExists(kind: "lab-reports" | "crop-images", storedName: string): boolean {
  try {
    return fs.existsSync(resolve(kind, storedName));
  } catch {
    return false;
  }
}

export function deleteFile(kind: "lab-reports" | "crop-images", storedName: string): void {
  try {
    fs.unlinkSync(resolve(kind, storedName));
  } catch {
    // missing file is fine — row deletion still proceeds
  }
}

export const UPLOAD_DIR = ROOT;