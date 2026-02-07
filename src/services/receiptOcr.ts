import type { AllMiddlewareArgs } from "@slack/bolt";
import { createWorker } from "tesseract.js";

export interface OcrResult {
  text: string;
  confidence: number;
}

export class MissingScopeError extends Error {
  constructor() {
    super(
      "The Slack app is missing the `files:read` scope. " +
        "Add it in your Slack App settings under OAuth & Permissions, then reinstall the app."
    );
    this.name = "MissingScopeError";
  }
}

const OCR_TIMEOUT_MS = 30_000;

// Magic bytes for image formats that tesseract (leptonica) supports
const IMAGE_MAGIC: number[][] = [
  [0x89, 0x50, 0x4e, 0x47], // PNG
  [0xff, 0xd8, 0xff],       // JPEG
  [0x42, 0x4d],             // BMP
  [0x47, 0x49, 0x46],       // GIF
  [0x49, 0x49, 0x2a, 0x00], // TIFF (LE)
  [0x4d, 0x4d, 0x00, 0x2a], // TIFF (BE)
];

function isRecognizedImage(buf: Buffer): boolean {
  return IMAGE_MAGIC.some((sig) =>
    sig.every((byte, i) => buf[i] === byte)
  );
}

/**
 * Download a Slack-hosted image via the Slack API and run OCR on it.
 * Uses client.files.info() so the proper scope error is surfaced.
 */
export async function recognizeReceipt(
  fileId: string,
  client: AllMiddlewareArgs["client"]
): Promise<OcrResult> {
  // 1. Get file info via Slack API (requires files:read scope)
  let downloadUrl: string;
  try {
    const info = await client.files.info({ file: fileId });
    const fileInfo = info.file as Record<string, unknown> | undefined;
    downloadUrl = fileInfo?.url_private_download as string;
    if (!downloadUrl) {
      throw new Error("No download URL in file info");
    }
  } catch (err: unknown) {
    const slackError = err as { data?: { error?: string }; message?: string };
    if (slackError?.data?.error === "missing_scope" || slackError?.message?.includes("missing_scope")) {
      throw new MissingScopeError();
    }
    throw err;
  }

  // 2. Download with manual redirect handling.
  //    Node fetch strips the Authorization header on cross-origin redirects,
  //    so we follow redirects ourselves.
  const token = (client as unknown as { token?: string }).token ?? "";
  const buffer = await downloadWithRedirects(downloadUrl, token);

  if (buffer.length === 0) {
    throw new Error("Downloaded file is empty");
  }

  // 3. Validate image format before sending to tesseract.
  //    Tesseract's leptonica throws an unhandled worker error on unknown formats
  //    that crashes the process, so we must reject early.
  if (!isRecognizedImage(buffer)) {
    throw new Error(
      "Unsupported image format. Tesseract requires PNG, JPEG, BMP, GIF, or TIFF."
    );
  }

  // 4. Run OCR with a timeout
  const ocrPromise = runOcr(buffer);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("OCR timed out")), OCR_TIMEOUT_MS)
  );

  return Promise.race([ocrPromise, timeoutPromise]);
}

/**
 * Fetch a Slack private URL, following redirects manually so the
 * Authorization header isn't stripped on cross-origin hops.
 */
async function downloadWithRedirects(
  url: string,
  token: string,
  maxRedirects = 5
): Promise<Buffer> {
  let currentUrl = url;
  let useAuth = true;

  for (let i = 0; i < maxRedirects; i++) {
    const headers: Record<string, string> = {};
    if (useAuth) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(currentUrl, { headers, redirect: "manual" });

    // Follow redirect — update URL and loop again
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("Redirect without Location header");
      currentUrl = location;
      useAuth = false; // Redirect targets (e.g. S3 signed URLs) don't need auth
      continue;
    }

    if (!res.ok) {
      throw new Error(`Failed to download image: ${res.status}`);
    }

    // Got a 200 — check it's actually image bytes, not an HTML login page
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) {
      throw new MissingScopeError();
    }

    return Buffer.from(await res.arrayBuffer());
  }

  throw new Error("Too many redirects while downloading image");
}

async function runOcr(imageBuffer: Buffer): Promise<OcrResult> {
  const worker = await createWorker("eng+tha");
  try {
    const {
      data: { text, confidence },
    } = await worker.recognize(imageBuffer);
    return { text: cleanThaiSpacing(text), confidence };
  } finally {
    await worker.terminate();
  }
}

/**
 * Tesseract inserts spaces between every Thai character and around punctuation.
 * e.g. "ข้ า ว ร า ด ไข ่ เจ ี ย ว (ป ู )" → "ข้าวราดไข่เจียว(ปู)"
 *
 * Remove whitespace between Thai characters (U+0E00–U+0E7F) and common
 * punctuation that appears inside Thai text (parentheses, comma, slash, etc.).
 */
function cleanThaiSpacing(text: string): string {
  return text.replaceAll(
    /(?<=[\p{Script=Thai}(),./:])\s+(?=[\p{Script=Thai}(),./:])/gu,
    ""
  );
}
