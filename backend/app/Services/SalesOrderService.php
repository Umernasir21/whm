<?php

namespace App\Services;

use App\Models\SalesOrder;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class SalesOrderService
{
    public function __construct(
        private SequenceService $sequences,
        private ActivityLogger $log,
    ) {}

    /**
     * Create a sales order with line items + a shipment stub.
     * All monetary inputs are decimals (dollars); the Money cast converts
     * them to integer cents on write. Fully transactional.
     */
    public function create(array $data): SalesOrder
    {
        return DB::transaction(function () use ($data) {
            $shipping = (float) ($data['shipping'] ?? 0);
            $tax = (float) ($data['tax'] ?? 0);        // sales tax
            $buyTax = (float) ($data['buy_tax'] ?? 0); // purchase tax (for PO After Tax)

            // Sale subtotal (customer-facing) and cost basis (PO Before Tax).
            $subtotal = 0.0;
            $costOfGoods = 0.0;
            foreach ($data['items'] as $item) {
                $qty = (int) ($item['quantity'] ?? 1);
                $subtotal += $qty * (float) ($item['unit_cost'] ?? 0);
                $costOfGoods += $qty * (float) ($item['buy_cost'] ?? 0);
            }
            $grandTotal = round($subtotal + $shipping + $tax, 2);
            // Profit = revenue kept (goods sale) − cost of goods (PO Before Tax).
            $profit = round($subtotal - $costOfGoods, 2);

            $order = SalesOrder::create([
                'so_number' => $this->sequences->next('sales_order'),
                'customer_id' => $data['customer_id'],
                'order_type' => $data['order_type'] ?? 'regular',
                'status' => 'draft',
                'resource' => $data['resource'] ?? null,
                'resource_order_id' => $data['resource_order_id'] ?? null,
                'alternate_id' => $data['alternate_id'] ?? null,
                'payment_method' => $data['payment_method'] ?? null,
                'transaction_id' => $data['transaction_id'] ?? null,
                'payment_date' => $data['payment_date'] ?? null,
                'payment_comment' => $data['payment_comment'] ?? null,
                // Money cast (decimal -> cents):
                'subtotal_cents' => round($subtotal, 2),
                'shipping_cents' => $shipping,
                'tax_cents' => $tax,
                'grand_total_cents' => $grandTotal,
                'cost_of_goods_cents' => round($costOfGoods, 2), // = PO Before Tax
                'buy_tax_cents' => $buyTax,                       // PO After Tax = COGS + buyTax
                'profit_cents' => $profit,
                'created_by' => Auth::id(),
            ]);

            foreach ($data['items'] as $item) {
                $qty = (int) ($item['quantity'] ?? 1);
                $unit = (float) ($item['unit_cost'] ?? 0);
                $buy = (float) ($item['buy_cost'] ?? 0);
                $order->items()->create([
                    'product_id' => $item['product_id'] ?? null,
                    'product_name' => $item['product_name'],
                    'condition' => $item['condition'] ?? 'new',
                    'line_type' => $item['line_type'] ?? 'rg',   // per-line Ds/Rg
                    'quantity' => $qty,
                    'unit_cost_cents' => $unit,                 // Money cast (sale price)
                    'buy_cost_cents' => $buy,                   // Money cast (purchase cost)
                    'line_total_cents' => round($qty * $unit, 2), // Money cast
                ]);
            }

            $order->shipment()->create(['status' => 'pending']);
            // Creation is auto-logged to activity_log via the LogsActivity trait.

            return $order->load(['customer', 'items', 'shipment']);
        });
    }

    /** Update editable fields + shipment tracking (Figure 8 workflow). */
    public function update(SalesOrder $order, array $data): SalesOrder
    {
        return DB::transaction(function () use ($order, $data) {
            $order->fill(array_filter([
                'status' => $data['status'] ?? null,
                'payment_method' => $data['payment_method'] ?? null,
                'transaction_id' => $data['transaction_id'] ?? null,
                'payment_comment' => $data['payment_comment'] ?? null,
            ], fn ($v) => $v !== null))->save();

            if (isset($data['shipment'])) {
                $s = $data['shipment'];
                $shipment = $order->shipment()->firstOrCreate([]);
                $shipment->fill(array_filter([
                    'carrier' => $s['carrier'] ?? null,
                    'tracking_number' => $s['tracking_number'] ?? null,
                    'tracking_url' => $s['tracking_url'] ?? null,
                    'status' => $s['status'] ?? null,
                ], fn ($v) => $v !== null));

                if (($s['status'] ?? null) === 'shipped' && ! $shipment->shipped_at) {
                    $shipment->shipped_at = now();
                    $order->status = 'shipped';
                }
                if (($s['status'] ?? null) === 'delivered' && ! $shipment->delivered_at) {
                    $shipment->delivered_at = now();
                    $order->status = 'delivered';
                }
                $shipment->save();
                $order->save();
            }

            // Update is auto-logged via the LogsActivity trait.

            return $order->load(['customer', 'items', 'shipment', 'invoice']);
        });
    }
}
