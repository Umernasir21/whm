<?php

namespace App\Services;

use App\Models\CreditNote;
use App\Models\ReturnOrder;
use App\Models\Warehouse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * RMA lifecycle: request → approve → inspect → restock → refund/replace/credit.
 * Restocking routes resellable units back into inventory via InventoryService.
 */
class ReturnService
{
    public function __construct(
        private SequenceService $sequences,
        private InventoryService $inventory,
        private NotificationService $notifications,
    ) {}

    public function create(array $data): ReturnOrder
    {
        return DB::transaction(function () use ($data) {
            $rma = ReturnOrder::create([
                'rma_number' => $this->sequences->next('return'),
                'sales_order_id' => $data['sales_order_id'] ?? null,
                'customer_id' => $data['customer_id'] ?? null,
                'status' => 'requested',
                'reason' => $data['reason'] ?? 'other',
                'resolution' => $data['resolution'] ?? 'none',
                'notes' => $data['notes'] ?? null,
                'created_by' => Auth::id(),
            ]);

            foreach ($data['items'] ?? [] as $item) {
                $rma->items()->create([
                    'product_id' => $item['product_id'] ?? null,
                    'product_name' => $item['product_name'],
                    'quantity' => (int) ($item['quantity'] ?? 1),
                    'condition' => $item['condition'] ?? 'resellable',
                    'restock' => $item['restock'] ?? false,
                    'unit_refund_cents' => $item['unit_refund'] ?? 0,
                ]);
            }

            $this->notifications->broadcastToRole('manager', 'return_requested',
                "Return requested: {$rma->rma_number}", null, '/returns', 'warning');

            return $rma->load('items');
        });
    }

    /** Approve → inspect → restock resellable units and settle the resolution. */
    public function process(ReturnOrder $rma, string $status, ?int $warehouseId = null): ReturnOrder
    {
        return DB::transaction(function () use ($rma, $status, $warehouseId) {
            $rma->status = $status;

            if ($status === 'restocked') {
                $warehouse = $warehouseId
                    ? Warehouse::find($warehouseId)
                    : Warehouse::where('is_default', true)->first();

                foreach ($rma->items as $item) {
                    if ($item->restock && $item->condition === 'resellable' && $item->product_id && $warehouse) {
                        $this->inventory->receive(
                            $item->product_id, $warehouse->id, null, $item->quantity,
                            0, 'return_in', 'Return', $rma->id, "RMA {$rma->rma_number}"
                        );
                    }
                }
            }

            if ($status === 'refunded' && $rma->resolution === 'store_credit') {
                $amount = $rma->items->sum(fn ($i) => $i->quantity * $i->getRawOriginal('unit_refund_cents')) / 100;
                CreditNote::create([
                    'credit_number' => $this->sequences->next('credit_note'),
                    'customer_id' => $rma->customer_id,
                    'return_id' => $rma->id,
                    'amount_cents' => $amount,
                    'status' => 'open',
                    'issued_date' => now()->toDateString(),
                ]);
            }

            $rma->save();

            return $rma->load('items');
        });
    }
}
