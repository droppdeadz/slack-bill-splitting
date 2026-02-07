export interface ParsedReceipt {
  storeName: string | null;
  items: { name: string; amount: number }[];
  total: number | null;
}

// Lines that look like totals / subtotals — skip these from items.
// Uses (?:^|\s|$) instead of \b because \b doesn't work with Thai characters.
const TOTAL_KEYWORDS =
  /(?:^|\s)(total|grand\s*total|subtotal|sub\s*total|tax|vat|service\s*charge|discount)(?:\s|$)|(?:รวม|ยอดรวม|รวมทั้งสิ้น|ทั้งหมด|ภาษี|ส่วนลด|ค่าบริการ)/i;

// Lines that are clearly not a store name
const NOT_STORE_NAME =
  /^(\+?\d[\d\s\-]{6,}|TAX\s*ID|เลขประจำตัว|วันที่|\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}|.*\d{10,})/i;

// Pattern: name followed by a price at end of line
const ITEM_LINE =
  /^(.+?)\s+(?:฿\s*)?([\d,]+\.?\d{0,2})\s*$/;

// Total line detection — match the LAST number on a total-keyword line
// (receipts often have a quantity column between the keyword and the amount)
const TOTAL_LINE =
  /(?:total|grand\s*total|รวม|ยอดรวม|รวมทั้งสิ้น|ทั้งหมด).*?(?:฿\s*)?([\d,]+\.?\d{0,2})\s*$/i;

/**
 * Parse raw OCR text into structured receipt data.
 */
export function parseReceiptText(rawText: string): ParsedReceipt {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const storeName = detectStoreName(lines);
  const total = detectTotal(lines);
  const items = extractItems(lines);

  return { storeName, items, total };
}

function detectStoreName(lines: string[]): string | null {
  for (const line of lines) {
    if (NOT_STORE_NAME.test(line)) continue;
    if (TOTAL_KEYWORDS.test(line)) continue;
    // Skip lines that are just numbers / prices
    if (/^[\d,.\s฿$]+$/.test(line)) continue;
    // Must have at least 2 non-whitespace chars
    if (line.replaceAll(/\s/g, "").length < 2) continue;
    return line;
  }
  return null;
}

function detectTotal(lines: string[]): number | null {
  // Walk backwards — the last total-like line is usually the grand total
  for (let i = lines.length - 1; i >= 0; i--) {
    const match = TOTAL_LINE.exec(lines[i]);
    if (match) {
      const val = Number.parseFloat(match[1].replaceAll(",", ""));
      if (!Number.isNaN(val) && val > 0) return val;
    }
  }
  return null;
}

function extractItems(lines: string[]): { name: string; amount: number }[] {
  const items: { name: string; amount: number }[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    // Skip total / tax / service charge lines
    if (TOTAL_KEYWORDS.test(line)) continue;

    const match = ITEM_LINE.exec(line);
    if (!match) continue;

    const name = match[1].trim();
    const amount = Number.parseFloat(match[2].replaceAll(",", ""));

    if (!name || Number.isNaN(amount) || amount <= 0) continue;

    // Deduplicate by "name|amount"
    const key = `${name.toLowerCase()}|${amount}`;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({ name, amount });
  }

  return items;
}
