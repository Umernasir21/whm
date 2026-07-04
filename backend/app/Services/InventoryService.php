<?php

namespace App\Services;

use App\Models\InventoryLevel;
use App\Models\Product;
use App\Models\StockMovement;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * The inventory engine: every unit that enters, leaves, moves, or is reserved
 * passes through here. It keeps per-location `inventory_levels` in sync, writes
 * an append-only `stock_movements` ledger, maintains a weighted-average cost,
 * prevents negative stock, and raises low-stock notifications.
 *
 * All public mutators are transactional and lock the affected level row
 * (SELECT ... FOR UPDATE) so concurrent receipts/sales cannot race.
 */
class InventoryService
{
    public function __construct(private NotificationService $notifications) {}

    /**
     * Resolve (and lock) the inventory level row for a product at a location.
     * Creates a zero row if none exists.
     */
    private function level(int $productId, int $warehouseId, ?int $locationId): InventoryLevel
    {
        $level = InventoryLevel::where('product_id', $productId)
            ->where('warehouse_id', $warehouseId)
            ->where('stock_location_id', $locationId)
            ->lockForUpdate()
            ->first();

        return $level ?: InventoryLevel::create([
            'product_id' => $productId,
            'warehouse_id' => $warehouseId,
            'stock_location_id' => $locationId,
        ]);
    }

    /**
     * Add stock (receipt, return-in, adjustment-in, transfer-in) and update the
     * weighted-average cost when a unit cost is supplied.
     */
    public function receive(
        int $productId,
        int $warehouseId,
        ?int $locationId,
        int $quantity,
        float $unitCost = 0.0,
        string $type = 'receipt',
        ?string $referenceType = null,
        ?int $referenceId = null,
        ?string $reason = null,
    ): StockMovement {
        if ($quantity <= 0) {
            throw new RuntimeException('Receive quantity must be positive.');
        }

        return DB::transaction(function () use (
            $productId, $warehouseId, $locationId, $quantity, $unitCost,
            $type, $referenceType, $referenceId, $reason
        ) {
            $level = $this->level($productId, $warehouseId, $locationId);

            // Weighted-average cost: blend existing value with incoming value.
            if ($unitCost > 0) {
                $existingQty = max($level->quantity_on_hand, 0);
                $existingValue = $existingQty * (int) round($level->getRawOriginal('avg_cost_cents'));
                $incomingValue = $quantity * (int) round($unitCost * 100);
                $newQty = $existingQty + $quantity;
                $level->avg_cost_cents = $newQty > 0
                    ? ($existingValue + $incomingValue) / 100 / $newQty
                    : $unitCost;
            }

            $level->quantity_on_hand += $quantity;
            $level->save();

            return $this->recordMovement(
                $productId, $warehouseId, $locationId, $type, $quantity,
                $unitCost, $level->quantity_on_hand, $referenceType, $referenceId, $reason
            );
        });
    }

    /**
     * Remove stock (sale, adjustment-out, transfer-out, damage). Blocks negative
     * inventory unless explicitly allowed by settings.
     */
    public function issue(
        int $productId,
        int $warehouseId,
        ?int $locationId,
        int $quantity,
        string $type = 'sale',
        ?string $referenceType = null,
        ?int $referenceId = null,
        ?string $reason = null,
        bool $allowNegative = false,
    ): StockMovement {
        if ($quantity <= 0) {
            throw new RuntimeException('Issue quantity must be positive.');
        }

        return DB::transaction(function () use (
            $productId, $warehouseId, $locationId, $quantity, $type,
            $referenceType, $referenceId, $reason, $allowNegative
        ) {
            $level = $this->level($productId, $warehouseId, $locationId);

            if (! $allowNegative && $level->quantity_on_hand < $quantity) {
                throw new RuntimeException(
                    "Insufficient stock: on hand {$level->quantity_on_hand}, requested {$quantity}."
                );
            }

            $level->quantity_on_hand -= $quantity;
            $level->save();

            $movement = $this->recordMovement(
                $productId, $warehouseId, $locationId, $type, -$quantity,
                $level->avg_cost_cents ? $level->getRawOriginal('avg_cost_cents') / 100 : 0,
                $level->quantity_on_hand, $referenceType, $referenceId, $reason
            );

            $this->checkLowStock($productId);

            return $movement;
        });
    }

