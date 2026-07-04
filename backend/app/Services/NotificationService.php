<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\Role;
use App\Models\User;

class NotificationService
{
    public function notify(
        int $userId, string $type, string $title,
        ?string $body = null, ?string $link = null, string $level = 'info',
    ): Notification {
        return Notification::create([
            'user_id' => $userId,
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'link' => $link,
            'level' => $level,
        ]);
    }

    /** Fan a notification out to every active user holding a given role. */
    public function broadcastToRole(
        string $roleName, string $type, string $title,
        ?string $body = null, ?string $link = null, string $level = 'info',
    ): void {
        $role = Role::where('name', $roleName)->first();
        if (! $role) {
            return;
        }

        User::where('role_id', $role->id)->where('is_active', true)
            ->pluck('id')
            ->each(fn ($id) => $this->notify($id, $type, $title, $body, $link, $level));
    }

    public function markRead(Notification $n): void
    {
        if (! $n->read_at) {
            $n->update(['read_at' => now()]);
        }
    }
}
