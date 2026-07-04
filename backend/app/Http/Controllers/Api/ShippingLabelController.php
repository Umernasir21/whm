<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SalesOrder;
use Barryvdh\DomPDF\Facade\Pdf;

/**
 * Renders a 4×6-style shipping label PDF for a sales order's shipment
 * (Fig 9 / §3.7): ship-from (default Richmond, TX), ship-to, carrier, and
 * tracking number. Streamed inline so it prints straight from the browser.
 */
class ShippingLabelController extends Controller
{
    public function download(SalesOrder $salesOrder)
    {
        $salesOrder->loadMissing(['customer', 'shipment']);

        abort_if(! $salesOrder->shipment, 404, 'No shipment on this order yet.');

        $pdf = Pdf::loadView('labels.template', [
            'order' => $salesOrder,
            'shipment' => $salesOrder->shipment,
            'customer' => $salesOrder->customer,
        ])->setPaper([0, 0, 288, 432]); // 4in × 6in @ 72dpi

        return $pdf->stream("label-{$salesOrder->so_number}.pdf");
    }
}
