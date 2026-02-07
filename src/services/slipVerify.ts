import jsQR from "jsqr";
import sharp from "sharp";
import { parse as promptparse } from "promptparse";
import { config } from "../config";

export interface SlipVerifyResult {
  success: boolean;
  transRef?: string;
  date?: string;
  amount?: string;
  senderName?: string;
  receiverName?: string;
  error?: string;
}

/**
 * Verify a payment slip image:
 * 1. Download from Slack
 * 2. Decode with sharp to raw RGBA
 * 3. Extract QR with jsQR
 * 4. Parse with promptparse to get transRef
 * 5. POST to OpenSlipVerify API
 *
 * Returns null if verification should be skipped (no API key, not an image, etc.)
 */
export async function verifySlip(
  fileId: string,
  amount: number,
  client: any
): Promise<SlipVerifyResult | null> {
  if (!config.openSlipVerifyApiKey) {
    return null;
  }

  try {
    // 1. Download the slip image from Slack
    const info = await client.files.info({ file: fileId });
    const file = info.file as any;
    const downloadUrl = file?.url_private_download;

    if (!downloadUrl) return null;

    // Only process image files
    const imageTypes = ["png", "jpg", "jpeg", "gif", "bmp"];
    if (!imageTypes.includes(file.filetype)) {
      return null;
    }

    const token = (client as any).token as string;
    const imageBuffer = await downloadSlipImage(downloadUrl, token);

    if (!imageBuffer || imageBuffer.length === 0) return null;

    // 2. Decode to raw RGBA pixels using sharp
    const { data, info: imgInfo } = await sharp(imageBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // 3. Extract QR code with jsQR
    const qrResult = jsQR(
      new Uint8ClampedArray(data.buffer, data.byteOffset, data.length),
      imgInfo.width,
      imgInfo.height
    );

    if (!qrResult || !qrResult.data) {
      return { success: false, error: "No QR code found in slip image" };
    }

    // 4. Parse the QR data with promptparse to get the transaction ref
    const parsed = promptparse(qrResult.data, false, true);
    if (!parsed) {
      return { success: false, error: "Could not parse QR code data" };
    }

    // Extract transaction reference from the EMVCo QR
    // Tag 62 = Additional Data, Sub-tag 05 = Reference Label (transRef)
    const refTag = parsed.getTag("62", "05");
    const transRef = refTag?.value;

    if (!transRef) {
      return {
        success: false,
        error: "No transaction reference found in QR code",
      };
    }

    // 5. Call OpenSlipVerify API
    const apiResult = await callOpenSlipVerifyApi(
      transRef,
      amount.toFixed(2),
      config.openSlipVerifyApiKey
    );

    return apiResult;
  } catch (err) {
    console.error("[SlipVerify] Verification failed:", err);
    return {
      success: false,
      error: "Slip verification failed unexpectedly",
    };
  }
}

async function downloadSlipImage(
  url: string,
  token: string
): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "manual",
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return null;
      const nextRes = await fetch(location);
      if (!nextRes.ok) return null;
      return Buffer.from(await nextRes.arrayBuffer());
    }

    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function callOpenSlipVerifyApi(
  refNbr: string,
  amount: string,
  token: string
): Promise<SlipVerifyResult> {
  try {
    const res = await fetch("https://api.openslipverify.com/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refNbr, amount, token }),
    });

    if (!res.ok) {
      return {
        success: false,
        error: `API returned status ${res.status}`,
      };
    }

    const data = (await res.json()) as any;

    if (data.status === 200 && data.data) {
      return {
        success: true,
        transRef: data.data.transRef,
        date: data.data.date,
        amount: data.data.amount,
        senderName: data.data.sender?.name,
        receiverName: data.data.receiver?.name,
      };
    }

    return {
      success: false,
      error: data.message || "Verification failed",
    };
  } catch (err) {
    return {
      success: false,
      error: "Could not reach OpenSlipVerify API",
    };
  }
}
