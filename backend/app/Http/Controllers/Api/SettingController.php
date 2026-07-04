<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    public function index()
    {
        return Setting::orderBy('group')->orderBy('key')->get()->groupBy('group');
    }

    public function update(Request $request)
    {
        $d = $request->validate([
            'settings' => ['required', 'array'],
            'settings.*.key' => ['required', 'string', 'max:96'],
            'settings.*.value' => ['nullable'],
            'settings.*.group' => ['nullable', 'string', 'max:48'],
        ]);

        foreach ($d['settings'] as $s) {
            Setting::put($s['key'], $s['value'] ?? null, $s['group'] ?? 'general');
        }

        return Setting::orderBy('group')->get()->groupBy('group');
    }
}
