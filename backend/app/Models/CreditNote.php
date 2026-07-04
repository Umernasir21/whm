<?php

namespace App\Models;

use App\Casts\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CreditNote extends Model
{
    protected $fillable = [
        'credit_number', 'customer_id', 'return_id', 'amount_cents',
        'applied_cents', 'status', 'issued_date',
    ];

    protected function casts(): array
    {
        return [
            'amount_cents' => Money::class,
            'applied_cents' => Money::class,
            'issued_date' => 'date',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
