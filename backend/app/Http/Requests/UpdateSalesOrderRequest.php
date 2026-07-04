<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSalesOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('sales_orders.update') ?? false;
    }

    public function rules(): array
    {
        return [
            // Full enterprise lifecycle (matches SalesOrder::STATUSES).
            'status' => ['nullable', Rule::in(\App\Models\SalesOrder::STATUSES)],
            'payment_method' => ['nullable', 'string', 'max:64'],
            'transaction_id' => ['nullable', 'string', 'max:96'],
            'payment_comment' => ['nullable', 'string', 'max:255'],
            'shipment' => ['nullable', 'array'],
            'shipment.carrier' => ['nullable', Rule::in(['USPS', 'UPS', 'FedEx', 'DHL', 'Other'])],
            'shipment.tracking_number' => ['nullable', 'string', 'max:96'],
            'shipment.tracking_url' => ['nullable', 'url', 'max:255'],
            'shipment.status' => ['nullable', Rule::in(['pending', 'shipped', 'delivered'])],
        ];
    }
}
