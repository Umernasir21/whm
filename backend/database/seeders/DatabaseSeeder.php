<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Customer;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use App\Models\Warehouse;
use App\Services\InventoryService;
use App\Services\PurchaseOrderService;
use App\Services\SalesOrderService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // --- Sequences (gapless document numbering) ---
        DB::table('sequences')->insertOrIgnore([
            ['key_name' => 'sales_order', 'prefix' => 'SO-', 'next_value' => 1, 'pad_length' => 5],
            ['key_name' => 'purchase_order', 'prefix' => 'PO-', 'next_value' => 1, 'pad_length' => 5],
            ['key_name' => 'invoice', 'prefix' => 'INV-', 'next_value' => 1, 'pad_length' => 5],
            ['key_name' => 'return', 'prefix' => 'RMA-', 'next_value' => 1, 'pad_length' => 5],
            ['key_name' => 'credit_note', 'prefix' => 'CN-', 'next_value' => 1, 'pad_length' => 5],
            ['key_name' => 'po_receipt', 'prefix' => 'RCV-', 'next_value' => 1, 'pad_length' => 5],
        ]);

        // --- Permissions (full module matrix) ---
        $modules = [
            'dashboard' => ['view'],
            'products' => ['view', 'create', 'update', 'delete'],
            'categories' => ['view', 'manage'],
            'customers' => ['view', 'create', 'update', 'delete'],
            'vendors' => ['view', 'create', 'update', 'delete'],
            'warehouses' => ['view', 'manage'],
            'inventory' => ['view', 'adjust', 'transfer'],
            'sales_orders' => ['view', 'create', 'update', 'delete'],
            'purchase_orders' => ['view', 'create', 'update', 'receive'],
            'returns' => ['view', 'create', 'process'],
            'invoices' => ['create'],
            'reports' => ['view'],
            'users' => ['view', 'manage'],
            'settings' => ['view', 'manage'],
        ];
        foreach ($modules as $module => $actions) {
            foreach ($actions as $action) {
                Permission::firstOrCreate(
                    ['name' => "{$module}.{$action}"],
                    ['label' => ucfirst($action) . ' ' . str_replace('_', ' ', $module)]
                );
            }
        }

        // --- Roles (7-role enterprise RBAC) ---
        $roles = [
            'super_admin' => 'Super Administrator',
            'admin' => 'Administrator',
            'manager' => 'Warehouse Manager',
            'sales' => 'Sales',
            'purchasing' => 'Purchasing',
            'accountant' => 'Accountant',
            'staff' => 'Staff',
            'viewer' => 'Viewer',
        ];
        $roleModels = [];
        foreach ($roles as $name => $label) {
            $roleModels[$name] = Role::firstOrCreate(['name' => $name], ['label' => $label]);
        }

        $all = Permission::pluck('id');
        $roleModels['super_admin']->permissions()->sync($all);
        $roleModels['admin']->permissions()->sync($all);
        $roleModels['manager']->permissions()->sync(
            Permission::where('name', 'not like', 'users.%')
                ->where('name', 'not like', 'settings.%')->pluck('id')
        );
        $roleModels['sales']->permissions()->sync(
            Permission::whereIn('name', [
                'dashboard.view', 'products.view', 'customers.view', 'customers.create',
                'customers.update', 'sales_orders.view', 'sales_orders.create',
                'sales_orders.update', 'invoices.create', 'inventory.view', 'returns.view', 'returns.create',
            ])->pluck('id')
        );
        $roleModels['purchasing']->permissions()->sync(
            Permission::whereIn('name', [
                'dashboard.view', 'products.view', 'vendors.view', 'vendors.create', 'vendors.update',
                'purchase_orders.view', 'purchase_orders.create', 'purchase_orders.update',
                'purchase_orders.receive', 'inventory.view',
            ])->pluck('id')
        );
        $roleModels['accountant']->permissions()->sync(
            Permission::whereIn('name', ['dashboard.view', 'reports.view', 'invoices.create',
                'sales_orders.view', 'purchase_orders.view', 'customers.view'])->pluck('id')
        );
        // Staff: full daily operations but NO delete, users, settings, or logs.
        $roleModels['staff']->permissions()->sync(
            Permission::whereIn('name', [
                'dashboard.view',
                'products.view', 'products.create', 'products.update',
                'customers.view', 'customers.create', 'customers.update',
                'vendors.view', 'vendors.create', 'vendors.update',
                'inventory.view', 'inventory.adjust', 'inventory.transfer',
                'sales_orders.view', 'sales_orders.create', 'sales_orders.update',
                'purchase_orders.view', 'purchase_orders.create', 'purchase_orders.update', 'purchase_orders.receive',
                'returns.view', 'returns.create', 'returns.process',
                'invoices.create',
            ])->pluck('id')
        );
        $roleModels['viewer']->permissions()->sync(
            Permission::where('name', 'like', '%.view')->pluck('id')
        );

        // --- Users ---
        // The separate administrator: delete rights + sees all activity logs.
        User::firstOrCreate(['email' => 'admin@wms.test'],
            ['role_id' => $roleModels['super_admin']->id, 'name' => 'System Admin', 'password' => 'Password123', 'is_active' => true]);

        // The three staff users — their name is stamped on everything they touch,
        // but they cannot delete or view the audit log.
        foreach (['Abdullah' => 'abdullah', 'Arsum' => 'arsum', 'Jawed' => 'jawed'] as $name => $handle) {
            User::firstOrCreate(['email' => "{$handle}@wms.test"],
                ['role_id' => $roleModels['staff']->id, 'name' => $name, 'password' => 'Password123', 'is_active' => true]);
        }

        // --- Warehouses ---
        $main = Warehouse::firstOrCreate(['code' => 'WH-MAIN'], [
            'name' => 'Main Distribution Center', 'address1' => '21043 Warrender Terrace Ln',
            'city' => 'Richmond', 'state' => 'TX', 'zip' => '77407', 'country' => 'USA',
            'is_default' => true, 'is_active' => true,
        ]);
        Warehouse::firstOrCreate(['code' => 'WH-EAST'], [
            'name' => 'East Coast Hub', 'city' => 'Newark', 'state' => 'NJ', 'zip' => '07102',
            'country' => 'USA', 'is_active' => true,
        ]);

        // A few bins in the main warehouse.
        foreach (['A-01-01', 'A-01-02', 'B-02-01'] as $code) {
            $main->locations()->firstOrCreate(['code' => $code], ['type' => 'bin', 'is_pickable' => true]);
        }

        // --- Categories ---
        $electronics = Category::firstOrCreate(['slug' => 'electronics'], ['name' => 'Electronics']);
        $accessories = Category::firstOrCreate(['slug' => 'accessories'], ['name' => 'Accessories', 'parent_id' => $electronics->id]);

        // --- Products (with reorder points + starting inventory) ---
        $inventory = app(InventoryService::class);
        $catalog = [
            ['sku' => 'WH-HEADPHONE', 'name' => 'Wireless Headphones', 'category_id' => $electronics->id, 'price' => 129.99, 'cost' => 49.99, 'reorder' => 15, 'qty' => 40],
            ['sku' => 'USB-C-CABLE', 'name' => 'USB-C Cable 2m', 'category_id' => $accessories->id, 'price' => 19.99, 'cost' => 3.20, 'reorder' => 50, 'qty' => 12],
            ['sku' => 'BT-SPEAKER', 'name' => 'Bluetooth Speaker', 'category_id' => $electronics->id, 'price' => 79.99, 'cost' => 28.00, 'reorder' => 10, 'qty' => 5],
            ['sku' => 'PHONE-CASE', 'name' => 'Phone Case', 'category_id' => $accessories->id, 'price' => 24.99, 'cost' => 4.50, 'reorder' => 30, 'qty' => 0],
        ];
        foreach ($catalog as $c) {
            $product = Product::firstOrCreate(['sku' => $c['sku']], [
                'name' => $c['name'], 'category_id' => $c['category_id'],
                'default_price_cents' => $c['price'], 'default_cost_cents' => $c['cost'],
                'reorder_point' => $c['reorder'], 'reorder_quantity' => $c['reorder'] * 2,
                'is_active' => true, 'barcode' => (string) mt_rand(100000000000, 999999999999),
            ]);
            if ($c['qty'] > 0 && $product->inventoryLevels()->doesntExist()) {
                $inventory->receive($product->id, $main->id, null, $c['qty'], $c['cost'], 'receipt', null, null, 'Opening balance');
            }
        }

        // --- Vendor & customers ---
        $vendor = Vendor::firstOrCreate(['name' => 'Acme Wholesale'],
            ['email' => 'sales@acme.test', 'city' => 'Dallas', 'state' => 'TX', 'country' => 'USA']);

        $customers = collect([
            ['first_name' => 'Estelle', 'last_name' => 'Darcy', 'email' => 'estelle@example.com',
             'company_name' => 'Darcy Retail', 'shipping_address1' => '123 Anywhere St',
             'shipping_city' => 'Austin', 'shipping_state' => 'TX', 'shipping_zip' => '73301', 'shipping_country' => 'USA'],
            ['first_name' => 'Samira', 'last_name' => 'Hadid', 'email' => 'samira@example.com',
             'shipping_address1' => '456 Market Ave', 'shipping_city' => 'Houston',
             'shipping_state' => 'TX', 'shipping_zip' => '77002', 'shipping_country' => 'USA'],
        ])->map(fn ($c) => Customer::firstOrCreate(['email' => $c['email']], $c));

        // --- Sample orders via services (real numbering + totals) ---
        $soService = app(SalesOrderService::class);
        $poService = app(PurchaseOrderService::class);
        $invoiceService = app(\App\Services\InvoiceService::class);

        if (\App\Models\SalesOrder::count() === 0) {
            // A spread of delivered orders across the last ~6 months so the
            // dashboard has real revenue, profit, a trend line, and invoices.
            $lineSets = [
                [['product_name' => 'Wireless Headphones', 'quantity' => 2, 'unit_cost' => 129.99, 'buy_cost' => 50.00],
                 ['product_name' => 'USB-C Cable 2m', 'quantity' => 3, 'unit_cost' => 19.99, 'buy_cost' => 3.20]],
                [['product_name' => 'Bluetooth Speaker', 'quantity' => 1, 'unit_cost' => 79.99, 'buy_cost' => 28.00],
                 ['product_name' => 'Phone Case', 'quantity' => 4, 'unit_cost' => 24.99, 'buy_cost' => 4.50]],
                [['product_name' => 'Wireless Headphones', 'quantity' => 1, 'unit_cost' => 129.99, 'buy_cost' => 50.00]],
                [['product_name' => 'USB-C Cable 2m', 'quantity' => 10, 'unit_cost' => 19.99, 'buy_cost' => 3.20]],
                [['product_name' => 'Bluetooth Speaker', 'quantity' => 2, 'unit_cost' => 79.99, 'buy_cost' => 28.00]],
                [['product_name' => 'Phone Case', 'quantity' => 6, 'unit_cost' => 24.99, 'buy_cost' => 4.50]],
            ];

            foreach ($lineSets as $i => $items) {
                $customer = $customers[$i % $customers->count()];
                $order = $soService->create([
                    'customer_id' => $customer->id,
                    'order_type' => $i % 3 === 0 ? 'dropship' : 'regular',
                    'payment_method' => 'Card',
                    'shipping' => 12.50,
                    'tax' => 8.25,
                    'items' => array_map(fn ($it) => $it + ['condition' => 'new', 'line_type' => 'rg'], $items),
                ]);

                // Backdate across months and mark delivered + invoiced.
                $when = now()->subMonths(5 - min($i, 5))->subDays($i * 2);
                $order->forceFill(['status' => 'delivered', 'created_at' => $when, 'approved_at' => $when])->save();
                $order->shipment()->update([
                    'carrier' => ['USPS', 'UPS', 'FedEx'][$i % 3],
                    'tracking_number' => '9400' . str_pad((string) (1000 + $i), 12, '0', STR_PAD_LEFT),
                    'status' => 'delivered', 'shipped_at' => $when, 'delivered_at' => $when->copy()->addDays(2),
                ]);
                $invoiceService->generate($order);
            }

            $poService->create([
                'vendor_id' => $vendor->id,
                'status' => 'ordered',
                'ordered_date' => now()->toDateString(),
                'items' => [
                    ['product_name' => 'Wireless Headphones', 'condition' => 'new', 'quantity' => 10, 'unit_cost' => 49.99, 'tax' => 15.40],
                    ['product_name' => 'USB-C Cable 2m', 'condition' => 'new', 'quantity' => 20, 'unit_cost' => 3.20, 'tax' => 5.12],
                ],
            ]);
        }
    }
}
