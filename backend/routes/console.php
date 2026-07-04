<?php

use Illuminate\Support\Facades\Schedule;

// Example: prune old activity logs weekly
Schedule::call(function () {
    \Illuminate\Support\Facades\DB::table('activity_log')
        ->where('created_at', '<', now()->subMonths(6))
        ->delete();
})->weekly();