    /** Reserve available stock for an open order (does not reduce on-hand). */
    public function reserve(int $productId, int $warehouseId, ?int $locationId, int $quantity): void
    {
        DB::transaction(function () use ($productId, $warehouseId, $locationId, $quantity) {
            $level = $this->level($productId, $warehouseId, $locationId);
            if ($level->quantity_available < $quantity) {
                throw new RuntimeException('Not enough available stock to reserve.');
            }
            $level->quantity_reserved += $quantity;
            $level->save();
            $this->recordMovement($productId, $warehouseId, $locationId, 'reservation', 0, 0, $level->quantity_on_hand);
        });
    }

    /** Release a previous reservation. */
    public function release(int $productId, int $warehouseId, ?int $locationId, int $quantity): void
    {
        DB::transaction(function () use ($productId, $warehouseId, $locationId, $quantity) {
            $level = $this->level($productId, $warehouseId, $locationId);
            $level->quantity_reserved = max(0, $level->quantity_reserved - $quantity);
            $level->save();
            $this->recordMovement($productId, $warehouseId, $locationId, 'release', 0, 0, $level->quantity_on_hand);
        });
    }

    /** Transfer stock between two locations/warehouses atomically. */
    public function transfer(
        int $productId,
        int $fromWarehouse,
        ?int $fromLocation,
        int $toWarehouse,
        ?int $toLocation,
        int $quantity,
        ?string $reason = null,
    ): void {
        DB::transaction(function () use (
            $productId, $fromWarehouse, $fromLocation, $toWarehouse, $toLocation, $quantity, $reason
        ) {
            $out = $this->issue($productId, $fromWarehouse, $fromLocation, $quantity, 'transfer_out', 'Transfer', null, $reason);
            $cost = $out->getRawOriginal('unit_cost_cents') / 100;
            $this->receive($productId, $toWarehouse, $toLocation, $quantity, $cost, 'transfer_in', 'Transfer', null, $reason);
        });
    }

    /** Manual stock adjustment to an absolute target quantity (cycle count). */
    public function adjustTo(
        int $productId,
        int $warehouseId,
        ?int $locationId,
        int $targetQty,
        string $reason = 'cycle_count',
    ): StockMovement {
        return DB::transaction(function () use ($productId, $warehouseId, $locationId, $targetQty, $reason) {
            $level = $this->level($productId, $warehouseId, $locationId);
            $delta = $targetQty - $level->quantity_on_hand;

            if ($delta === 0) {
                return $this->recordMovement($productId, $warehouseId, $locationId, 'cycle_count', 0, 0, $level->quantity_on_hand, null, null, $reason);
            }

            $type = $delta > 0 ? 'adjustment_in' : 'adjustment_out';
            $level->quantity_on_hand = $targetQty;
            $level->save();

            $movement = $this->recordMovement($productId, $warehouseId, $locationId, $type, $delta, 0, $targetQty, null, null, $reason);
            $this->checkLowStock($productId);

            return $movement;
        });
    }

    private function recordMovement(
        int $productId, int $warehouseId, ?int $locationId, string $type, int $quantity,
        float $unitCost, int $balanceAfter, ?string $referenceType = null,
        ?int $referenceId = null, ?string $reason = null,
    ): StockMovement {
        return StockMovement::create([
            'product_id' => $productId,
            'warehouse_id' => $warehouseId,
            'stock_location_id' => $locationId,
            'type' => $type,
            'quantity' => $quantity,
            'unit_cost_cents' => $unitCost,       // Money cast → cents
            'balance_after' => $balanceAfter,
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'reason' => $reason,
            'user_id' => Auth::id(),
            'created_at' => now(),
        ]);
    }

    /** Emit a low-stock notification when a product drops to/under reorder point. */
    private function checkLowStock(int $productId): void
    {
        $product = Product::find($productId);
        if ($product && $product->is_low_stock) {
            $this->notifications->broadcastToRole('manager', 'low_stock',
                "Low stock: {$product->name}",
                "{$product->name} ({$product->sku}) is at {$product->total_on_hand}, at/under reorder point {$product->reorder_point}.",
                '/inventory', 'warning'
            );
        }
    }
}
