<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LotBatch extends Model
{
    protected $fillable = [
        'product_id', 'lot_number', 'manufactured_date', 'expiry_date', 'quantity',
    ];

    protected function casts(): array
    {
        return ['manufactured_date' => 'date', 'expiry_date' => 'date'];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
