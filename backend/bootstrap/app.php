<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Token-based SPA (Bearer tokens), so we do NOT use Sanctum's stateful
        // cookie/CSRF mode — that would reject cross-origin browser requests.
        $middleware->throttleApi();
        $middleware->alias([
            'admin.deletes' => \App\Http\Middleware\AdminOnlyDeletes::class,
            'admin.only' => \App\Http\Middleware\EnsureAdmin::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Always answer API routes with JSON (a 401, not an HTML redirect to a
        // non-existent "login" route) when unauthenticated.
        $exceptions->shouldRenderJsonWhen(
            fn ($request) => $request->is('api/*') || $request->expectsJson()
        );
    })->create();
