<?php

namespace App\Services;

use App\Models\PurchaseOrder;
use App\Models\SalesOrder;
use Illuminate\Support\Carbon;

/**
 * Total Profit reporting (Figure 11).
 * Profit = total sales revenue - total purchase cost, over an optional date range.
 * Per-order margin is available where a PO is linked to an SO.
 */
class ProfitService
{
    public function summary(?string $from = null, ?string $to = null): array
    {
        $soQuery = SalesOrder::query();
        $poQuery = PurchaseOrder::query();

        if ($from) {
            $soQuery->where('created_at', '>=', Carbon::parse($from)->startOfDay());
            $poQuery->where('created_at', '>=', Carbon::parse($from)->startOfDay());
        }
        if ($to) {
            $soQuery->where('created_at', '<=', Carbon::parse($to)->endOfDay());
            $poQuery->where('created_at', '<=', Carbon::parse($to)->endOfDay());
        }

        $revenueCents = (int) $soQuery->sum('grand_total_cents');
        $costCents = (int) $poQuery->sum('grand_total_cents');
        $profitCents = $revenueCents - $costCents;

        return [
            'revenue' => round($revenueCents / 100, 2),
            'cost' => round($costCents / 100, 2),
            'profit' => round($profitCents / 100, 2),
            'margin_pct' => $revenueCents > 0
                ? round(($profitCents / $revenueCents) * 100, 1)
                : 0.0,
            'orders_count' => $soQuery->count(),
            'from' => $from,
            'to' => $to,
        ];
    }
}
