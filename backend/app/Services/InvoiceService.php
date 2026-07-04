<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\SalesOrder;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class InvoiceService
{
    public function __construct(private SequenceService $sequences) {}

    /** Generate (or return existing) invoice for a sales order + render its PDF. */
    public function generate(SalesOrder $order): Invoice
    {
        return DB::transaction(function () use ($order) {
            $order->loadMissing(['customer', 'items']);

            $invoice = $order->invoice()->firstOrCreate(
                [],
                [
                    'invoice_number' => $this->sequences->next('invoice'),
                    'issued_date' => now()->toDateString(),
                    'subtotal_cents' => $order->subtotal_cents,
                    'tax_cents' => $order->tax_cents,
                    'shipping_cents' => $order->shipping_cents,
                    'total_cents' => $order->grand_total_cents,
                ]
            );

            $pdf = Pdf::loadView('invoices.template', [
                'invoice' => $invoice,
                'order' => $order,
                'customer' => $order->customer,
            ])->setPaper('a4');

            $path = "invoices/{$invoice->invoice_number}.pdf";
            Storage::disk(config('filesystems.default'))->put($path, $pdf->output());

            $invoice->update(['pdf_path' => $path]);

            return $invoice;
        });
    }
}
