<?php

namespace App\Models;

use App\Casts\Money;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseOrder extends Model
{
    use HasFactory, LogsActivity, SoftDeletes;

    protected array $activityIgnore = ['subtotal_cents', 'grand_total_cents'];

    protected $fillable = [
        'po_number', 'vendor_id', 'warehouse_id', 'status', 'subtotal_cents',
        'discount_cents', 'shipping_cents', 'tax_cents', 'grand_total_cents',
        'ordered_date', 'expected_date', 'approved_at', 'approved_by', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'ordered_date' => 'date',
            'expected_date' => 'date',
            'approved_at' => 'datetime',
            'subtotal_cents' => Money::class,
            'discount_cents' => Money::class,
            'shipping_cents' => Money::class,
            'tax_cents' => Money::class,
            'grand_total_cents' => Money::class,
        ];
    }

    public const STATUSES = [
        'draft', 'pending_approval', 'approved', 'ordered',
        'partially_received', 'received', 'cancelled', 'closed',
    ];

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }

    public function receipts(): HasMany
    {
        return $this->hasMany(PoReceipt::class);
    }

    public function scopeStatus($q, ?string $status)
    {
        return $status ? $q->where('status', $status) : $q;
    }
}
