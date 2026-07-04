<?php

namespace App\Models;

use App\Casts\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMovement extends Model
{
    public const UPDATED_AT = null; // append-only ledger

    protected $fillable = [
        'product_id', 'warehouse_id', 'stock_location_id', 'type', 'quantity',
        'unit_cost_cents', 'balance_after', 'reference_type', 'reference_id',
        'reason', 'user_id',
    ];

    protected function casts(): array
    {
        return ['unit_cost_cents' => Money::class, 'created_at' => 'datetime'];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
