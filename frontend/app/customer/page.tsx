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

function CustomerDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
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
    try {
      // There's no "list my orders" endpoint yet in the API — this is a
      // known gap we'll note. For now this stays empty until we add one.
    } catch {
      // no-op
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
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-xl font-semibold mb-6">Create a delivery order</h1>

        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Pickup address</label>
              <input
                value={form.pickup_address}
                onChange={(e) => update("pickup_address", e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Pickup pincode</label>
              <input
                value={form.pickup_pincode}
                onChange={(e) => update("pickup_pincode", e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Drop address</label>
              <input
                value={form.drop_address}
                onChange={(e) => update("drop_address", e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Drop pincode</label>
              <input
                value={form.drop_pincode}
                onChange={(e) => update("drop_pincode", e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Length (cm)</label>
              <input
                type="number"
                value={form.length_cm}
                onChange={(e) => update("length_cm", e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Breadth (cm)</label>
              <input
                type="number"
                value={form.breadth_cm}
                onChange={(e) => update("breadth_cm", e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Height (cm)</label>
              <input
                type="number"
                value={form.height_cm}
                onChange={(e) => update("height_cm", e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Weight (kg)</label>
              <input
                type="number"
                value={form.actual_weight_kg}
                onChange={(e) => update("actual_weight_kg", e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Order type</label>
              <select
                value={form.order_type}
                onChange={(e) => update("order_type", e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="b2c">B2C</option>
                <option value="b2b">B2B</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Payment type</label>
              <select
                value={form.payment_type}
                onChange={(e) => update("payment_type", e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="prepaid">Prepaid</option>
                <option value="cod">Cash on delivery</option>
              </select>
            </div>
          </div>

          {quoteError && <p className="text-sm text-red-600">{quoteError}</p>}

          {!quote && (
            <button
              onClick={getQuote}
              disabled={quoting}
              className="bg-white border border-slate-300 rounded-md px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              {quoting ? "Calculating..." : "Get quote"}
            </button>
          )}

          {quote && (
            <div className="border border-slate-200 rounded-md p-4 bg-slate-50 space-y-2">
              <p className="text-sm text-slate-500">
                {quote.pickup_zone_name} → {quote.drop_zone_name}
              </p>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Billable weight</span>
                  <span>{quote.billable_weight_kg} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Base fee</span>
                  <span>₹{quote.base_fee}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Weight charge</span>
                  <span>₹{quote.weight_charge}</span>
                </div>
                {quote.cod_surcharge > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">COD surcharge</span>
                    <span>₹{quote.cod_surcharge}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold border-t border-slate-200 pt-2 mt-2">
                  <span>Total</span>
                  <span>₹{quote.total_charge}</span>
                </div>
              </div>

              {createError && <p className="text-sm text-red-600">{createError}</p>}

              <button
                onClick={confirmOrder}
                disabled={creating}
                className="w-full bg-slate-900 text-white rounded-md py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 mt-2"
              >
                {creating ? "Placing order..." : "Confirm order"}
              </button>
            </div>
          )}
        </div>

        {orders.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-semibold mb-4">Your orders</h2>
            <div className="space-y-2">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/customer/orders/${order.id}`}
                  className="block bg-white border border-slate-200 rounded-lg p-4 hover:border-slate-400 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">
                        {order.pickup_address} → {order.drop_address}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">₹{order.charge}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 capitalize">
                      {order.current_status.replace(/_/g, " ")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
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