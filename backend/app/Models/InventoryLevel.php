<?php

namespace App\Models;

use App\Casts\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryLevel extends Model
{
    protected $fillable = [
        'product_id', 'warehouse_id', 'stock_location_id',
        'quantity_on_hand', 'quantity_reserved', 'quantity_damaged',
        'quantity_returned', 'avg_cost_cents',
    ];

    protected function casts(): array
    {
        return ['avg_cost_cents' => Money::class];
    }

    /** Sellable stock = on hand minus what is already reserved. */
    public function getQuantityAvailableAttribute(): int
    {
        return $this->quantity_on_hand - $this->quantity_reserved;
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(StockLocation::class, 'stock_location_id');
    }
}
