<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Product;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Locks in the access-control rules the product owner requested:
 *  • staff users' names are stamped on records they create (activity_log)
 *  • only admins can delete
 *  • only admins can view the activity log
 * Plus the core sales-order flow (auto SO#, profit).
 */
class AccessControlTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    private function admin(): User
    {
        return User::where('email', 'admin@wms.com')->firstOrFail();
    }

    private function staff(): User
    {
        return User::where('email', 'abdullah@wms.com')->firstOrFail();
    }

    public function test_seeded_staff_and_admin_have_correct_roles(): void
    {
        $this->assertFalse($this->staff()->isAdmin());
        $this->assertTrue($this->admin()->isAdmin());
        $this->assertSame('Abdullah', $this->staff()->name);
    }

    public function test_staff_action_is_attributed_by_name_in_activity_log(): void
    {
        Sanctum::actingAs($this->staff());

        $this->postJson('/api/v1/customers', [
            'first_name' => 'Test', 'email' => 'test-cust@example.com',
            'shipping_address1' => '1 St', 'shipping_city' => 'Austin',
            'shipping_state' => 'TX', 'shipping_zip' => '73301', 'shipping_country' => 'USA',
        ])->assertCreated();

        $this->assertDatabaseHas('activity_log', [
            'user_id' => $this->staff()->id,
            'action' => 'created',
            'subject_type' => Customer::class,
        ]);
    }

    public function test_staff_cannot_delete_but_admin_can(): void
    {
        $product = Product::create(['sku' => 'DEL-TEST', 'name' => 'Deletable']);

        Sanctum::actingAs($this->staff());
        $this->deleteJson("/api/v1/products/{$product->id}")->assertForbidden();

        Sanctum::actingAs($this->admin());
        $this->deleteJson("/api/v1/products/{$product->id}")->assertNoContent();
    }

    public function test_only_admin_can_view_activity_logs(): void
    {
        Sanctum::actingAs($this->staff());
        $this->getJson('/api/v1/activity-logs')->assertForbidden();

        Sanctum::actingAs($this->admin());
        $this->getJson('/api/v1/activity-logs')->assertOk()->assertJsonStructure(['data']);
    }

    public function test_sales_order_creates_with_auto_number_and_profit(): void
    {
        Sanctum::actingAs($this->staff());
        $customer = Customer::first();

        $res = $this->postJson('/api/v1/sales-orders', [
            'customer_id' => $customer->id,
            'shipping' => 10, 'tax' => 5, 'buy_tax' => 3,
            'items' => [
                ['product_name' => 'Thing', 'quantity' => 2, 'unit_cost' => 100, 'buy_cost' => 40, 'line_type' => 'rg'],
            ],
        ])->assertCreated();

        $res->assertJsonPath('data.totals.subtotal', 200);
        $res->assertJsonPath('data.totals.po_before_tax', 80);
        $res->assertJsonPath('data.totals.po_after_tax', 83);
        $res->assertJsonPath('data.totals.profit', 120);
        $this->assertStringStartsWith('SO-', $res->json('data.so_number'));
    }
}
