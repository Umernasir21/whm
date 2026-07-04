<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: DejaVu Sans, sans-serif; color: #000; font-size: 13px; }
    .label { border: 2px solid #000; width: 100%; }
    .row { border-bottom: 2px solid #000; padding: 10px 14px; }
    .carrier { background: #000; color: #fff; padding: 12px 14px; font-size: 22px; font-weight: 700; letter-spacing: 1px; }
    .carrier .svc { float: right; font-size: 13px; font-weight: 400; margin-top: 6px; }
    .cap { font-size: 10px; letter-spacing: 1px; color: #444; text-transform: uppercase; margin-bottom: 4px; }
    .big { font-size: 16px; font-weight: 700; }
    .tracking { text-align: center; padding: 14px; }
    .tracking .num { font-size: 20px; font-weight: 700; letter-spacing: 2px; margin-top: 6px; }
    .barcode { margin: 10px auto 0; height: 54px; width: 92%;
        background: repeating-linear-gradient(90deg, #000 0 2px, #fff 2px 4px, #000 4px 5px, #fff 5px 9px); }
</style>
</head>
<body>
    <div class="label">
        <div class="carrier">
            {{ $shipment->carrier ?? 'CARRIER' }}
            <span class="svc">{{ strtoupper($order->order_type) }} · {{ ucfirst($shipment->status ?? 'pending') }}</span>
        </div>

        <div class="row">
            <div class="cap">Ship From</div>
            <div>
                {{ $shipment->ship_from_name ?? 'Warehouse Fulfillment' }}<br>
                {{ $shipment->ship_from_address ?? '21043 Warrender Terrace Ln' }}<br>
                {{ $shipment->ship_from_city ?? 'Richmond' }},
                {{ $shipment->ship_from_state ?? 'TX' }}
                {{ $shipment->ship_from_zip ?? '77407' }}
            </div>
        </div>

        <div class="row">
            <div class="cap">Ship To</div>
            <div class="big">{{ $customer->shipping_name ?? ($customer->first_name.' '.$customer->last_name) }}</div>
            <div>
                {{ $customer->shipping_address1 }}<br>
                @if($customer->shipping_address2){{ $customer->shipping_address2 }}<br>@endif
                {{ $customer->shipping_city }}, {{ $customer->shipping_state }} {{ $customer->shipping_zip }}<br>
                {{ $customer->shipping_country }}
            </div>
        </div>

        <div class="row" style="border-bottom:none">
            <div class="tracking">
                <div class="cap">Tracking Number — Order {{ $order->so_number }}</div>
                <div class="num">{{ $shipment->tracking_number ?? '—' }}</div>
                <div class="barcode"></div>
            </div>
        </div>
    </div>
</body>
</html>
