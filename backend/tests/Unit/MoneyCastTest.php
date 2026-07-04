<?php

namespace Tests\Unit;

use App\Casts\Money;
use Illuminate\Database\Eloquent\Model;
use PHPUnit\Framework\TestCase;

/**
 * The Money cast is the backbone of all financial correctness — dollars in,
 * integer cents stored, dollars back out. These pure-unit checks need no DB.
 */
class MoneyCastTest extends TestCase
{
    private Money $cast;
    private Model $model;

    protected function setUp(): void
    {
        parent::setUp();
        $this->cast = new Money();
        $this->model = new class extends Model {};
    }

    public function test_dollars_are_stored_as_integer_cents(): void
    {
        // set() converts a dollar value to cents for the DB column.
        $this->assertSame(12999, $this->cast->set($this->model, 'price', 129.99, []));
        $this->assertSame(0, $this->cast->set($this->model, 'price', 0, []));
        $this->assertSame(500, $this->cast->set($this->model, 'price', 5, []));
    }

    public function test_cents_are_read_back_as_dollars(): void
    {
        // get() converts stored cents back to a dollar float.
        $this->assertSame(129.99, $this->cast->get($this->model, 'price', 12999, []));
        $this->assertSame(5.0, $this->cast->get($this->model, 'price', 500, []));
    }

    public function test_rounding_is_stable_for_awkward_values(): void
    {
        $this->assertSame(1010, $this->cast->set($this->model, 'price', 10.10, []));
        $this->assertSame(2999, $this->cast->set($this->model, 'price', 29.99, []));
    }
}
