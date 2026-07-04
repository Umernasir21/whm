<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ProfitService;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function __construct(
        private ProfitService $profit,
        private ReportService $reports,
    ) {}

    private function authorize(Request $request): void
    {
        abort_unless($request->user()->hasPermission('reports.view'), 403);
    }

    public function profit(Request $request): JsonResponse
    {
        $this->authorize($request);

        return response()->json($this->profit->summary($request->query('from'), $request->query('to')));
    }

    public function sales(Request $request): JsonResponse
    {
        $this->authorize($request);

        return response()->json($this->reports->salesSummary($request->query('from'), $request->query('to')));
    }

    public function purchases(Request $request): JsonResponse
    {
        $this->authorize($request);

        return response()->json($this->reports->purchaseSummary($request->query('from'), $request->query('to')));
    }

    public function inventoryValuation(Request $request): JsonResponse
    {
        $this->authorize($request);

        return response()->json($this->reports->inventoryValuation());
    }

    public function stockMovement(Request $request): JsonResponse
    {
        $this->authorize($request);

        return response()->json($this->reports->stockMovementAnalysis($request->integer('days', 90)));
    }

    public function topCustomers(Request $request): JsonResponse
    {
        $this->authorize($request);

        return response()->json($this->reports->topCustomers($request->integer('limit', 10)));
    }

    public function topVendors(Request $request): JsonResponse
    {
        $this->authorize($request);

        return response()->json($this->reports->topVendors($request->integer('limit', 10)));
    }
}
