<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreSalesOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('sales_orders.create') ?? false;
    }

    public function rules(): array
    {
        return [
            'customer_id' => ['required', 'exists:customers,id'],
            'order_type' => ['nullable', 'in:regular,dropship'],
            'resource' => ['nullable', 'string', 'max:96'],
            'resource_order_id' => ['nullable', 'string', 'max:96'],
            'alternate_id' => ['nullable', 'string', 'max:96'],
            'payment_method' => ['nullable', 'string', 'max:64'],
            'transaction_id' => ['nullable', 'string', 'max:96'],
            'payment_date' => ['nullable', 'date'],
            'payment_comment' => ['nullable', 'string', 'max:255'],
            'shipping' => ['nullable', 'numeric', 'min:0'],
            'tax' => ['nullable', 'numeric', 'min:0'],
            'buy_tax' => ['nullable', 'numeric', 'min:0'],  // purchase tax → PO After Tax
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['nullable', 'exists:products,id'],
            'items.*.product_name' => ['required', 'string', 'max:191'],
            'items.*.condition' => ['nullable', 'in:new,used,refurbished'],
            'items.*.line_type' => ['nullable', 'in:ds,rg'],  // per-line Dropship/Regular
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.unit_cost' => ['required', 'numeric', 'min:0'],  // sale price
            'items.*.buy_cost' => ['nullable', 'numeric', 'min:0'],   // purchase cost
        ];
    }
}
