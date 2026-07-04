<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Widen order status enums to the full enterprise lifecycle and add
 * fulfilment / financial tracking columns the original scaffold lacked.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Widen the status/carrier enums to the full enterprise lifecycle.
        // MySQL enforces ENUM membership, so we redefine the columns; SQLite (and
        // Postgres) store these as VARCHAR without a fixed set, so the app-level
        // STATUSES constants govern validity there.
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE sales_orders MODIFY status ENUM(
                'draft','pending','approved','confirmed','packed','ready_to_ship',
                'partially_shipped','shipped','delivered','cancelled','returned','refunded'
            ) NOT NULL DEFAULT 'draft'");

            DB::statement("ALTER TABLE purchase_orders MODIFY status ENUM(
                'draft','pending_approval','approved','ordered','partially_received',
                'received','cancelled','closed'
            ) NOT NULL DEFAULT 'draft'");

            DB::statement("ALTER TABLE shipments MODIFY carrier ENUM(
                'USPS','UPS','FedEx','DHL','Other'
            ) NULL");
        } else {
            // SQLite/Postgres: the original enum() created a rigid CHECK constraint
            // that would reject the newly-allowed values. Convert to plain strings
            // and let app-level validation (FormRequests + model STATUSES) govern.
            Schema::table('sales_orders', fn (Blueprint $t) => $t->string('status', 32)->default('draft')->change());
            Schema::table('purchase_orders', fn (Blueprint $t) => $t->string('status', 32)->default('draft')->change());
            Schema::table('shipments', fn (Blueprint $t) => $t->string('carrier', 16)->nullable()->change());
        }

        Schema::table('shipments', function (Blueprint $t) {
            $t->string('tracking_url', 255)->nullable()->after('tracking_number');
            $t->decimal('weight', 10, 3)->nullable()->after('tracking_url');
            $t->string('dimensions', 64)->nullable()->after('weight');
            $t->bigInteger('shipping_cost_cents')->default(0)->after('dimensions');
            $t->unsignedSmallInteger('package_count')->default(1)->after('shipping_cost_cents');
            $t->string('pod_path', 255)->nullable()->after('package_count'); // proof of delivery
        });

        Schema::table('sales_orders', function (Blueprint $t) {
            $t->foreignId('warehouse_id')->nullable()->after('customer_id')->constrained('warehouses')->nullOnDelete();
            $t->foreignId('billing_address_id')->nullable()->after('warehouse_id')->constrained('customer_addresses')->nullOnDelete();
            $t->foreignId('shipping_address_id')->nullable()->after('billing_address_id')->constrained('customer_addresses')->nullOnDelete();
            $t->bigInteger('discount_cents')->default(0)->after('shipping_cents');
            $t->bigInteger('cost_of_goods_cents')->default(0)->after('grand_total_cents');
            $t->bigInteger('profit_cents')->default(0)->after('cost_of_goods_cents');
            $t->timestamp('approved_at')->nullable()->after('profit_cents');
        });

        Schema::table('purchase_orders', function (Blueprint $t) {
            $t->foreignId('warehouse_id')->nullable()->after('vendor_id')->constrained('warehouses')->nullOnDelete();
            $t->bigInteger('discount_cents')->default(0)->after('subtotal_cents');
            $t->bigInteger('shipping_cents')->default(0)->after('discount_cents');
            $t->date('expected_date')->nullable()->after('ordered_date');
            $t->timestamp('approved_at')->nullable();
            $t->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
        });

        Schema::table('purchase_order_items', function (Blueprint $t) {
            $t->unsignedInteger('quantity_received')->default(0)->after('quantity');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_order_items', fn (Blueprint $t) => $t->dropColumn('quantity_received'));
        Schema::table('purchase_orders', function (Blueprint $t) {
            $t->dropConstrainedForeignId('warehouse_id');
            $t->dropConstrainedForeignId('approved_by');
            $t->dropColumn(['discount_cents', 'shipping_cents', 'expected_date', 'approved_at']);
        });
        Schema::table('sales_orders', function (Blueprint $t) {
            $t->dropConstrainedForeignId('warehouse_id');
            $t->dropConstrainedForeignId('billing_address_id');
            $t->dropConstrainedForeignId('shipping_address_id');
            $t->dropColumn(['discount_cents', 'cost_of_goods_cents', 'profit_cents', 'approved_at']);
        });
        Schema::table('shipments', fn (Blueprint $t) => $t->dropColumn([
            'tracking_url', 'weight', 'dimensions', 'shipping_cost_cents', 'package_count', 'pod_path',
        ]));
    }
};
