<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    public function index()
    {
        return Category::with('parent')->withCount('products')->orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $data['slug'] = Str::slug($data['name']) . '-' . Str::random(4);

        return response()->json(Category::create($data), 201);
    }

    public function update(Request $request, Category $category)
    {
        $category->update($this->validated($request, $category->id));

        return $category;
    }

    public function destroy(Category $category)
    {
        $category->delete();

        return response()->noContent();
    }

    private function validated(Request $request, ?int $id = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:128'],
            'parent_id' => ['nullable', 'exists:categories,id', Rule::notIn([$id])],
            'description' => ['nullable', 'string'],
        ]);
    }
}
