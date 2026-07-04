<?php

namespace App\Models;

use App\Casts\Money;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use HasFactory, LogsActivity, SoftDeletes;

    protected $fillable = [
        'sku', 'barcode', 'qr_code', 'name', 'category_id', 'description',
        'condition', 'unit_of_measure', 'default_price_cents', 'default_cost_cents',
        'reorder_point', 'reorder_quantity', 'max_stock', 'valuation_method',
        'track_serial', 'track_lot', 'track_expiry', 'weight', 'dimensions',
        'is_active', 'primary_image_path',
    ];

    protected function casts(): array
    {
        return [
            'default_price_cents' => Money::class,
            'default_cost_cents' => Money::class,
            'track_serial' => 'boolean',
            'track_lot' => 'boolean',
            'track_expiry' => 'boolean',
            'is_active' => 'boolean',
            'weight' => 'decimal:3',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class)->orderBy('sort_order');
    }

    public function inventoryLevels(): HasMany
    {
        return $this->hasMany(InventoryLevel::class);
    }

    public function movements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    public function serials(): HasMany
    {
        return $this->hasMany(SerialNumber::class);
    }

    public function lots(): HasMany
    {
        return $this->hasMany(LotBatch::class);
    }

    /** Total on-hand across every warehouse/location. */
    public function getTotalOnHandAttribute(): int
    {
        return (int) $this->inventoryLevels()->sum('quantity_on_hand');
    }

    public function getTotalAvailableAttribute(): int
    {
        return (int) $this->inventoryLevels()
            ->selectRaw('COALESCE(SUM(quantity_on_hand - quantity_reserved),0) as a')
            ->value('a');
    }

    public function getIsLowStockAttribute(): bool
    {
        return $this->reorder_point > 0 && $this->total_on_hand <= $this->reorder_point;
    }
}
