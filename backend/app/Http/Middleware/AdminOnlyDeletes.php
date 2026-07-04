<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Enforces the business rule "only admins may delete." Any DELETE request is
 * rejected for non-admin roles regardless of per-resource permissions, so the
 * rule holds even for delete routes added later.
 */
class AdminOnlyDeletes
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->isMethod('DELETE') && ! $request->user()?->isAdmin()) {
            abort(403, 'Only administrators can delete records.');
        }

        return $next($request);
    }
}
