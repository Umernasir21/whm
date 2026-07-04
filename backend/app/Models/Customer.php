<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    use HasFactory, LogsActivity, SoftDeletes;

    protected $fillable = [
        'first_name', 'last_name', 'complete_name', 'company_name', 'email',
        'phone', 'buyer_id', 'shipping_name', 'shipping_address1', 'shipping_address2',
        'shipping_city', 'shipping_state', 'shipping_zip', 'shipping_country',
    ];

    public function salesOrders(): HasMany
    {
        return $this->hasMany(SalesOrder::class);
    }

    public function addresses(): HasMany
    {
        return $this->hasMany(CustomerAddress::class);
    }

    public function returns(): HasMany
    {
        return $this->hasMany(ReturnOrder::class);
    }

    public function creditNotes(): HasMany
    {
        return $this->hasMany(CreditNote::class);
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class, 'customer_tag');
    }

    public function notes(): MorphMany
    {
        return $this->morphMany(Note::class, 'notable');
    }

    /** Lifetime revenue in cents across delivered/shipped orders. */
    public function getLifetimeRevenueCentsAttribute(): int
    {
        return (int) $this->salesOrders()
            ->whereNotIn('status', ['cancelled', 'draft'])
            ->sum('grand_total_cents');
    }

    /** Full-text-ish search fallback usable on any driver. */
    public function scopeSearch($query, ?string $term)
    {
        if (! $term) {
            return $query;
        }
        return $query->where(function ($q) use ($term) {
            $like = "%{$term}%";
            $q->where('first_name', 'like', $like)
              ->orWhere('last_name', 'like', $like)
              ->orWhere('complete_name', 'like', $like)
              ->orWhere('company_name', 'like', $like)
              ->orWhere('email', 'like', $like);
        });
    }
}
