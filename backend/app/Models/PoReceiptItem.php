<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PoReceiptItem extends Model
{
    protected $fillable = [
        'po_receipt_id', 'purchase_order_item_id', 'product_id',
        'quantity_ordered', 'quantity_received', 'discrepancy', 'stock_location_id',
    ];

    public function receipt(): BelongsTo
    {
        return $this->belongsTo(PoReceipt::class, 'po_receipt_id');
    }
}
