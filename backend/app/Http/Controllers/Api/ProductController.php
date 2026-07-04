<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $q = Product::query()->with('category')->withSum('inventoryLevels as on_hand', 'quantity_on_hand');

        if ($term = $request->query('q')) {
            $q->where(fn ($s) => $s->where('name', 'like', "%{$term}%")
                ->orWhere('sku', 'like', "%{$term}%")
                ->orWhere('barcode', 'like', "%{$term}%"));
        }
        if ($request->filled('category_id')) {
            $q->where('category_id', $request->integer('category_id'));
        }
        if ($request->boolean('low_stock')) {
            $q->whereColumn('reorder_point', '>', 0);
        }

        return $q->latest()->paginate($request->integer('per_page', 20));
    }

    public function store(Request $request)
    {
        $data = $this->validateProduct($request);
        $data['sku'] = $data['sku'] ?? $this->generateSku($data['name']);
        $product = Product::create($data);

        return response()->json($product->load('category'), 201);
    }

    public function show(Product $product)
    {
        return $product->load(['category', 'images', 'inventoryLevels.warehouse', 'lots', 'serials']);
    }

    public function update(Request $request, Product $product)
    {
        $product->update($this->validateProduct($request, $product->id));

        return $product->fresh('category');
    }

    public function destroy(Product $product)
    {
        // Guard: block delete if the product has stock on hand.
        if ($product->total_on_hand > 0) {
            return response()->json(['message' => 'Cannot delete a product with stock on hand.'], 422);
        }
        $product->delete();

        return response()->noContent();
    }

    private function validateProduct(Request $request, ?int $id = null): array
    {
        return $request->validate([
            'sku' => ['nullable', 'string', 'max:64', Rule::unique('products', 'sku')->ignore($id)->whereNull('deleted_at')],
            'barcode' => ['nullable', 'string', 'max:64', Rule::unique('products', 'barcode')->ignore($id)->whereNull('deleted_at')],
            'name' => ['required', 'string', 'max:191'],
            'category_id' => ['nullable', 'exists:categories,id'],
            'description' => ['nullable', 'string'],
            'condition' => ['nullable', Rule::in(['new', 'used', 'refurbished'])],
            'unit_of_measure' => ['nullable', 'string', 'max:24'],
            'default_price_cents' => ['nullable', 'numeric', 'min:0'],
            'default_cost_cents' => ['nullable', 'numeric', 'min:0'],
            'reorder_point' => ['nullable', 'integer', 'min:0'],
            'reorder_quantity' => ['nullable', 'integer', 'min:0'],
            'max_stock' => ['nullable', 'integer', 'min:0'],
            'valuation_method' => ['nullable', Rule::in(['FIFO', 'LIFO', 'WAC'])],
            'track_serial' => ['boolean'],
            'track_lot' => ['boolean'],
            'track_expiry' => ['boolean'],
            'weight' => ['nullable', 'numeric', 'min:0'],
            'dimensions' => ['nullable', 'string', 'max:64'],
            'is_active' => ['boolean'],
        ]);
    }

    private function generateSku(string $name): string
    {
        $base = strtoupper(Str::slug(Str::limit($name, 12, ''), ''));

        return $base . '-' . strtoupper(Str::random(5));
    }
}
