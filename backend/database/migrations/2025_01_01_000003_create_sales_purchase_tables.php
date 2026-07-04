<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_orders', function (Blueprint $t) {
            $t->id();
            $t->string('po_number', 24)->unique();
            $t->foreignId('vendor_id')->nullable()->constrained('vendors')->nullOnDelete();
            $t->enum('status', ['draft', 'ordered', 'received', 'cancelled'])->default('draft');
            $t->bigInteger('subtotal_cents')->default(0);
            $t->bigInteger('tax_cents')->default(0);
            $t->bigInteger('grand_total_cents')->default(0);
            $t->date('ordered_date')->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->softDeletes();
            $t->index('status');
        });

        Schema::create('purchase_order_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('purchase_order_id')->constrained('purchase_orders')->cascadeOnDelete();
            $t->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $t->string('product_name', 191);
            $t->enum('condition', ['new', 'used', 'refurbished'])->default('new');
            $t->unsignedInteger('quantity')->default(1);
            $t->bigInteger('unit_cost_cents')->default(0);
            $t->bigInteger('tax_cents')->default(0);
            $t->bigInteger('line_total_cents')->default(0);
            $t->timestamps();
        });

        Schema::create('sales_orders', function (Blueprint $t) {
            $t->id();
            $t->string('so_number', 24)->unique();
            $t->foreignId('customer_id')->constrained('customers');
            $t->enum('order_type', ['regular', 'dropship'])->default('regular');
            $t->enum('status', ['draft', 'confirmed', 'shipped', 'delivered', 'cancelled'])->default('draft');
            $t->string('resource', 96)->nullable();
            $t->string('resource_order_id', 96)->nullable();
            $t->string('alternate_id', 96)->nullable();
            $t->string('payment_method', 64)->nullable();
            $t->string('transaction_id', 96)->nullable();
            $t->date('payment_date')->nullable();
            $t->string('payment_comment', 255)->nullable();
            $t->bigInteger('subtotal_cents')->default(0);
            $t->bigInteger('shipping_cents')->default(0);
            $t->bigInteger('tax_cents')->default(0);
            $t->bigInteger('grand_total_cents')->default(0);
            $t->foreignId('linked_po_id')->nullable()->constrained('purchase_orders')->nullOnDelete();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->softDeletes();
            $t->index('status');
            $t->index('created_at');
        });

        Schema::create('sales_order_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('sales_order_id')->constrained('sales_orders')->cascadeOnDelete();
            $t->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $t->string('product_name', 191);
            $t->enum('condition', ['new', 'used', 'refurbished'])->default('new');
            $t->enum('line_type', ['ds', 'rg'])->default('rg');
            $t->unsignedInteger('quantity')->default(1);
            $t->bigInteger('unit_cost_cents')->default(0);
            $t->bigInteger('line_total_cents')->default(0);
            $t->timestamps();
        });

        Schema::create('shipments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('sales_order_id')->unique()->constrained('sales_orders')->cascadeOnDelete();
            $t->enum('carrier', ['USPS', 'UPS', 'FedEx'])->nullable();
            $t->string('tracking_number', 96)->nullable();
            $t->enum('status', ['pending', 'shipped', 'delivered'])->default('pending');
            $t->string('ship_from_name', 191)->nullable();
            $t->string('ship_from_address', 191)->default('21043 Warrender Terrace Ln');
            $t->string('ship_from_city', 96)->default('Richmond');
            $t->string('ship_from_state', 32)->default('TX');
            $t->string('ship_from_zip', 16)->default('77407');
            $t->timestamp('shipped_at')->nullable();
            $t->timestamp('delivered_at')->nullable();
            $t->timestamps();
            $t->index('tracking_number');
        });

        Schema::create('invoices', function (Blueprint $t) {
            $t->id();
            $t->string('invoice_number', 24)->unique();
            $t->foreignId('sales_order_id')->unique()->constrained('sales_orders')->cascadeOnDelete();
            $t->date('issued_date');
            $t->bigInteger('subtotal_cents')->default(0);
            $t->bigInteger('tax_cents')->default(0);
            $t->bigInteger('shipping_cents')->default(0);
            $t->bigInteger('total_cents')->default(0);
            $t->string('pdf_path', 255)->nullable();
            $t->timestamps();
        });

        Schema::create('activity_log', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('action', 32);
            $t->string('subject_type', 96);
            $t->unsignedBigInteger('subject_id');
            $t->json('changes_json')->nullable();
            $t->string('ip_address', 45)->nullable();
            $t->timestamp('created_at')->nullable();
            $t->index(['subject_type', 'subject_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_log');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('shipments');
        Schema::dropIfExists('sales_order_items');
        Schema::dropIfExists('sales_orders');
        Schema::dropIfExists('purchase_order_items');
        Schema::dropIfExists('purchase_orders');
    }
};
