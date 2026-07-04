<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class NotificationController extends Controller
{
    public function __construct(private NotificationService $service) {}

    public function index(Request $request)
    {
        $q = Notification::where('user_id', Auth::id());
        if ($request->boolean('unread')) {
            $q->unread();
        }

        return response()->json([
            'unread_count' => Notification::where('user_id', Auth::id())->unread()->count(),
            'items' => $q->latest()->limit(50)->get(),
        ]);
    }

    public function markRead(Notification $notification)
    {
        abort_unless($notification->user_id === Auth::id(), 403);
        $this->service->markRead($notification);

        return response()->noContent();
    }

    public function markAllRead()
    {
        Notification::where('user_id', Auth::id())->unread()->update(['read_at' => now()]);

        return response()->noContent();
    }
}
