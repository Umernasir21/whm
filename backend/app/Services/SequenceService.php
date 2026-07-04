<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * Generates gapless, race-free document numbers like SO-00001.
 * Uses a row lock (SELECT ... FOR UPDATE) inside the caller's transaction.
 */
class SequenceService
{
    public function next(string $key): string
    {
        return DB::transaction(function () use ($key) {
            $row = DB::table('sequences')->where('key_name', $key)->lockForUpdate()->first();

            if (! $row) {
                abort(500, "Sequence [{$key}] is not configured.");
            }

            $value = $row->next_value;

            DB::table('sequences')->where('id', $row->id)->update([
                'next_value' => $value + 1,
            ]);

            return $row->prefix . str_pad((string) $value, $row->pad_length, '0', STR_PAD_LEFT);
        });
    }
}
