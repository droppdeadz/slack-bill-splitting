import generatePayload from "promptpay-qr";
import QRCode from "qrcode";

export async function generatePromptPayQr(
  promptpayId: string,
  amount?: number
): Promise<Buffer> {
  const payload = generatePayload(promptpayId, {
    ...(amount && amount > 0 ? { amount } : {}),
  });
  const buffer = await QRCode.toBuffer(payload, {
    type: "png",
    width: 300,
    margin: 2,
    errorCorrectionLevel: "M",
  });
  return buffer;
}
