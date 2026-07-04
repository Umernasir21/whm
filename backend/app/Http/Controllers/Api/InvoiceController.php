<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\InvoiceResource;
use App\Models\Invoice;
use App\Models\SalesOrder;
use App\Services\InvoiceService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class InvoiceController extends Controller
{
    public function __construct(private InvoiceService $service) {}

    /** Paginated list of generated invoices with SO + customer. */
    public function index(Request $request)
    {
        $q = Invoice::query()->with(['salesOrder.customer'])->latest();

        if ($term = $request->query('q')) {
            $q->where('invoice_number', 'like', "%{$term}%")
              ->orWhereHas('salesOrder', fn ($s) => $s->where('so_number', 'like', "%{$term}%"));
        }

        return $q->paginate($request->integer('per_page', 20))
            ->through(fn ($inv) => [
                'id' => $inv->id,
                'invoice_number' => $inv->invoice_number,
                'so_number' => $inv->salesOrder?->so_number,
                'customer' => trim(($inv->salesOrder?->customer?->first_name ?? '') . ' ' . ($inv->salesOrder?->customer?->last_name ?? '')),
                'issued_date' => $inv->issued_date,
                'total' => $inv->total_cents,
                'pdf_url' => $inv->pdf_path ? url("/api/invoices/{$inv->id}/download") : null,
            ]);
    }

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
