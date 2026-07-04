<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCustomerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('customers.create') ?? false;
    }

    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:96'],
            'last_name' => ['nullable', 'string', 'max:96'],
            'complete_name' => ['nullable', 'string', 'max:191'],
            'company_name' => ['nullable', 'string', 'max:191'],
            'email' => ['required', 'email', 'max:191'],
            'phone' => ['nullable', 'string', 'max:48'],
            'buyer_id' => ['nullable', 'string', 'max:96'],
            'shipping_name' => ['nullable', 'string', 'max:191'],
            'shipping_address1' => ['required', 'string', 'max:191'],
            'shipping_address2' => ['nullable', 'string', 'max:191'],
            'shipping_city' => ['required', 'string', 'max:96'],
            'shipping_state' => ['required', 'string', 'max:96'],
            'shipping_zip' => ['required', 'string', 'max:24'],
            'shipping_country' => ['required', 'string', 'max:96'],
        ];
    }
}
