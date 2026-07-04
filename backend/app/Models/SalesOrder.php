<?php

namespace App\Models;

use App\Casts\Money;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalesOrder extends Model
{
    use HasFactory, LogsActivity, SoftDeletes;

    /** Noisy/derived columns excluded from the activity diff. */
    protected array $activityIgnore = ['subtotal_cents', 'grand_total_cents', 'cost_of_goods_cents', 'profit_cents'];

    protected $fillable = [
        'so_number', 'customer_id', 'warehouse_id', 'billing_address_id',
        'shipping_address_id', 'order_type', 'status', 'resource',
        'resource_order_id', 'alternate_id', 'payment_method', 'transaction_id',
        'payment_date', 'payment_comment', 'subtotal_cents', 'shipping_cents',
        'discount_cents', 'tax_cents', 'grand_total_cents', 'cost_of_goods_cents',
        'buy_tax_cents', 'profit_cents', 'approved_at', 'linked_po_id', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'payment_date' => 'date',
            'approved_at' => 'datetime',
            'subtotal_cents' => Money::class,
            'shipping_cents' => Money::class,
            'discount_cents' => Money::class,
            'tax_cents' => Money::class,
            'grand_total_cents' => Money::class,
            'cost_of_goods_cents' => Money::class,
            'buy_tax_cents' => Money::class,
            'profit_cents' => Money::class,
        ];
    }

    /** Full lifecycle statuses in canonical order. */
    public const STATUSES = [
        'draft', 'pending', 'approved', 'confirmed', 'packed', 'ready_to_ship',
        'partially_shipped', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(SalesOrderItem::class);
    }

    public function shipment(): HasOne
    {
        return $this->hasOne(Shipment::class);
    }

    public function invoice(): HasOne
    {
        return $this->hasOne(Invoice::class);
    }

    public function linkedPurchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class, 'linked_po_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function returns(): HasMany
    {
        return $this->hasMany(ReturnOrder::class);
    }

    public function notes(): \Illuminate\Database\Eloquent\Relations\MorphMany
    {
        return $this->morphMany(Note::class, 'notable');
    }

    public function attachments(): \Illuminate\Database\Eloquent\Relations\MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }

    public function scopeStatus($q, ?string $status)
    {
        return $status ? $q->where('status', $status) : $q;
    }

    public function scopeType($q, ?string $type)
    {
        return $type ? $q->where('order_type', $type) : $q;
    }

    public function scopeSearch($q, ?string $term)
    {
        if (! $term) {
            return $q;
        }
        return $q->where(function ($sub) use ($term) {
            $sub->where('so_number', 'like', "%{$term}%")
                ->orWhere('transaction_id', 'like', "%{$term}%")
                ->orWhere('resource_order_id', 'like', "%{$term}%");
        });
    }
}
