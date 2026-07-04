<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * Inventory & warehouse relational core.
 *
 * This is the heart of the WMS that the original document/scaffold lacked entirely:
 * multi-warehouse, hierarchical bin/rack/shelf locations, per-location stock levels
 * (on-hand / reserved / damaged), an append-only stock movement ledger, product
 * enrichment (category, barcode, cost, reorder points, tracking flags), plus
 * serial-number and lot/batch traceability.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ---- Categories (self-referencing tree) ----
        Schema::create('categories', function (Blueprint $t) {
            $t->id();
            $t->foreignId('parent_id')->nullable()->constrained('categories')->nullOnDelete();
            $t->string('name', 128);
            $t->string('slug', 160)->unique();
            $t->text('description')->nullable();
            $t->timestamps();
            $t->softDeletes();
            $t->index('parent_id');
        });

        // ---- Warehouses ----
        Schema::create('warehouses', function (Blueprint $t) {
            $t->id();
            $t->string('code', 24)->unique();
            $t->string('name', 128);
            $t->string('address1', 191)->nullable();
            $t->string('city', 96)->nullable();
            $t->string('state', 96)->nullable();
            $t->string('zip', 24)->nullable();
            $t->string('country', 96)->default('USA');
            $t->boolean('is_default')->default(false);
            $t->boolean('is_active')->default(true);
            $t->timestamps();
            $t->softDeletes();
        });

        // ---- Stock locations: hierarchical bin/rack/shelf within a warehouse ----
        Schema::create('stock_locations', function (Blueprint $t) {
            $t->id();
            $t->foreignId('warehouse_id')->constrained('warehouses')->cascadeOnDelete();
            $t->foreignId('parent_id')->nullable()->constrained('stock_locations')->nullOnDelete();
            $t->enum('type', ['zone', 'aisle', 'rack', 'shelf', 'bin'])->default('bin');
            $t->string('code', 48);          // e.g. A-01-03-B
            $t->string('label', 128)->nullable();
            $t->boolean('is_pickable')->default(true);
            $t->boolean('is_active')->default(true);
            $t->timestamps();
            $t->unique(['warehouse_id', 'code']);
            $t->index('type');
        });

        // ---- Product enrichment (extend the existing thin products table) ----
        Schema::table('products', function (Blueprint $t) {
            $t->foreignId('category_id')->nullable()->after('name')->constrained('categories')->nullOnDelete();
            $t->string('barcode', 64)->nullable()->after('sku');
            $t->string('qr_code', 128)->nullable()->after('barcode');
            $t->enum('condition', ['new', 'used', 'refurbished'])->default('new')->after('description');
            $t->string('unit_of_measure', 24)->default('each')->after('condition');
            $t->bigInteger('default_cost_cents')->default(0)->after('default_price_cents');
            $t->unsignedInteger('reorder_point')->default(0)->after('default_cost_cents');
            $t->unsignedInteger('reorder_quantity')->default(0)->after('reorder_point');
            $t->unsignedInteger('max_stock')->nullable()->after('reorder_quantity');
            $t->enum('valuation_method', ['FIFO', 'LIFO', 'WAC'])->default('WAC')->after('max_stock');
            $t->boolean('track_serial')->default(false)->after('valuation_method');
            $t->boolean('track_lot')->default(false)->after('track_serial');
            $t->boolean('track_expiry')->default(false)->after('track_lot');
            $t->decimal('weight', 10, 3)->nullable()->after('track_expiry');
            $t->string('dimensions', 64)->nullable()->after('weight');   // LxWxH
            $t->boolean('is_active')->default(true)->after('dimensions');
            $t->string('primary_image_path', 255)->nullable()->after('is_active');
            $t->unique('barcode');
            $t->index('category_id');
        });
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE products ADD FULLTEXT ft_products (name, description)');
        }

        // ---- Product images (gallery) ----
        Schema::create('product_images', function (Blueprint $t) {
            $t->id();
            $t->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $t->string('path', 255);
            $t->string('alt', 191)->nullable();
            $t->unsignedSmallInteger('sort_order')->default(0);
            $t->timestamps();
        });

        // ---- Per-product / per-location stock levels (real-time inventory) ----
        Schema::create('inventory_levels', function (Blueprint $t) {
            $t->id();
            $t->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $t->foreignId('warehouse_id')->constrained('warehouses')->cascadeOnDelete();
            $t->foreignId('stock_location_id')->nullable()->constrained('stock_locations')->nullOnDelete();
            $t->integer('quantity_on_hand')->default(0);   // physical units present
            $t->integer('quantity_reserved')->default(0);  // allocated to open orders
            $t->integer('quantity_damaged')->default(0);
            $t->integer('quantity_returned')->default(0);
            // Weighted-average unit cost snapshot (cents) for valuation
            $t->bigInteger('avg_cost_cents')->default(0);
            $t->timestamps();
            $t->unique(['product_id', 'warehouse_id', 'stock_location_id'], 'uq_inventory_ppl');
            $t->index(['warehouse_id', 'product_id']);
        });

        // ---- Append-only stock movement ledger (audit trail for every unit change) ----
        Schema::create('stock_movements', function (Blueprint $t) {
            $t->id();
            $t->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $t->foreignId('warehouse_id')->constrained('warehouses');
            $t->foreignId('stock_location_id')->nullable()->constrained('stock_locations')->nullOnDelete();
            $t->enum('type', [
                'receipt', 'sale', 'adjustment_in', 'adjustment_out',
                'transfer_in', 'transfer_out', 'return_in', 'damage',
                'cycle_count', 'reservation', 'release',
            ]);
            $t->integer('quantity');                 // signed: + adds, - removes
            $t->bigInteger('unit_cost_cents')->default(0);
            $t->integer('balance_after')->nullable(); // running on-hand after this move
            $t->string('reference_type', 96)->nullable(); // e.g. SalesOrder, PurchaseOrder
            $t->unsignedBigInteger('reference_id')->nullable();
            $t->string('reason', 191)->nullable();
            $t->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('created_at')->nullable();
            $t->index(['product_id', 'warehouse_id']);
            $t->index(['reference_type', 'reference_id']);
            $t->index('type');
        });

        // ---- Serial number tracking ----
        Schema::create('serial_numbers', function (Blueprint $t) {
            $t->id();
            $t->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $t->string('serial', 128);
            $t->foreignId('warehouse_id')->nullable()->constrained('warehouses')->nullOnDelete();
            $t->enum('status', ['in_stock', 'allocated', 'shipped', 'returned', 'scrapped'])->default('in_stock');
            $t->foreignId('lot_batch_id')->nullable();
            $t->timestamps();
            $t->unique(['product_id', 'serial']);
            $t->index('status');
        });

        // ---- Lot / batch tracking with expiry ----
        Schema::create('lot_batches', function (Blueprint $t) {
            $t->id();
            $t->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $t->string('lot_number', 96);
            $t->date('manufactured_date')->nullable();
            $t->date('expiry_date')->nullable();
            $t->integer('quantity')->default(0);
            $t->timestamps();
            $t->unique(['product_id', 'lot_number']);
            $t->index('expiry_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lot_batches');
        Schema::dropIfExists('serial_numbers');
        Schema::dropIfExists('stock_movements');
        Schema::dropIfExists('inventory_levels');
        Schema::dropIfExists('product_images');
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE products DROP INDEX ft_products');
        }
        Schema::table('products', function (Blueprint $t) {
            $t->dropConstrainedForeignId('category_id');
            $t->dropColumn([
                'barcode', 'qr_code', 'condition', 'unit_of_measure', 'default_cost_cents',
                'reorder_point', 'reorder_quantity', 'max_stock', 'valuation_method',
                'track_serial', 'track_lot', 'track_expiry', 'weight', 'dimensions',
                'is_active', 'primary_image_path',
            ]);
        });
        Schema::dropIfExists('stock_locations');
        Schema::dropIfExists('warehouses');
        Schema::dropIfExists('categories');
    }
};
