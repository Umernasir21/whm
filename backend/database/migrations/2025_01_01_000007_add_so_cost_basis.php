<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sales-order cost basis so the form can show "PO Before Tax" / "PO After Tax"
 * (Fig 1–2): a per-line purchase (buy) cost and an order-level buy tax. COGS and
 * profit already live on sales_orders (migration 000006) and are populated here.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales_order_items', function (Blueprint $t) {
            $t->bigInteger('buy_cost_cents')->default(0)->after('unit_cost_cents');
        });
        Schema::table('sales_orders', function (Blueprint $t) {
            $t->bigInteger('buy_tax_cents')->default(0)->after('cost_of_goods_cents');
        });
    }

    public function down(): void
    {
        Schema::table('sales_order_items', fn (Blueprint $t) => $t->dropColumn('buy_cost_cents'));
        Schema::table('sales_orders', fn (Blueprint $t) => $t->dropColumn('buy_tax_cents'));
    }
};
