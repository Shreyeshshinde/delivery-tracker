"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import RoleGuard from "@/components/RoleGuard";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import { Order, StatusHistoryEntry } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  created: "Order created",
  assigned: "Agent assigned",
  picked_up: "Picked up",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  failed: "Delivery failed",
  rescheduled: "Rescheduled",
};

function TrackingPage() {
  const params = useParams();
  const orderId = params.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [timeline, setTimeline] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [orderId]);

  async function load() {
    try {
      const [orderData, timelineData] = await Promise.all([
        api.get<Order>(`/orders/${orderId}`),
        api.get<StatusHistoryEntry[]>(`/orders/${orderId}/timeline`),
      ]);
      setOrder(orderData);
      setTimeline(timelineData);
    } catch {
      // no-op
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-2xl mx-auto px-6 py-8 text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-2xl mx-auto px-6 py-8 text-slate-400">Order not found.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-8">
        <Link href="/customer" className="text-sm text-slate-500 hover:text-slate-900">
          ← Back to orders
        </Link>

        <div className="bg-white border border-slate-200 rounded-lg p-6 mt-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium">{order.pickup_address}</p>
              <p className="text-sm text-slate-400 my-1">↓</p>
              <p className="font-medium">{order.drop_address}</p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 capitalize">
              {order.current_status.replace(/_/g, " ")}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6 text-sm">
            <div>
              <p className="text-slate-400">Charge</p>
              <p className="font-medium">₹{order.charge}</p>
            </div>
            <div>
              <p className="text-slate-400">Weight (billable)</p>
              <p className="font-medium">{order.billable_weight_kg} kg</p>
            </div>
            <div>
              <p className="text-slate-400">Payment</p>
              <p className="font-medium capitalize">{order.payment_type}</p>
            </div>
          </div>
        </div>

        <h2 className="text-lg font-semibold mt-8 mb-4">Tracking timeline</h2>
        <div className="space-y-4">
          {timeline.map((entry, idx) => (
            <div key={entry.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-2.5 h-2.5 rounded-full mt-1.5 ${
                    idx === timeline.length - 1 ? "bg-slate-900" : "bg-slate-300"
                  }`}
                />
                {idx < timeline.length - 1 && (
                  <div className="w-px flex-1 bg-slate-200 my-1" />
                )}
              </div>
              <div className="pb-4">
                <p className="text-sm font-medium">
                  {STATUS_LABELS[entry.status] || entry.status}
                </p>
                <p className="text-xs text-slate-400">
                  {new Date(entry.created_at).toLocaleString()} · {entry.actor_role}
                </p>
                {entry.note && (
                  <p className="text-xs text-slate-500 mt-1">{entry.note}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {order.current_status === "failed" && (
          <RescheduleForm orderId={order.id} onDone={load} />
        )}
      </div>
    </div>
  );
}

function RescheduleForm({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/orders/${orderId}/reschedule`, { new_date: date, reason });
      onDone();
    } catch {
      setError("Could not reschedule — try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-6 space-y-3">
      <p className="text-sm font-medium">This delivery failed — pick a new date</p>
      <input
        type="date"
        required
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
      />
      <input
        placeholder="Reason (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="bg-slate-900 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
      >
        {submitting ? "Rescheduling..." : "Reschedule"}
      </button>
    </form>
  );
}

export default function Page() {
  return (
    <RoleGuard allowed={["customer"]}>
      <TrackingPage />
    </RoleGuard>
  );
}