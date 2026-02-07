# Phase 4: Bill Image Recognition — Detailed Plan

> Automatically read bills from uploaded images and pre-fill the create bill form. Currently, the bill owner must enter all details manually.

---

## The Problem Today

When creating a bill, the owner must **manually type everything**: bill name, each item name, each item's price. For a receipt with 10+ items, this is tedious and error-prone. Phase 4 solves this by letting users upload a receipt photo and having OCR extract the data automatically.

---

## Constraint: Slack Modal Limitation

Slack's `file_input` element only gives you the uploaded file **after the modal is submitted** — you can't process it mid-modal. This means we need a **two-step flow** when an image is uploaded:

1. **Modal 1**: Upload the receipt image
2. **Process**: Download image → OCR with tesseract.js → parse text → extract items
3. **Modal 2**: Show pre-filled create form for user to review/edit

---

## Technology: tesseract.js

We use **tesseract.js** — a pure JavaScript OCR engine that runs locally in the Node.js process. No external API calls, no API keys, completely free.

| Aspect | Detail |
|--------|--------|
| **Package** | `tesseract.js` (npm) |
| **Cost** | Free — runs locally |
| **Languages** | English (`eng`) + Thai (`tha`) — loaded on first use, cached after |
| **How it works** | Downloads trained language data (~4MB per language) on first OCR call, then runs recognition locally |
| **Output** | Raw text string from the image |
| **Parsing** | We write a custom text parser with regex to extract item names and prices from the raw OCR text |

### Trade-off vs AI-based approach

tesseract.js gives **raw text** — not structured JSON. So we need a custom parser to extract items and prices. This works well for **clear, printed receipts** but may struggle with:
- Very blurry or low-quality photos
- Handwritten receipts
- Unusual receipt layouts

For most standard restaurant/store receipts (which are the primary use case), tesseract.js + regex parsing works well.

---

## User Flow — Detailed Step-by-Step

### Path A: No image (existing flow, unchanged)

```
User types /copter create
  → Modal opens (same as today, with a new optional file upload at top)
  → User ignores the upload field, fills form manually
  → Submits → bill created (no change to existing behavior)
```

### Path B: Receipt image uploaded

```
Step 1: User types /copter create
  → Modal opens with updated layout:
  ┌────────────────────────────────────────┐
  │  Create a Bill                          │
  │────────────────────────────────────────│
  │  📷 Receipt Image (optional)            │
  │  [Upload a file...]                     │
  │  hint: Upload a receipt photo to        │
  │  auto-fill items. Leave empty to        │
  │  enter manually.                        │
  │────────────────────────────────────────│
  │  Bill Name:    [________________]       │
  │  Split Type:   [Split Equally ▼]        │
  │  Total Amount: [________________]       │
  │  Participants: [Select users...]        │
  │────────────────────────────────────────│
  │  [Cancel]                [Create Bill]  │
  └────────────────────────────────────────┘

Step 2: User attaches a receipt photo AND clicks "Create Bill"
  → Modal submission handler receives:
    - file_ids[] from the file_input field
    - Any manually-filled fields (bill name, participants, etc.)
  → Handler detects a file was uploaded

Step 3: Bot processes the image
  a. Call Slack API `files.info` with the file_id to get download URL
  b. Download the image binary using the URL + bot token for auth
  c. Run tesseract.js OCR on the image buffer:
     - Languages: ['eng', 'tha'] (supports both English and Thai receipts)
     - Returns raw text string
  d. Parse the raw text with regex to extract structured data:
     - Look for lines matching "item name ... price" patterns
     - Detect total line (e.g., "Total", "รวม", "Grand Total")
     - Detect store name (typically first non-empty line)
  e. Parsed result:
     {
       "store_name": "Sushi Hiro",
       "items": [
         { "name": "Salmon Sushi", "amount": 350 },
         { "name": "Ramen", "amount": 280 },
         { "name": "Gyoza", "amount": 340 },
         { "name": "Green Tea x4", "amount": 350 }
       ],
       "total": 1320
     }

Step 4: Bot opens a NEW modal pre-filled with the extracted data
  → Uses `client.views.open()` (new modal, not update — original was already closed)
  → The review modal:
  ┌────────────────────────────────────────┐
  │  Review Scanned Bill                    │
  │────────────────────────────────────────│
  │  ℹ️ We extracted items from your        │
  │  receipt. Please review and edit.       │
  │────────────────────────────────────────│
  │  Bill Name: [Sushi Hiro___________]     │
  │  Split Type: [Item-based ▼]             │
  │  Items:                                 │
  │  ┌──────────────────────────────────┐   │
  │  │ Salmon Sushi 350                │   │
  │  │ Ramen 280                       │   │
  │  │ Gyoza 340                       │   │
  │  │ Green Tea x4 350               │   │
  │  └──────────────────────────────────┘   │
  │  Participants: [Select users...]        │
  │────────────────────────────────────────│
  │  [Cancel]                [Create Bill]  │
  └────────────────────────────────────────┘

  → Bill name pre-filled from store_name
  → Split type auto-set to "Item-based" (since we have items)
  → Items textarea pre-filled with extracted items in "Name Amount" format
  → Participants preserved from step 2 if user had selected any

Step 5: User reviews, edits if needed, adds participants, submits
  → This submission hits the EXISTING create_bill_modal handler
  → Flows into existing handleItemSplit() or handleEqualSplit()
  → Bill is created as normal
```

