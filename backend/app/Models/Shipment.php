<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Shipment extends Model
{
    protected $fillable = [
        'sales_order_id', 'carrier', 'tracking_number', 'tracking_url', 'status',
        'weight', 'dimensions', 'shipping_cost_cents', 'package_count', 'pod_path',
        'ship_from_name', 'ship_from_address', 'ship_from_city',
        'ship_from_state', 'ship_from_zip', 'shipped_at', 'delivered_at',
    ];

    protected function casts(): array
    {
        return [
            'shipped_at' => 'datetime',
            'delivered_at' => 'datetime',
            'shipping_cost_cents' => \App\Casts\Money::class,
            'weight' => 'decimal:3',
        ];
    }

    public function salesOrder(): BelongsTo
    {
        return $this->belongsTo(SalesOrder::class);
    }
}
