<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\InvoiceResource;
use App\Models\Invoice;
use App\Models\SalesOrder;
use App\Services\InvoiceService;
use Illuminate\Support\Facades\Storage;

class InvoiceController extends Controller
{
    public function __construct(private InvoiceService $service) {}

    public function generate(SalesOrder $salesOrder)
    {
        abort_unless(request()->user()->hasPermission('invoices.create'), 403);
        $invoice = $this->service->generate($salesOrder);

        return new InvoiceResource($invoice);
    }

    public function download(Invoice $invoice)
    {
        abort_if(! $invoice->pdf_path, 404, 'Invoice PDF not generated yet.');

        return Storage::disk(config('filesystems.default'))
            ->download($invoice->pdf_path, "{$invoice->invoice_number}.pdf");
    }
}
