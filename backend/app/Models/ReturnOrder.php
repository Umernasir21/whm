<?php

namespace App\Models;

use App\Casts\Money;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * RMA / return order. Maps to the `returns` table (a reserved word, so the
 * model is named ReturnOrder with an explicit table binding).
 */
class ReturnOrder extends Model
{
    use LogsActivity, SoftDeletes;

    protected $table = 'returns';

    protected $fillable = [
        'rma_number', 'sales_order_id', 'customer_id', 'status', 'reason',
        'resolution', 'notes', 'refund_cents', 'created_by',
    ];

    protected function casts(): array
    {
        return ['refund_cents' => Money::class];
    }

    public function items(): HasMany
    {
        return $this->hasMany(ReturnItem::class, 'return_id');
    }

    public function salesOrder(): BelongsTo
    {
        return $this->belongsTo(SalesOrder::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
