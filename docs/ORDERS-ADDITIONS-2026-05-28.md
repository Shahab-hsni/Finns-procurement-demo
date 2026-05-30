# Orders Page — Additions (2026-05-28)

> Documents every feature added to the Orders page in this session.
> Two features shipped: **Autonomous Dispute Drafting** and **3-Way Match at Receiving**.
> All code lives in `src/components/NewOrdersPage.tsx`, `src/lib/sourceBridgeStore.ts`, and `src/lib/actionLog.ts`.

---

## 1. Autonomous Dispute Drafting

### What it does

When the receiving staff marks Stage 5 (Delivered & Checked) with a QC failure, **A-03 (Vendor Comms Agent) automatically drafts a WhatsApp dispute message** and loads it into the Source Bridge. The manager reviews, edits if needed, and sends with one click — or chooses to waive the dispute with a mandatory paper trail.

### Trigger

Stage 5 Task Module saved with `qc_outcome === 'fail'`. Both Auto and Manual mode orders trigger this path — it fires from `handleSaveStageModule` after `advance === true`.

### Flow

```
Stage 5 Task Module
  → QC outcome = fail
  → seedDisputeDraft(order, stageDraft)         ← seeds A-03 draft into Source Bridge thread
  → setBridgeTarget({ orderId, supplier, ... }) ← auto-opens Source Bridge in right panel
```

**Source Bridge footer when a `dispute-draft` message is present:**

| State | What the user sees |
|---|---|
| Draft present | Editable A-03 draft in amber-bordered card. Normal compose area replaced by two CTAs. |
| **Send Dispute via WhatsApp** | Primary green button. Converts draft to a sent `reply` in the thread. Logs `kind: 'po-dispute-send'`. |
| **Waive dispute — accept as-is** | Secondary text link. Opens the payment confirmation step in the footer. |

**Payment confirmation step (shown after "Waive dispute — accept as-is"):**

| Field | Rule |
|---|---|
| Reason for waiving dispute | **Required.** Mandatory textarea — Confirm Payment disabled until non-empty. Stored in `meta.waiveReason` on the action log. |
| Payment due by | **Required.** Date input, defaults to today + 7 days. Confirm Payment also disabled until set. |
| Notify supplier via WhatsApp | Toggle, default ON. Live-previews the Bahasa Indonesia payment notification. |
| **Cancel** | Returns to dispute draft CTAs without losing the draft. |
| **Confirm Payment** | Sends WhatsApp notification if toggle on. Removes `dispute-draft` from thread. Logs `kind: 'po-payment-approve'` with reason + due date in meta. Closes Source Bridge. |

### Dispute draft message format

Written in Bahasa Indonesia. Includes the receiver's name (from `stageDraft['receiver']`) and per-item variance detail when the 3-way match was filled in:

```
Pak/Ibu,

Mohon maaf, kami perlu melaporkan masalah terkait pesanan PO-XXXX yang diterima
hari ini oleh {receiver}.

Item bermasalah:
• Butter Anchor: dipesan 24 kg, diterima 20 kg (kurang 4.0 kg)   ← when 3-way match used
• Burrata 12 pcs                                                   ← plain text otherwise

Kondisi tidak memenuhi standar penerimaan kami. Mohon dikirimkan credit note
kepada tim Finn's Procurement.

Kami terbuka untuk koordinasi lebih lanjut via WhatsApp.

Terima kasih,
Finn's Procurement
```

### Data model changes

**`src/lib/sourceBridgeStore.ts`**

Added `'dispute-draft'` to `BridgeMessageKind`:

```ts
export type BridgeMessageKind =
  | 'inbound-quote' | 'reply' | 'po-sent' | 'dispatch-confirm' | 'delivery-confirm'
  | 'dispute-draft';   // ← new: A-03 auto-drafted dispute message, editable before send
```

**`src/lib/actionLog.ts`**

Added two new `ActionKind` values:

```ts
| 'po-dispute-send'    // admin sent the dispute draft via WhatsApp
| 'po-payment-approve' // admin waived the dispute and approved payment (with mandatory reason)
```

**`src/components/NewOrdersPage.tsx`**

New state:
```ts
const [disputeDraftEdits, setDisputeDraftEdits] = useState<Record<string, string>>({});
const [paymentConfirmActive,  setPaymentConfirmActive]  = useState(false);
const [paymentDueDate,        setPaymentDueDate]        = useState('');
const [paymentNotifyVendor,   setPaymentNotifyVendor]   = useState(true);
const [paymentWaiveReason,    setPaymentWaiveReason]    = useState('');
```

New helper (module-level, outside component):
```ts
function seedDisputeDraft(order: Order, stageDraft: Record<string, string>): void
```

Idempotent — won't duplicate if draft already exists in the thread.

### Reset behaviour

- `paymentConfirmActive` resets to `false` whenever `selectedOrder?.id` changes (via `useEffect`).
- `disputeDraftEdits` is keyed by `poId` — cleared on send or confirm payment.
- Source Bridge itself closes when a different order is selected (existing behaviour, unchanged).

---

## 2. 3-Way Match at Receiving

### What it does

