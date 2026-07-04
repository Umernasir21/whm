# Requirements Traceability — WMS Document vs. Implementation

Every requirement from the uploaded *WMS Development Requirements* PDF (Feature Summary §2, figures, and Development Checklist §6), mapped to the actual code with an honest status.

**Legend:** ✅ done & verified · 🟡 backend done, UI partial · ⬜ not started
Verification = live-tested via HTTP against the running API (see [`GAP_ANALYSIS.md`](GAP_ANALYSIS.md) §4).

---

## The document's 9 checklist items (§6)

| # | Requirement (doc) | Figure | Backend | Frontend | Verified | Status |
|---|---|---|---|---|---|---|
| 1 | **Sales Order Grid** — primary + extended views | 1, 2 | ✅ create/list/totals + cost basis | ✅ list + create drawer with **all Fig-1 fields** (Resource/Order ID/Alt ID/Payment Date, per-line Ds/Rg, PO Before/After Tax, Profit) | ✅ SO-00003, PO totals arithmetic-checked | ✅ |
| 2 | **Customer Detail Form** — search, select, submit | 3, 4, 5 | ✅ full field set | ✅ search+attach **and inline "Add Customer" (+) modal** | ✅ create + attach | ✅ |
| 3 | **Auto SO Numbering** — `SO-00001` | 6 | ✅ `SequenceService` (gapless, race-safe) | ✅ shown in grid | ✅ SO-00001 | ✅ |
| 4 | **Sales Order Search** — search-by-SO# grid | 7 | ✅ SO#/customer/status/type/date + **payment method, resource, tracking status, RMA** | ✅ filter bar incl. payment method + tracking status | ✅ index filters | ✅ |
| 5 | **Invoice Template** — professional, branded | 9 | ✅ DomPDF, ship-from, Bill-To/From | ✅ "Generate Invoice" button | ✅ INV-00001 | ✅ |
| 6 | **Edit Sales Order** — carrier + status, auto-save | 8 | ✅ carrier/tracking/status + auto timestamps | ✅ edit drawer | ✅ DHL / shipped | ✅ |
| 7 | **Ship-From Address** — default on shipping labels | 9, §3.7 | ✅ Richmond, TX default + **shipping-label PDF** | ✅ "Print Label" button (4×6 PDF) | ✅ label HTTP 200, valid PDF | ✅ |
| 8 | **Purchase Order Grid** — product, condition, qty, tax, cost | 10 | ✅ create + items + totals + receiving | ✅ **PO create grid** with PO Before/After Tax | ✅ PO-00002 = $295.40 | ✅ |
| 9 | **Total Profit Report** — summary display | 11 | ✅ `ProfitService` + report + dashboard + per-order profit | ✅ dashboard KPI + SO form profit | ✅ profit endpoint | ✅ |

**Score: 9 / 9 requirements ✅ done and live-verified.** All four ambiguities resolved (per-line Ds/Rg, shipping-label PDF, PO Before/After Tax on the SO form, all UI gaps closed).

---

## Field-level check against the figures

**Sales Order form (Fig 1–2)** — backend and create drawer now collect every field:
| Field (doc) | Backend | Create drawer |
|---|---|---|
| Customer * | ✅ | ✅ (search + attach + inline add) |
| Resource / Resource Order ID / Alternate ID | ✅ | ✅ |
| Payment Method / Transaction ID / Payment Comment | ✅ | ✅ |
| Payment Date | ✅ | ✅ |
| Tax Amount / Shipping Amount / Buy Tax | ✅ | ✅ |
| Line: Product, Condition, Quantity, Unit Cost, Total | ✅ | ✅ (with product search) |
| Line: Type (Ds / Rg) | ✅ `line_type` | ✅ **per-line toggle** |
| Totals: Product Total, Shipping, Tax | ✅ | ✅ |
| Totals: **PO Before Tax / PO After Tax / Profit** | ✅ | ✅ **shown on form** |

**Customer form (Fig 3)** — all fields validated in `StoreCustomerRequest`: first/last/complete name, company, email, phone, buyer ID, shipping name/addr1/addr2/city/state/zip/country. ✅ backend-complete; the modal UI is the only missing piece.

**Invoice (Fig 9)** — Bill-To, From (ship-from Richmond TX), line items (desc/condition/qty/price/total), subtotal/shipping/tax/total, branded header. ✅ matches.

---

## Ambiguities — RESOLVED (owner decisions applied)

> All four were confirmed by the product owner and implemented: (1) PO Before/After Tax **shown on the SO form**; (2) **separate shipping-label PDF** built; (3) Ds/Rg is **per line item**; (4) Resource/Order-ID fields remain free-text marketplace inputs. Original questions kept below for the record.


1. **"PO Before Tax / PO After Tax" on the Sales Order totals (Fig 1–2).** On a *sales* order this most likely means the **purchase cost basis** used to compute profit (PO = purchase order cost), not the sale price. Current build computes profit via `ProfitService` from item cost vs. sale. **Confirm:** should these two figures appear as line items on the SO form itself?

2. **"Ship-From Address: default address on shipping labels" (§3.7, checklist).** The doc specifies an invoice (Fig 9) but **no separate shipping-label document**. The ship-from address is applied to the shipment and printed on the invoice. **Confirm:** is a distinct printable **shipping label** PDF required, or is the address on the invoice/shipment sufficient?

3. **Line "Type: Ds / Rg" (Fig 1).** Dropship vs. Regular — is this **per line item** (as the radio in Fig 1 suggests) or **per order** (the Dropship/Regular tabs in Fig 7 suggest order-level)? Backend supports both; UI currently treats it per-order.

4. **Resource / Resource Order ID / Portal (Fig 1, Fig 7).** These read as marketplace-integration fields (the screenshots show Whatnot/Kohl's tabs). Their validation/lookup semantics aren't defined in the doc — currently free-text. **Confirm** expected behavior if they should be constrained.

---

## Document parity — COMPLETE ✅

All previously-open items are now built and live-verified:
1. ✅ Resource / Resource Order ID / Alternate ID / Payment Date + per-line Ds/Rg on the SO drawer.
2. ✅ Inline "Add Customer" modal (Fig 3) in the SO flow.
3. ✅ Purchase Order create grid (Fig 10) with PO Before/After Tax.
4. ✅ Extended SO search filters (payment method, tracking status, resource, RMA).
5. ✅ Shipping-label PDF (4×6, ship-from/ship-to/carrier/tracking/barcode).

**Verified end-to-end (2026-07-04):** `migrate:fresh --seed` (7 migrations) then live HTTP — SO with cost basis (Product Total $339.94, PO Before $112.80, PO After $115.80, **Profit $227.14**, per-line `rg,ds`), label PDF (HTTP 200, valid PDF), PO-00002 ($295.40). Frontend `tsc --noEmit` clean.
