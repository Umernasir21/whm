<?php

namespace App\Services;

use App\Models\PoReceipt;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class PurchaseOrderService
{
    public function __construct(
        private SequenceService $sequences,
        private ActivityLogger $log,
        private InventoryService $inventory,
    ) {}

    public function create(array $data): PurchaseOrder
    {
        return DB::transaction(function () use ($data) {
            $subtotal = 0.0;
            $taxTotal = 0.0;
            foreach ($data['items'] as $item) {
                $qty = (int) ($item['quantity'] ?? 1);
                $unit = (float) ($item['unit_cost'] ?? 0);
                $subtotal += $qty * $unit;
                $taxTotal += (float) ($item['tax'] ?? 0);
            }
            $grand = round($subtotal + $taxTotal, 2);

            $po = PurchaseOrder::create([
                'po_number' => $this->sequences->next('purchase_order'),
                'vendor_id' => $data['vendor_id'] ?? null,
                'status' => $data['status'] ?? 'draft',
                'subtotal_cents' => round($subtotal, 2),
                'tax_cents' => $taxTotal,
                'grand_total_cents' => $grand,
                'ordered_date' => $data['ordered_date'] ?? null,
                'created_by' => Auth::id(),
            ]);

            foreach ($data['items'] as $item) {
                $qty = (int) ($item['quantity'] ?? 1);
                $unit = (float) ($item['unit_cost'] ?? 0);
                $tax = (float) ($item['tax'] ?? 0);
                $po->items()->create([
                    'product_id' => $item['product_id'] ?? null,
                    'product_name' => $item['product_name'],
                    'condition' => $item['condition'] ?? 'new',
                    'quantity' => $qty,
                    'unit_cost_cents' => $unit,
                    'tax_cents' => $tax,
                    'line_total_cents' => round($qty * $unit + $tax, 2),
                ]);
            }

            // Creation is auto-logged via the LogsActivity trait.

            return $po->load(['vendor', 'items']);
        });
    }

    /**
     * Receive stock against a PO. Posts each received line into inventory at its
     * PO unit cost, records discrepancies, advances the PO status to
     * partially_received / received, and returns the receipt document.
     */
    public function receive(PurchaseOrder $po, array $data): PoReceipt
    {
        return DB::transaction(function () use ($po, $data) {
            $receipt = PoReceipt::create([
                'receipt_number' => $this->sequences->next('po_receipt'),
                'purchase_order_id' => $po->id,
                'warehouse_id' => $data['warehouse_id'],
                'status' => 'posted',
                'notes' => $data['notes'] ?? null,
                'received_by' => Auth::id(),
                'received_at' => now(),
            ]);

            foreach ($data['lines'] as $line) {
                $qty = (int) $line['quantity_received'];
                if ($qty <= 0) {
                    continue;
                }

                $poItem = PurchaseOrderItem::find($line['purchase_order_item_id']);
                $ordered = $poItem->quantity;
                $alreadyReceived = $poItem->quantity_received;

                $receipt->items()->create([
                    'purchase_order_item_id' => $poItem->id,
                    'product_id' => $poItem->product_id,
                    'quantity_ordered' => $ordered,
                    'quantity_received' => $qty,
                    'discrepancy' => ($alreadyReceived + $qty) - $ordered,
                    'stock_location_id' => $line['stock_location_id'] ?? null,
                ]);

                $poItem->increment('quantity_received', $qty);

                if ($poItem->product_id) {
                    $this->inventory->receive(
                        $poItem->product_id, $data['warehouse_id'], $line['stock_location_id'] ?? null,
                        $qty, $poItem->getRawOriginal('unit_cost_cents') / 100,
                        'receipt', 'PurchaseOrder', $po->id, "PO {$po->po_number}"
                    );
                }
            }

            // Advance PO status based on fulfilment.
            $po->refresh()->load('items');
            $fullyReceived = $po->items->every(fn ($i) => $i->quantity_received >= $i->quantity);
            $anyReceived = $po->items->contains(fn ($i) => $i->quantity_received > 0);
            $po->status = $fullyReceived ? 'received' : ($anyReceived ? 'partially_received' : $po->status);
            $po->save();

            // PO status change is auto-logged via the LogsActivity trait.

            return $receipt;
        });
    }
}
