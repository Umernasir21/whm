<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Auto-records who created / updated / deleted a model into `activity_log`
 * (user id + name captured at write time, changed fields, IP). This is what
 * lets an admin see "who updated what" without every controller logging by hand.
 *
 * Models opt in by `use LogsActivity;`. Fields listed in $activityIgnore are
 * skipped (e.g. timestamps, computed totals) to keep the diff meaningful.
 */
trait LogsActivity
{
    public static function bootLogsActivity(): void
    {
        static::created(fn (Model $m) => $m->recordActivity('created'));
        static::updated(fn (Model $m) => $m->recordActivity('updated'));
        static::deleted(fn (Model $m) => $m->recordActivity('deleted'));
    }

    protected function recordActivity(string $action): void
    {
        $ignore = array_merge(
            ['updated_at', 'created_at', 'deleted_at', 'remember_token', 'password'],
            property_exists($this, 'activityIgnore') ? $this->activityIgnore : []
        );

        // For updates, log only the changed fields; for create/delete, key attributes.
        $changes = $action === 'updated'
            ? array_diff_key($this->getChanges(), array_flip($ignore))
            : array_diff_key($this->getAttributes(), array_flip($ignore));

        if ($action === 'updated' && empty($changes)) {
            return; // nothing meaningful changed
        }

        $user = Auth::user();

        DB::table('activity_log')->insert([
            'user_id' => $user?->id,
            'action' => $action,
            'subject_type' => static::class,
            'subject_id' => $this->getKey(),
            'changes_json' => json_encode([
                'user_name' => $user?->name,   // denormalised so history survives user deletion
                'label' => $this->activityLabel(),
                'changes' => $changes,
            ]),
            'ip_address' => request()->ip(),
            'created_at' => now(),
        ]);
    }

    /** Human-friendly identifier for the log row (overridable per model). */
    protected function activityLabel(): string
    {
        foreach (['so_number', 'po_number', 'rma_number', 'name', 'sku', 'email'] as $attr) {
            if (! empty($this->{$attr})) {
                return (string) $this->{$attr};
            }
        }

        return class_basename(static::class) . ' #' . $this->getKey();
    }
}
