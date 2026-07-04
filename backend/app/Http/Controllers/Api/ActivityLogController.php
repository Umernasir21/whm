<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Admin-only audit trail: every create / update / delete captured by the
 * LogsActivity trait, joined to the acting user's name. Filterable by user,
 * action, and subject type. Route is protected by the `admin.only` middleware.
 */
class ActivityLogController extends Controller
{
    public function index(Request $request)
    {
        $q = DB::table('activity_log')
            ->leftJoin('users', 'users.id', '=', 'activity_log.user_id')
            ->select([
                'activity_log.id',
                'activity_log.action',
                'activity_log.subject_type',
                'activity_log.subject_id',
                'activity_log.changes_json',
                'activity_log.ip_address',
                'activity_log.created_at',
                'activity_log.user_id',
                'users.name as user_name',
            ]);

        if ($request->filled('user_id')) {
            $q->where('activity_log.user_id', $request->integer('user_id'));
        }
        if ($request->filled('action')) {
            $q->where('activity_log.action', $request->query('action'));
        }
        if ($request->filled('subject_type')) {
            $q->where('activity_log.subject_type', 'like', '%' . $request->query('subject_type') . '%');
        }

        $logs = $q->orderByDesc('activity_log.id')->paginate($request->integer('per_page', 30));

        // Decode the JSON payload and fall back to the stored user_name snapshot.
        $logs->getCollection()->transform(function ($row) {
            $meta = json_decode($row->changes_json ?? '{}', true) ?: [];
            return [
                'id' => $row->id,
                'action' => $row->action,
                'subject' => class_basename($row->subject_type) . ' #' . $row->subject_id,
                'label' => $meta['label'] ?? null,
                'changes' => $meta['changes'] ?? [],
                'user' => $row->user_name ?? ($meta['user_name'] ?? 'System'),
                'ip' => $row->ip_address,
                'at' => $row->created_at,
            ];
        });

        return $logs;
    }
}
