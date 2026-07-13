"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RoleGuard from "@/components/RoleGuard";
import Navbar from "@/components/Navbar";
import { api, ApiError } from "@/lib/api";
import { Order, OrderQuote } from "@/lib/types";

const emptyForm = {
  pickup_address: "",
  drop_address: "",
  pickup_pincode: "",
  drop_pincode: "",
  length_cm: "",
  breadth_cm: "",
  height_cm: "",
  actual_weight_kg: "",
  order_type: "b2c",
  payment_type: "prepaid",
};

const STATUS_STYLES: Record<string, string> = {
  created: "bg-ink/5 text-slate border-line",
  assigned: "bg-signal/10 text-signal-dark border-signal/30",
  picked_up: "bg-signal/10 text-signal-dark border-signal/30",
  in_transit: "bg-signal/10 text-signal-dark border-signal/30",
  out_for_delivery: "bg-signal/10 text-signal-dark border-signal/30",
  delivered: "bg-success/10 text-success border-success/30",
  failed: "bg-danger/10 text-danger border-danger/30",
  rescheduled: "bg-ink/5 text-slate border-line",
};

function CustomerDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [quote, setQuote] = useState<OrderQuote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [quoting, setQuoting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoadingOrders(true);
    try {
      const data = await api.get<Order[]>("/orders");
      setOrders(data);
    } catch {
      // no-op
    } finally {
      setLoadingOrders(false);
    }
  }

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setQuote(null);
  }

  function buildQuoteBody() {
    return {
      pickup_pincode: form.pickup_pincode,
      drop_pincode: form.drop_pincode,
      length_cm: parseFloat(form.length_cm),
      breadth_cm: parseFloat(form.breadth_cm),
      height_cm: parseFloat(form.height_cm),
      actual_weight_kg: parseFloat(form.actual_weight_kg),
      order_type: form.order_type,
      payment_type: form.payment_type,
    };
  }

  async function getQuote() {
    setQuoteError("");
    setQuoting(true);
    setQuote(null);
    try {
      const data = await api.post<OrderQuote>("/orders/quote", buildQuoteBody());
      setQuote(data);
    } catch (err) {
      setQuoteError(err instanceof ApiError ? err.message : "Could not get a quote");
    } finally {
      setQuoting(false);
    }
  }

  async function confirmOrder() {
    setCreateError("");
    setCreating(true);
    try {
      const order = await api.post<Order>("/orders", {
        pickup_address: form.pickup_address,
        drop_address: form.drop_address,
        ...buildQuoteBody(),
      });
      setOrders((o) => [order, ...o]);
      setForm(emptyForm);
      setQuote(null);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Could not create order");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-baseline justify-between mb-8">
          <div>
            <h1 className="font-display font-bold text-xl text-ink">New shipment</h1>
            <p className="text-sm text-slate mt-0.5">Get a rate, confirm, and track it door to door</p>
          </div>
          <div className="font-[family-name:var(--font-plex-mono)] text-xs text-slate">
            {orders.length} order{orders.length !== 1 ? "s" : ""} on file
          </div>
        </div>

        {/* Quote / create form */}
        <div className="bg-white border border-line rounded-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-signal" />
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wide font-medium text-slate mb-1.5">
                  Pickup address
                </label>
                <input
                  value={form.pickup_address}
                  onChange={(e) => update("pickup_address", e.target.value)}
                  className="w-full border border-line rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal focus:border-signal"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide font-medium text-slate mb-1.5">
                  Pickup pincode
                </label>
                <input
                  value={form.pickup_pincode}
                  onChange={(e) => update("pickup_pincode", e.target.value)}
                  className="w-full border border-line rounded-sm px-3 py-2 text-sm font-[family-name:var(--font-plex-mono)] focus:outline-none focus:ring-2 focus:ring-signal focus:border-signal"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide font-medium text-slate mb-1.5">
                  Drop address
                </label>
                <input
                  value={form.drop_address}
                  onChange={(e) => update("drop_address", e.target.value)}
                  className="w-full border border-line rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal focus:border-signal"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide font-medium text-slate mb-1.5">
                  Drop pincode
                </label>
                <input
                  value={form.drop_pincode}
                  onChange={(e) => update("drop_pincode", e.target.value)}
                  className="w-full border border-line rounded-sm px-3 py-2 text-sm font-[family-name:var(--font-plex-mono)] focus:outline-none focus:ring-2 focus:ring-signal focus:border-signal"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs uppercase tracking-wide font-medium text-slate mb-1.5">
                  Length cm
                </label>
                <input
                  type="number"
                  value={form.length_cm}
                  onChange={(e) => update("length_cm", e.target.value)}
                  className="w-full border border-line rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal focus:border-signal"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide font-medium text-slate mb-1.5">
                  Breadth cm
                </label>
                <input
                  type="number"
                  value={form.breadth_cm}
                  onChange={(e) => update("breadth_cm", e.target.value)}
                  className="w-full border border-line rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal focus:border-signal"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide font-medium text-slate mb-1.5">
                  Height cm
                </label>
                <input
                  type="number"
                  value={form.height_cm}
                  onChange={(e) => update("height_cm", e.target.value)}
                  className="w-full border border-line rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal focus:border-signal"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide font-medium text-slate mb-1.5">
                  Weight kg
                </label>
                <input
                  type="number"
                  value={form.actual_weight_kg}
                  onChange={(e) => update("actual_weight_kg", e.target.value)}
                  className="w-full border border-line rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal focus:border-signal"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wide font-medium text-slate mb-1.5">
                  Order type
                </label>
                <select
                  value={form.order_type}
                  onChange={(e) => update("order_type", e.target.value)}
                  className="w-full border border-line rounded-sm px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-signal focus:border-signal"
                >
                  <option value="b2c">B2C</option>
                  <option value="b2b">B2B</option>
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide font-medium text-slate mb-1.5">
                  Payment type
                </label>
                <select
                  value={form.payment_type}
                  onChange={(e) => update("payment_type", e.target.value)}
                  className="w-full border border-line rounded-sm px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-signal focus:border-signal"
                >
                  <option value="prepaid">Prepaid</option>
                  <option value="cod">Cash on delivery</option>
                </select>
              </div>
            </div>

            {quoteError && (
              <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-sm px-3 py-2">
                {quoteError}
              </p>
            )}

            {!quote && (
              <button
                onClick={getQuote}
                disabled={quoting}
                className="border border-ink text-ink rounded-sm px-4 py-2 text-sm font-medium hover:bg-ink hover:text-paper transition-colors disabled:opacity-50"
              >
                {quoting ? "Calculating..." : "Get rate"}
              </button>
            )}

            {quote && (
              <div className="border border-line rounded-sm bg-paper">
                <div className="px-4 py-2 border-b border-dashed border-line font-[family-name:var(--font-plex-mono)] text-xs text-slate uppercase tracking-wide">
                  {quote.pickup_zone_name} → {quote.drop_zone_name}
                </div>
                <div className="p-4 space-y-1.5 font-[family-name:var(--font-plex-mono)] text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate">Billable weight</span>
                    <span>{quote.billable_weight_kg} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate">Base fee</span>
                    <span>₹{quote.base_fee}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate">Weight charge</span>
                    <span>₹{quote.weight_charge}</span>
                  </div>
                  {quote.cod_surcharge > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate">COD surcharge</span>
                      <span>₹{quote.cod_surcharge}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base border-t border-line pt-2 mt-2 text-ink">
                    <span className="font-[family-name:var(--font-inter)]">Total</span>
                    <span>₹{quote.total_charge}</span>
                  </div>
                </div>

                {createError && (
                  <div className="px-4 pb-2">
                    <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-sm px-3 py-2">
                      {createError}
                    </p>
                  </div>
                )}

                <div className="p-4 pt-0">
                  <button
                    onClick={confirmOrder}
                    disabled={creating}
                    className="w-full bg-signal text-ink rounded-sm py-2.5 text-sm font-bold hover:bg-signal-dark hover:text-paper transition-colors disabled:opacity-50"
                  >
                    {creating ? "Placing order..." : "Confirm shipment"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Orders list */}
        <div className="mt-10">
          <h2 className="font-display font-bold text-base text-ink mb-4">Your shipments</h2>

          {loadingOrders && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-line/30 rounded-sm animate-pulse" />
              ))}
            </div>
          )}

          {!loadingOrders && orders.length === 0 && (
            <div className="border border-dashed border-line rounded-sm p-8 text-center">
              <p className="text-sm text-slate">No shipments yet — get a rate above to create your first one.</p>
            </div>
          )}

          <div className="space-y-2">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/customer/orders/${order.id}`}
                className="block bg-white border border-line rounded-sm p-4 hover:border-signal transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {order.pickup_address} → {order.drop_address}
                    </p>
                    <p className="font-[family-name:var(--font-plex-mono)] text-xs text-slate mt-1">
                      ₹{order.charge} · {order.billable_weight_kg}kg · {order.payment_type.toUpperCase()}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-wide font-medium px-2.5 py-1 rounded-sm border ${
                      STATUS_STYLES[order.current_status] || "bg-ink/5 text-slate border-line"
                    }`}
                  >
                    {order.current_status.replace(/_/g, " ")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <RoleGuard allowed={["customer"]}>
      <CustomerDashboard />
    </RoleGuard>
  );
}