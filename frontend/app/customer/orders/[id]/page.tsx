"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Package, UserCheck, PackageCheck, Truck, MapPin,
  CheckCircle2, XCircle, CalendarClock, ArrowLeft, Radio,
} from "lucide-react";
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

const STEPPER_FLOW = ["created", "assigned", "picked_up", "in_transit", "out_for_delivery", "delivered"];

const STEP_ICONS: Record<string, any> = {
  created: Package,
  assigned: UserCheck,
  picked_up: PackageCheck,
  in_transit: Truck,
  out_for_delivery: MapPin,
  delivered: CheckCircle2,
};

function TrackingPage() {
  const params = useParams();
  const orderId = params.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [timeline, setTimeline] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

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
      setLastSynced(new Date());
    } catch {
      // no-op
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-paper">
        <Navbar />
        <div className="max-w-2xl mx-auto px-6 py-10 space-y-3">
          <div className="h-32 bg-line/30 rounded-sm animate-pulse" />
          <div className="h-48 bg-line/30 rounded-sm animate-pulse" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-paper">
        <Navbar />
        <div className="max-w-2xl mx-auto px-6 py-10 text-slate">Shipment not found.</div>
      </div>
    );
  }

  const currentStepIndex = STEPPER_FLOW.indexOf(order.current_status);
  const isFailedOrRescheduled = ["failed", "rescheduled"].includes(order.current_status);

  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link href="/customer" className="inline-flex items-center gap-1.5 text-sm text-slate hover:text-ink transition-colors mb-6">
          <ArrowLeft size={14} /> Back to shipments
        </Link>

        {/* Header card */}
        <div className="bg-white border border-line rounded-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-signal" />
          <div className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-ink">{order.pickup_address}</p>
                <p className="text-sm text-slate my-1">↓</p>
                <p className="font-medium text-ink">{order.drop_address}</p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-success font-medium">
                <Radio size={11} className="animate-pulse" />
                Live
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-dashed border-line font-[family-name:var(--font-plex-mono)] text-sm">
              <div>
                <p className="text-slate text-xs uppercase tracking-wide mb-0.5">Charge</p>
                <p className="font-medium text-ink">₹{order.charge}</p>
              </div>
              <div>
                <p className="text-slate text-xs uppercase tracking-wide mb-0.5">Weight</p>
                <p className="font-medium text-ink">{order.billable_weight_kg} kg</p>
              </div>
              <div>
                <p className="text-slate text-xs uppercase tracking-wide mb-0.5">Payment</p>
                <p className="font-medium text-ink">{order.payment_type.toUpperCase()}</p>
              </div>
            </div>

            {lastSynced && (
              <p className="font-[family-name:var(--font-plex-mono)] text-[10px] text-slate mt-4">
                Last synced {lastSynced.toLocaleTimeString()} · refreshes every 10s
              </p>
            )}
          </div>
        </div>

        {/* Horizontal stepper */}
        {!isFailedOrRescheduled && (
          <div className="bg-white border border-line rounded-sm mt-4 p-6">
            <div className="flex items-center">
              {STEPPER_FLOW.map((status, idx) => {
                const Icon = STEP_ICONS[status];
                const isDone = idx <= currentStepIndex;
                const isCurrent = idx === currentStepIndex;
                return (
                  <div key={status} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors ${
                          isDone
                            ? "bg-signal border-signal text-ink"
                            : "bg-white border-line text-slate"
                        } ${isCurrent ? "ring-4 ring-signal/20" : ""}`}
                      >
                        <Icon size={16} />
                      </div>
                      <span className={`text-[9px] uppercase tracking-wide text-center max-w-[60px] ${isDone ? "text-ink font-medium" : "text-slate"}`}>
                        {STATUS_LABELS[status].split(" ")[0]}
                      </span>
                    </div>
                    {idx < STEPPER_FLOW.length - 1 && (
                      <div className={`h-0.5 flex-1 mx-1 mb-4 transition-colors ${idx < currentStepIndex ? "bg-signal" : "bg-line"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isFailedOrRescheduled && (
          <div className="bg-white border border-line rounded-sm mt-4 p-6 flex items-center gap-3">
            {order.current_status === "failed" ? (
              <XCircle className="text-danger" size={24} />
            ) : (
              <CalendarClock className="text-slate" size={24} />
            )}
            <div>
              <p className="font-medium text-ink text-sm">{STATUS_LABELS[order.current_status]}</p>
              <p className="text-xs text-slate">See full history below for details</p>
            </div>
          </div>
        )}

        {/* Full timeline */}
        <h2 className="font-display font-bold text-base text-ink mt-8 mb-4">Full history</h2>
        <div className="bg-white border border-line rounded-sm p-6">
          {timeline.map((entry, idx) => (
            <div key={entry.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-2.5 h-2.5 rounded-full mt-1.5 ${
                    idx === timeline.length - 1 ? "bg-signal" : "bg-line"
                  }`}
                />
                {idx < timeline.length - 1 && (
                  <div className="w-px flex-1 bg-line my-1" style={{ minHeight: "24px" }} />
                )}
              </div>
              <div className="pb-5">
                <p className="text-sm font-medium text-ink">
                  {STATUS_LABELS[entry.status] || entry.status}
                </p>
                <p className="font-[family-name:var(--font-plex-mono)] text-[11px] text-slate mt-0.5">
                  {new Date(entry.created_at).toLocaleString()} · {entry.actor_role}
                </p>
                {entry.note && (
                  <p className="text-xs text-slate mt-1 bg-paper border border-line rounded-sm px-2 py-1 inline-block">
                    {entry.note}
                  </p>
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
    <form onSubmit={submit} className="bg-white border border-line rounded-sm mt-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-danger" />
      <div className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarClock size={16} className="text-danger" />
          <p className="text-sm font-medium text-ink">Reschedule this delivery</p>
        </div>
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border border-line rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal focus:border-signal"
        />
        <input
          placeholder="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full border border-line rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal focus:border-signal"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="bg-ink text-paper rounded-sm px-4 py-2 text-sm font-medium hover:bg-ink-light transition-colors disabled:opacity-50"
        >
          {submitting ? "Rescheduling..." : "Reschedule"}
        </button>
      </div>
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