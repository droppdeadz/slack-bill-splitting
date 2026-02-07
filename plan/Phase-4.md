# Phase 4: Bill Image Recognition — Detailed Plan

> Automatically read bills from uploaded images and pre-fill the create bill form. Currently, the bill owner must enter all details manually.

---

## The Problem Today

When creating a bill, the owner must **manually type everything**: bill name, each item name, each item's price. For a receipt with 10+ items, this is tedious and error-prone. Phase 4 solves this by letting users upload a receipt photo and having AI extract the data automatically.

---

## Constraint: Slack Modal Limitation

Slack's `file_input` element only gives you the uploaded file **after the modal is submitted** — you can't process it mid-modal. This means we need a **two-step flow** when an image is uploaded:

1. **Modal 1**: Upload the receipt image
2. **Process**: Download image → send to AI → extract items
3. **Modal 2**: Show pre-filled create form for user to review/edit

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
  c. Send the image to Claude Vision API with a structured prompt:
     "Extract all line items, their prices, and the restaurant/store name
      from this receipt. Return as JSON."
  d. Claude returns structured data, e.g.:
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

## Error / Edge Case Handling

| Scenario | Behavior |
|----------|----------|
| **AI can't read the receipt** (blurry, not a receipt, etc.) | Show an error modal: "Couldn't read the receipt. Please try a clearer photo or create manually." with a "Create Manually" button that opens the standard empty form |
| **Partial extraction** (some items unreadable) | Pre-fill what was extracted. User adds the rest manually |
| **Only total found, no items** | Pre-fill bill name + total amount, set split type to "Equal" |
| **Wrong file type** (PDF, video, etc.) | Validate file type before processing. Show error: "Please upload an image (JPEG, PNG, or HEIC)" |
| **AI API timeout or failure** | Show error modal with "Create Manually" fallback button |
| **User fills form manually AND uploads image** | Image takes priority — process image and open review modal. Preserve any participants the user selected |

---

## Technical Implementation

### New Files

| File | Purpose |
|------|---------|
| `src/services/receiptParser.ts` | Downloads image from Slack, sends to Claude Vision API, returns structured receipt data |

### Modified Files

| File | Changes |
|------|---------|
| `src/views/createBillModal.ts` | Add optional `file_input` block at the top of the modal |
| `src/commands/create.ts` | In submission handler: detect uploaded file → branch to image processing → open pre-filled review modal |
| `src/config.ts` | Add `ANTHROPIC_API_KEY` env var |

### New Dependencies

| Package | Purpose |
|---------|---------|
| `@anthropic-ai/sdk` | Claude API client for vision-based receipt parsing |

### New Environment Variable

```env
ANTHROPIC_API_KEY=sk-ant-...    # For receipt image parsing via Claude Vision
```

---

## AI Prompt Strategy

The Claude Vision prompt would be structured to return **consistent JSON**:

```
You are a receipt parser. Given a photo of a receipt or bill, extract:
1. store_name: The restaurant or store name
2. items: Array of { name, amount } for each line item
3. total: The total amount on the receipt

Return ONLY valid JSON. If you cannot read a field, omit it.
Amounts should be numbers (no currency symbols).
```

This handles Thai, English, and mixed-language receipts since Claude has strong multilingual support.

---

## What Stays Exactly The Same

- Manual bill creation (no image) — zero changes
- Everything after bill creation — item selection DMs, payment flow, reminders, etc.
- Database schema — no changes needed
- All existing action handlers

---

## Checklist

- [ ] Receipt/bill image upload in create modal — Add `file_input` to `buildCreateBillModal()`, optional field
- [ ] OCR / image parsing — New `receiptParser.ts` service using Claude Vision API to extract structured data from receipt photos
- [ ] Auto-fill bill form from parsed data — On submission with image: process → open new pre-filled modal → user reviews → submits into existing flow
