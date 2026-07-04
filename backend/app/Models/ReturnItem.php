<?php

namespace App\Models;

use App\Casts\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReturnItem extends Model
{
    protected $fillable = [
        'return_id', 'product_id', 'product_name', 'quantity',
        'condition', 'restock', 'unit_refund_cents',
    ];

    protected function casts(): array
    {
        return ['restock' => 'boolean', 'unit_refund_cents' => Money::class];
    }

    public function returnOrder(): BelongsTo
    {
        return $this->belongsTo(ReturnOrder::class, 'return_id');
    }
}
