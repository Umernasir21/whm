<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PurchaseOrderController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\ReturnController;
use App\Http\Controllers\Api\SalesOrderController;
use App\Http\Controllers\Api\SearchController;
use App\Http\Controllers\Api\SettingController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\VendorController;
use App\Http\Controllers\Api\WarehouseController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API v1
|--------------------------------------------------------------------------
| Versioned so future breaking changes ship under /api/v2 without disrupting
| existing clients. All write throughput is protected by Sanctum + throttle.
*/
Route::prefix('v1')->group(function () {
    // ---- Public ----
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:6,1');

    // ---- Authenticated ----
    // `admin.deletes` enforces "only admins can delete" across every DELETE route.
    Route::middleware(['auth:sanctum', 'admin.deletes'])->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);

        Route::get('/dashboard', [DashboardController::class, 'index']);
        Route::get('/search', SearchController::class);

        // Catalog
        Route::apiResource('products', ProductController::class);
        Route::apiResource('categories', CategoryController::class)->except('show');

        // Parties
        Route::apiResource('customers', CustomerController::class)->only(['index', 'store', 'show', 'update']);
        Route::apiResource('vendors', VendorController::class);

        // Warehouses & inventory
        Route::apiResource('warehouses', WarehouseController::class);
        Route::post('warehouses/{warehouse}/locations', [WarehouseController::class, 'storeLocation']);
        Route::get('inventory', [InventoryController::class, 'index']);
        Route::get('inventory/low-stock', [InventoryController::class, 'lowStock']);
        Route::get('inventory/movements', [InventoryController::class, 'movements']);
        Route::post('inventory/receive', [InventoryController::class, 'receive']);
        Route::post('inventory/adjust', [InventoryController::class, 'adjust']);
        Route::post('inventory/transfer', [InventoryController::class, 'transfer']);

        // Sales
        Route::apiResource('sales-orders', SalesOrderController::class)
            ->parameters(['sales-orders' => 'salesOrder']);
        Route::post('sales-orders/{salesOrder}/invoice', [InvoiceController::class, 'generate']);
        Route::get('sales-orders/{salesOrder}/label', [\App\Http\Controllers\Api\ShippingLabelController::class, 'download']);
        Route::get('invoices', [InvoiceController::class, 'index']);
        Route::get('invoices/{invoice}/download', [InvoiceController::class, 'download']);

        // Purchasing
        Route::apiResource('purchase-orders', PurchaseOrderController::class)
            ->parameters(['purchase-orders' => 'purchaseOrder'])
            ->only(['index', 'store', 'show', 'update']);
        Route::post('purchase-orders/{purchaseOrder}/receive', [PurchaseOrderController::class, 'receive']);

        // Returns / RMA
        Route::apiResource('returns', ReturnController::class)->only(['index', 'store', 'show']);
        Route::patch('returns/{return}/status', [ReturnController::class, 'updateStatus']);

        // Notifications
        Route::get('notifications', [NotificationController::class, 'index']);
        Route::patch('notifications/{notification}/read', [NotificationController::class, 'markRead']);
        Route::post('notifications/read-all', [NotificationController::class, 'markAllRead']);

        // Reports
        Route::prefix('reports')->group(function () {
            Route::get('profit', [ReportController::class, 'profit']);
            Route::get('sales', [ReportController::class, 'sales']);
            Route::get('purchases', [ReportController::class, 'purchases']);
            Route::get('inventory-valuation', [ReportController::class, 'inventoryValuation']);
            Route::get('stock-movement', [ReportController::class, 'stockMovement']);
            Route::get('top-customers', [ReportController::class, 'topCustomers']);
            Route::get('top-vendors', [ReportController::class, 'topVendors']);
        });

        // Administration (RBAC + settings)
        Route::apiResource('users', UserController::class)->only(['index', 'store', 'update', 'destroy']);
        Route::get('roles', [UserController::class, 'roles']);
        Route::get('settings', [SettingController::class, 'index']);
        Route::put('settings', [SettingController::class, 'update']);

        // Audit trail + login history — admins only ("admin can see all the logs").
        Route::middleware('admin.only')->group(function () {
            Route::get('activity-logs', [\App\Http\Controllers\Api\ActivityLogController::class, 'index']);
            Route::get('login-history', [UserController::class, 'loginHistory']);
        });
    });
});

/*
| Backwards-compatible aliases for the original unversioned routes so the
| existing frontend keeps working while it migrates onto /v1.
*/
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:6,1');
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::apiResource('customers', CustomerController::class)->only(['index', 'store', 'show']);
    Route::apiResource('sales-orders', SalesOrderController::class)->parameters(['sales-orders' => 'salesOrder']);
    Route::post('sales-orders/{salesOrder}/invoice', [InvoiceController::class, 'generate']);
    Route::apiResource('purchase-orders', PurchaseOrderController::class)
        ->parameters(['purchase-orders' => 'purchaseOrder'])->only(['index', 'store', 'show']);
    Route::get('invoices/{invoice}/download', [InvoiceController::class, 'download']);
    Route::get('reports/profit', [ReportController::class, 'profit']);
});