---

## Text Parsing Strategy

Since tesseract.js returns raw text, we need a parser to extract structured receipt data. The parser uses a multi-step approach:

### 1. Store Name Extraction
- Take the first 1-3 non-empty lines of the receipt text
- These typically contain the store/restaurant name
- Skip lines that look like addresses, phone numbers, or dates

### 2. Item + Price Extraction
- Scan each line for a pattern: `text followed by a number`
- Common patterns:
  - `Salmon Sushi          350.00`
  - `Salmon Sushi ฿350`
  - `1x Salmon Sushi  350`
  - `Salmon Sushi    350.00 B`
- Regex: `/^(.+?)\s+(฿?\s*[\d,]+\.?\d*)\s*$/`
- Filter out non-item lines (subtotals, tax, service charge, etc.)

### 3. Total Extraction
- Look for lines containing keywords: `Total`, `Grand Total`, `รวม`, `ยอดรวม`, `รวมทั้งสิ้น`, `Net`, `Amount Due`
- Extract the number from that line

### 4. Cleanup
- Remove currency symbols and commas from amounts
- Parse amounts to numbers
- Filter out items with zero or negative amounts
- Deduplicate obvious duplicates

This approach handles most standard Thai and English printed receipts. Users can always edit the extracted data in the review modal.

---

## Error / Edge Case Handling

| Scenario | Behavior |
|----------|----------|
| **OCR can't read the receipt** (blurry, too dark, etc.) | Show an error modal: "Couldn't read the receipt. Please try a clearer photo or create manually." with a "Create Manually" button that opens the standard empty form |
| **Partial extraction** (some items unreadable) | Pre-fill what was extracted. User adds the rest manually |
| **Only total found, no items** | Pre-fill bill name + total amount, set split type to "Equal" |
| **No items and no total found** | Show error modal with "Create Manually" fallback |
| **Wrong file type** (PDF, video, etc.) | Validate file type before processing. Show error: "Please upload an image (JPEG, PNG, or HEIC)" |
| **OCR timeout** (very large image) | Set a timeout (30s). On timeout, show error modal with "Create Manually" fallback |
| **User fills form manually AND uploads image** | Image takes priority — process image and open review modal. Preserve any participants the user selected |
| **First-time language data download** | tesseract.js downloads ~4MB per language on first use. This is cached for subsequent calls. May add 5-10s to the first OCR request |

---

## Technical Implementation

### New Files

| File | Purpose |
|------|---------|
| `src/services/receiptOcr.ts` | Runs tesseract.js OCR on an image buffer, returns raw text |
| `src/services/receiptParser.ts` | Parses raw OCR text into structured receipt data (store name, items, total) using regex |

### Modified Files

| File | Changes |
|------|---------|
| `src/views/createBillModal.ts` | Add optional `file_input` block at the top of the modal |
| `src/commands/create.ts` | In submission handler: detect uploaded file → branch to image processing → open pre-filled review modal |

### New Dependencies

| Package | Purpose |
|---------|---------|
| `tesseract.js` | Local OCR engine — extracts text from receipt images. Free, no API key needed |

### No New Environment Variables

Unlike the previous AI-based approach, tesseract.js runs locally and requires **no API key or configuration**. Zero additional setup.

---

## What Stays Exactly The Same

- Manual bill creation (no image) — zero changes
- Everything after bill creation — item selection DMs, payment flow, reminders, etc.
- Database schema — no changes needed
- All existing action handlers
- Environment variables — no changes
- Slack app scopes — `files:read` is already configured

---

## Checklist

- [ ] Receipt/bill image upload in create modal — Add `file_input` to `buildCreateBillModal()`, optional field
- [ ] OCR service — New `receiptOcr.ts` using tesseract.js to extract raw text from receipt images (English + Thai)
- [ ] Receipt text parser — New `receiptParser.ts` to parse raw OCR text into structured data (store name, items with amounts, total) using regex
- [ ] Auto-fill bill form from parsed data — On submission with image: process → open new pre-filled modal → user reviews → submits into existing flow
