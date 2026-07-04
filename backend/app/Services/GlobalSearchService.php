<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\SalesOrder;
use App\Models\Shipment;
use App\Models\Vendor;

/**
 * Cross-entity global search. Returns a flat, typed, link-ready result set so
 * the frontend command-palette can render mixed results instantly.
 */
class GlobalSearchService
{
    public function search(string $term, int $perType = 5): array
    {
        $like = "%{$term}%";
        $results = [];

        foreach (Product::where('name', 'like', $like)->orWhere('sku', 'like', $like)
            ->orWhere('barcode', 'like', $like)->limit($perType)->get() as $p) {
            $results[] = ['type' => 'product', 'id' => $p->id, 'title' => $p->name, 'subtitle' => $p->sku, 'link' => "/products/{$p->id}"];
        }

        foreach (Customer::search($term)->limit($perType)->get() as $c) {
            $results[] = ['type' => 'customer', 'id' => $c->id, 'title' => trim("{$c->first_name} {$c->last_name}"), 'subtitle' => $c->email, 'link' => "/customers/{$c->id}"];
        }

        foreach (SalesOrder::search($term)->limit($perType)->get() as $so) {
            $results[] = ['type' => 'sales_order', 'id' => $so->id, 'title' => $so->so_number, 'subtitle' => ucfirst($so->status), 'link' => "/sales-orders/{$so->id}"];
        }

        foreach (PurchaseOrder::where('po_number', 'like', $like)->limit($perType)->get() as $po) {
            $results[] = ['type' => 'purchase_order', 'id' => $po->id, 'title' => $po->po_number, 'subtitle' => ucfirst($po->status), 'link' => "/purchase-orders/{$po->id}"];
        }

        foreach (Vendor::where('name', 'like', $like)->orWhere('email', 'like', $like)->limit($perType)->get() as $v) {
            $results[] = ['type' => 'vendor', 'id' => $v->id, 'title' => $v->name, 'subtitle' => $v->email, 'link' => "/vendors/{$v->id}"];
        }

        foreach (Shipment::where('tracking_number', 'like', $like)->limit($perType)->get() as $s) {
            $results[] = ['type' => 'shipment', 'id' => $s->id, 'title' => $s->tracking_number, 'subtitle' => "{$s->carrier} · {$s->status}", 'link' => "/sales-orders/{$s->sales_order_id}"];
        }

        return $results;
    }
}
