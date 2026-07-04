<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Operational + platform tables: multi-address customers, returns (RMA), credit
 * notes, purchase-order receiving, polymorphic notes/attachments, notifications,
 * login history, settings, saved filters, and an order-event timeline.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ---- Customer addresses (billing / shipping, many per customer) ----
        Schema::create('customer_addresses', function (Blueprint $t) {
            $t->id();
            $t->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $t->enum('type', ['billing', 'shipping'])->default('shipping');
            $t->string('name', 191)->nullable();
            $t->string('address1', 191);
            $t->string('address2', 191)->nullable();
            $t->string('city', 96);
            $t->string('state', 96);
            $t->string('zip', 24);
            $t->string('country', 96)->default('USA');
            $t->boolean('is_default')->default(false);
            $t->timestamps();
            $t->index(['customer_id', 'type']);
        });

        // ---- Customer tags (many-to-many) ----
        Schema::create('tags', function (Blueprint $t) {
            $t->id();
            $t->string('name', 64)->unique();
            $t->string('color', 16)->default('#64748b');
            $t->timestamps();
        });
        Schema::create('customer_tag', function (Blueprint $t) {
            $t->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $t->foreignId('tag_id')->constrained('tags')->cascadeOnDelete();
            $t->primary(['customer_id', 'tag_id']);
        });

        // ---- Returns / RMA ----
        Schema::create('returns', function (Blueprint $t) {
            $t->id();
            $t->string('rma_number', 24)->unique();
            $t->foreignId('sales_order_id')->nullable()->constrained('sales_orders')->nullOnDelete();
            $t->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $t->enum('status', [
                'requested', 'approved', 'rejected', 'inspecting',
                'restocked', 'refunded', 'replaced', 'closed',
            ])->default('requested');
            $t->enum('reason', [
                'defective', 'damaged', 'wrong_item', 'not_as_described',
                'no_longer_needed', 'other',
            ])->default('other');
            $t->enum('resolution', ['refund', 'replacement', 'store_credit', 'none'])->default('none');
            $t->text('notes')->nullable();
            $t->bigInteger('refund_cents')->default(0);
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->softDeletes();
            $t->index('status');
        });

        Schema::create('return_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('return_id')->constrained('returns')->cascadeOnDelete();
            $t->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $t->string('product_name', 191);
            $t->unsignedInteger('quantity')->default(1);
            $t->enum('condition', ['resellable', 'damaged', 'defective'])->default('resellable');
            $t->boolean('restock')->default(false);
            $t->bigInteger('unit_refund_cents')->default(0);
            $t->timestamps();
        });

        // ---- Credit notes ----
        Schema::create('credit_notes', function (Blueprint $t) {
            $t->id();
            $t->string('credit_number', 24)->unique();
            $t->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $t->foreignId('return_id')->nullable()->constrained('returns')->nullOnDelete();
            $t->bigInteger('amount_cents')->default(0);
            $t->bigInteger('applied_cents')->default(0);
            $t->enum('status', ['open', 'partially_applied', 'applied', 'void'])->default('open');
            $t->date('issued_date');
            $t->timestamps();
        });

        // ---- Purchase-order receiving (partial + full, discrepancies) ----
        Schema::create('po_receipts', function (Blueprint $t) {
            $t->id();
            $t->string('receipt_number', 24)->unique();
            $t->foreignId('purchase_order_id')->constrained('purchase_orders')->cascadeOnDelete();
            $t->foreignId('warehouse_id')->nullable()->constrained('warehouses')->nullOnDelete();
            $t->enum('status', ['draft', 'posted'])->default('draft');
            $t->text('notes')->nullable();
            $t->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('received_at')->nullable();
            $t->timestamps();
        });

        Schema::create('po_receipt_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('po_receipt_id')->constrained('po_receipts')->cascadeOnDelete();
            $t->foreignId('purchase_order_item_id')->nullable()->constrained('purchase_order_items')->nullOnDelete();
            $t->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $t->unsignedInteger('quantity_ordered')->default(0);
            $t->unsignedInteger('quantity_received')->default(0);
            $t->integer('discrepancy')->default(0); // received - ordered
            $t->foreignId('stock_location_id')->nullable()->constrained('stock_locations')->nullOnDelete();
            $t->timestamps();
        });

        // ---- Polymorphic notes (internal + customer-facing) ----
        Schema::create('notes', function (Blueprint $t) {
            $t->id();
            $t->string('notable_type', 96);
            $t->unsignedBigInteger('notable_id');
            $t->enum('visibility', ['internal', 'customer'])->default('internal');
            $t->text('body');
            $t->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index(['notable_type', 'notable_id']);
        });

        // ---- Polymorphic attachments / documents ----
        Schema::create('attachments', function (Blueprint $t) {
            $t->id();
            $t->string('attachable_type', 96);
            $t->unsignedBigInteger('attachable_id');
            $t->string('filename', 191);
            $t->string('path', 255);
            $t->string('mime', 96)->nullable();
            $t->unsignedBigInteger('size_bytes')->default(0);
            $t->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index(['attachable_type', 'attachable_id']);
        });

        // ---- Notifications (in-app) ----
        Schema::create('notifications', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->nullable()->constrained('users')->cascadeOnDelete();
            $t->string('type', 64);        // low_stock, order_shipped, return_requested...
            $t->string('title', 191);
            $t->text('body')->nullable();
            $t->string('link', 255)->nullable();
            $t->enum('level', ['info', 'success', 'warning', 'danger'])->default('info');
            $t->timestamp('read_at')->nullable();
            $t->timestamps();
            $t->index(['user_id', 'read_at']);
        });

        // ---- Login history / session audit ----
        Schema::create('login_history', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('email', 191);
            $t->boolean('successful')->default(true);
            $t->string('ip_address', 45)->nullable();
            $t->string('user_agent', 255)->nullable();
            $t->timestamp('created_at')->nullable();
            $t->index(['user_id', 'created_at']);
        });

        // ---- Settings (key/value app config) ----
        Schema::create('settings', function (Blueprint $t) {
            $t->id();
            $t->string('key', 96)->unique();
            $t->text('value')->nullable();
            $t->string('group', 48)->default('general');
            $t->timestamps();
        });

        // ---- Saved filters (per user, per module) ----
        Schema::create('saved_filters', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $t->string('module', 48);
            $t->string('name', 96);
            $t->json('criteria');
            $t->timestamps();
            $t->index(['user_id', 'module']);
        });

        // ---- Order event timeline (polymorphic across SO / PO / Return) ----
        Schema::create('order_events', function (Blueprint $t) {
            $t->id();
            $t->string('subject_type', 96);
            $t->unsignedBigInteger('subject_id');
            $t->string('event', 64);       // created, status_changed, shipped, note_added...
            $t->string('description', 255)->nullable();
            $t->json('meta')->nullable();
            $t->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('created_at')->nullable();
            $t->index(['subject_type', 'subject_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_events');
        Schema::dropIfExists('saved_filters');
        Schema::dropIfExists('settings');
        Schema::dropIfExists('login_history');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('attachments');
        Schema::dropIfExists('notes');
        Schema::dropIfExists('po_receipt_items');
        Schema::dropIfExists('po_receipts');
        Schema::dropIfExists('credit_notes');
        Schema::dropIfExists('return_items');
        Schema::dropIfExists('returns');
        Schema::dropIfExists('customer_tag');
        Schema::dropIfExists('tags');
        Schema::dropIfExists('customer_addresses');
    }
};
