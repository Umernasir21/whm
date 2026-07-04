<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Vendor;
use Illuminate\Http\Request;

class VendorController extends Controller
{
    public function index(Request $request)
    {
        $q = Vendor::query()->withCount('purchaseOrders')
            ->withSum('purchaseOrders as total_spend', 'grand_total_cents');

        if ($term = $request->query('q')) {
            $q->where('name', 'like', "%{$term}%")->orWhere('email', 'like', "%{$term}%");
        }

        return $q->orderBy('name')->paginate($request->integer('per_page', 20));
    }

    public function store(Request $request)
    {
        return response()->json(Vendor::create($this->validated($request)), 201);
    }

    public function show(Vendor $vendor)
    {
        return $vendor->load(['purchaseOrders' => fn ($q) => $q->latest()->limit(20)]);
    }

    public function update(Request $request, Vendor $vendor)
    {
        $vendor->update($this->validated($request));

        return $vendor;
    }

    public function destroy(Vendor $vendor)
    {
        $vendor->delete();

        return response()->noContent();
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:191'],
            'email' => ['nullable', 'email', 'max:191'],
            'phone' => ['nullable', 'string', 'max:48'],
            'address1' => ['nullable', 'string', 'max:191'],
            'city' => ['nullable', 'string', 'max:96'],
            'state' => ['nullable', 'string', 'max:96'],
            'zip' => ['nullable', 'string', 'max:24'],
            'country' => ['nullable', 'string', 'max:96'],
        ]);
    }
}
