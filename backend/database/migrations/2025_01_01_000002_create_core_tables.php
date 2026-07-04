<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sequences', function (Blueprint $t) {
            $t->id();
            $t->string('key_name', 32)->unique();
            $t->string('prefix', 8);
            $t->unsignedBigInteger('next_value')->default(1);
            $t->unsignedTinyInteger('pad_length')->default(5);
        });

        Schema::create('customers', function (Blueprint $t) {
            $t->id();
            $t->string('first_name', 96);
            $t->string('last_name', 96)->nullable();
            $t->string('complete_name', 191)->nullable();
            $t->string('company_name', 191)->nullable();
            $t->string('email', 191);
            $t->string('phone', 48)->nullable();
            $t->string('buyer_id', 96)->nullable();
            $t->string('shipping_name', 191)->nullable();
            $t->string('shipping_address1', 191)->nullable();
            $t->string('shipping_address2', 191)->nullable();
            $t->string('shipping_city', 96)->nullable();
            $t->string('shipping_state', 96)->nullable();
            $t->string('shipping_zip', 24)->nullable();
            $t->string('shipping_country', 96)->nullable();
            $t->timestamps();
            $t->softDeletes();
            $t->index('email');
            $t->index(['first_name', 'last_name']);
        });
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE customers ADD FULLTEXT ft_customers (first_name, last_name, complete_name, company_name, email)');
        }

        Schema::create('vendors', function (Blueprint $t) {
            $t->id();
            $t->string('name', 191);
            $t->string('email', 191)->nullable();
            $t->string('phone', 48)->nullable();
            $t->string('address1', 191)->nullable();
            $t->string('city', 96)->nullable();
            $t->string('state', 96)->nullable();
            $t->string('zip', 24)->nullable();
            $t->string('country', 96)->nullable();
            $t->timestamps();
            $t->softDeletes();
            $t->index('name');
        });

        Schema::create('products', function (Blueprint $t) {
            $t->id();
            $t->string('sku', 64)->unique();
            $t->string('name', 191);
            $t->text('description')->nullable();
            $t->bigInteger('default_price_cents')->default(0);
            $t->timestamps();
            $t->softDeletes();
            $t->index('name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
        Schema::dropIfExists('vendors');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('sequences');
    }
};
