<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SerialNumber extends Model
{
    protected $fillable = ['product_id', 'serial', 'warehouse_id', 'status', 'lot_batch_id'];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
