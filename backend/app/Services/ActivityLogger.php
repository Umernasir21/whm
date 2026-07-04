<?php

namespace App\Services;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class ActivityLogger
{
    public function log(string $action, Model $subject, array $changes = []): void
    {
        DB::table('activity_log')->insert([
            'user_id' => Auth::id(),
            'action' => $action,
            'subject_type' => $subject::class,
            'subject_id' => $subject->getKey(),
            'changes_json' => json_encode($changes),
            'ip_address' => request()->ip(),
            'created_at' => now(),
        ]);
    }
}