The Stage 5 "Delivered & Checked" Task Module now shows a **per-line-item match table** before the standard form fields. For each item on the PO, the admin enters what was physically received and what the vendor's invoice says. The system computes variances live, colour-codes each row, auto-derives the overall QC outcome, and includes specific short-shipment details in the A-03 dispute draft.

### Where it renders

Inside the Stage 5 Task Module modal (Execute mode only — not in Review/History mode), injected as a new section **before** the existing POD upload / QC outcome / Receiving Staff fields.

The modal also widens from `max-w-lg` to `max-w-2xl` for Stage 5 to accommodate the table layout.

### Table columns

| Column | Source | Editable |
|---|---|---|
| **Item** | Parsed from `order.items[]` via `parseOrderItems()` | No |
| **PO Ordered** | Parsed qty + unit from the same item string | No (read-only reference) |
| **Received** | Admin input | Yes — `item_N_received_qty` in `stageDraft` |
| **Invoice Qty** | Admin input (from vendor's WhatsApp/email invoice) | Yes — `item_N_invoice_qty` in `stageDraft` |

### Colour coding

| Condition | Row colour | Badge |
|---|---|---|
| Received = Ordered | Green | ✓ match |
| Received < Ordered | Red | ▼ short X.X{unit} |
| Received > Ordered | Amber | ▲ excess X.X{unit} |
| Invoice qty ≠ Ordered | Red input | "invoice gap" |
| Nothing entered yet | Neutral | — |

### Auto-derived QC outcome

As the admin fills in received quantities, `qc_outcome` in `stageDraft` is set automatically:

| Line item results | Auto QC outcome |
|---|---|
| All received ≥ ordered | `pass` |
| Some match, some short | `conditional` |
| All short / none entered as 0 | `fail` |

The admin can **override** this at any time by clicking `pass`, `fail`, or `conditional` directly — the auto-derivation is advisory, not locked.

### Variance summary bar

Renders below the last item row when ≥1 received quantity has been entered:

```
1 matched · 1 short shipment · dispute draft will auto-generate on save
```

### Item parsing

`parseOrderItems(items: string[]): ParsedItem[]` — module-level helper that extracts structured data from the Order's flat `items: string[]`:

```ts
// Input:  "Butter Anchor 24kg · BC + RC"
// Output: { name: "Butter Anchor", qty: 24, unit: "kg", raw: "..." }

// Input:  "Bintang Beer cases · 90 BC · 54 SP"  ← no simple qty
// Output: { name: "Bintang Beer cases", qty: 0, unit: "", raw: "..." }
```

Regex: `/^(.*?)\s+(\d+(?:\.\d+)?)\s*(kg|L|pcs|btl|case|sack|units?)\b/i`

Items that don't match the regex (e.g. complex multi-venue quantity strings) fall back to name-only with `qty: 0` — they still render in the table but the variance calculation skips them.

### Data storage

Per-item data is stored in the existing `manualStageData[orderId][4]` flat record using indexed keys:

```
item_0_received_qty  → "20"
item_0_invoice_qty   → "24"
item_1_received_qty  → "12"
item_1_invoice_qty   → "12"
```

No new state shape required — uses the same `stageDraft` / `manualStageData` persistence already in place.

### Integration with dispute draft

`seedDisputeDraft()` reads the per-item received quantities from `stageDraft` when generating the WhatsApp message body. If `item_N_received_qty` is present and less than ordered qty:

```
• Butter Anchor: dipesan 24 kg, diterima 20 kg (kurang 4.0 kg)
```

If not filled in (3-way match skipped), falls back to plain item name:

```
• Butter Anchor 24 kg
```

---

## 3. Scenarios Verified (Playwright)

| Scenario | Result |
|---|---|
| QC fail → Source Bridge auto-opens with A-03 dispute draft | ✅ |
| Dispute draft includes per-item short shipment detail from 3-way match | ✅ |
| "Send Dispute via WhatsApp" converts draft to sent message, logs `po-dispute-send` | ✅ |
| "Waive dispute" with empty reason → Confirm Payment blocked | ✅ |
| "Waive dispute" with reason + date → confirms, logs `po-payment-approve` with `waiveReason` in meta | ✅ |
| All quantities match → QC auto-set to `pass`, no dispute draft | ✅ |
| Mixed results → QC auto-set to `conditional` | ✅ |
| Admin overrides auto-derived QC outcome to `fail` | ✅ |
| Short shipment → row turns red, variance badge shows exact deficit | ✅ |
| Full match → row turns green, badge shows ✓ match | ✅ |

---

## 4. What Remains (open gaps)

These were identified as out of scope for this session and remain in `REALISM-AUDIT.md`:

- **Per-item condition photo upload** — currently one POD photo for the whole PO. A production system needs one photo per line item or per failed item.
- **Partial payment tied to variance** — "Waive dispute" approves full invoice amount. Should allow partial payment matching only the items that passed QC.
- **`GoodsReceipt` entity** — the received quantities are stored in `manualStageData` (flat keys). A proper production system needs a `GoodsReceipt` record with its own lifecycle, linked to both the PO and the Invoice.
- **Invoice amount variance** — currently only captures invoice *quantity*. Price variance (invoiced unit price vs PO unit price) is not captured.
