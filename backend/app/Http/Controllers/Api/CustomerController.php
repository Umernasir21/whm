<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCustomerRequest;
use App\Http\Resources\CustomerResource;
use App\Models\Customer;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function index(Request $request)
    {
        $customers = Customer::query()
            ->search($request->query('q'))
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return CustomerResource::collection($customers);
    }

    public function store(StoreCustomerRequest $request)
    {
        $customer = Customer::create($request->validated());

        return (new CustomerResource($customer))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Customer $customer)
    {
        return new CustomerResource($customer);
    }

    public function update(Request $request, Customer $customer)
    {
        $data = $request->validate([
            'first_name' => ['sometimes', 'string', 'max:96'],
            'last_name' => ['nullable', 'string', 'max:96'],
            'company_name' => ['nullable', 'string', 'max:191'],
            'email' => ['sometimes', 'email', 'max:191'],
            'phone' => ['nullable', 'string', 'max:48'],
            'buyer_id' => ['nullable', 'string', 'max:96'],
            'shipping_name' => ['nullable', 'string', 'max:191'],
            'shipping_address1' => ['sometimes', 'string', 'max:191'],
            'shipping_address2' => ['nullable', 'string', 'max:191'],
            'shipping_city' => ['sometimes', 'string', 'max:96'],
            'shipping_state' => ['sometimes', 'string', 'max:96'],
            'shipping_zip' => ['sometimes', 'string', 'max:24'],
            'shipping_country' => ['sometimes', 'string', 'max:96'],
        ]);
        $customer->update($data);

        return new CustomerResource($customer);
    }
}
