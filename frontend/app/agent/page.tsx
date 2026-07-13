"use client";

import { useEffect, useState } from "react";
import { Truck, Package, PackageCheck, MapPin, CheckCircle2, XCircle, Radio } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import Navbar from "@/components/Navbar";
import { api, ApiError } from "@/lib/api";
import { Order, OrderStatus, Agent } from "@/lib/types";

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  assigned: ["picked_up"],
  picked_up: ["in_transit"],
  in_transit: ["out_for_delivery"],
  out_for_delivery: ["delivered", "failed"],
};

const STATUS_ACTIONS: Record<string, { label: string; icon: any }> = {
  picked_up: { label: "Mark picked up", icon: PackageCheck },
  in_transit: { label: "Mark in transit", icon: Truck },
  out_for_delivery: { label: "Out for delivery", icon: MapPin },
  delivered: { label: "Mark delivered", icon: CheckCircle2 },
  failed: { label: "Mark failed", icon: XCircle },
};

function AgentDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [agentProfile, setAgentProfile] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  async function load() {
    try {
      const [ordersData, profile] = await Promise.all([
        api.get<Order[]>("/orders"),
        api.get<Agent>("/agents/me").catch(() => null),
      ]);
      setOrders(ordersData);
      setAgentProfile(profile);
    } catch {
      // no-op
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(orderId: string, newStatus: OrderStatus) {
    setError("");
    setUpdatingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { new_status: newStatus });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update status");
    } finally {
      setUpdatingId(null);
    }
  }

  async function toggleAvailability() {
    if (!agentProfile) return;
    try {
      const updated = await api.patch<Agent>("/agents/me/availability", {
        is_available: !agentProfile.is_available,
      });
      setAgentProfile(updated);
    } catch {
      // no-op
    }
  }

  const activeOrders = orders.filter(
    (o) => !["delivered", "created"].includes(o.current_status)
  );

  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-ink flex items-center justify-center">
              <Truck size={18} className="text-signal" />
            </div>
            <div>
              <h1 className="font-display font-bold text-xl text-ink">Route board</h1>
              <p className="text-sm text-slate">Your assigned deliveries, live</p>
            </div>
          </div>

          {agentProfile && (
            <button
              onClick={toggleAvailability}
              className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-sm border transition-colors ${
                agentProfile.is_available
                  ? "bg-success/10 text-success border-success/30"
                  : "bg-ink/5 text-slate border-line"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${agentProfile.is_available ? "bg-success animate-pulse" : "bg-slate"}`} />
              {agentProfile.is_available ? "Available" : "Off duty"}
            </button>
          )}
        </div>

        {!agentProfile && !loading && (
          <div className="bg-white border border-dashed border-line rounded-sm p-6 mb-6 text-center">
            <Package className="mx-auto text-slate mb-2" size={24} />
            <p className="text-sm text-ink font-medium">No agent profile set up yet</p>
            <p className="text-xs text-slate mt-1">Ask an admin to assign you to a zone via the API.</p>
          </div>
        )}

        {error && (
          <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-sm px-3 py-2 mb-4">
            {error}
          </p>
        )}

        {loading && (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-20 bg-line/30 rounded-sm animate-pulse" />)}
          </div>
        )}

        {!loading && activeOrders.length === 0 && (
          <div className="border border-dashed border-line rounded-sm p-10 text-center">
            <Truck className="mx-auto text-slate mb-3" size={28} />
            <p className="text-sm text-slate">No active deliveries right now — new assignments will appear here.</p>
          </div>
        )}

        <div className="space-y-3">
          {activeOrders.map((order) => {
            const nextOptions = NEXT_STATUS[order.current_status] || [];
            return (
              <div key={order.id} className="bg-white border border-line rounded-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-signal" />
                <div className="p-4 pl-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {order.pickup_address} → {order.drop_address}
                      </p>
                      <p className="font-[family-name:var(--font-plex-mono)] text-xs text-slate mt-1">
                        ₹{order.charge} · {order.payment_type.toUpperCase()} · {order.billable_weight_kg}kg
                      </p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wide font-medium px-2.5 py-1 rounded-sm bg-signal/10 text-signal-dark border border-signal/30">
                      {order.current_status.replace(/_/g, " ")}
                    </span>
                  </div>

                  {nextOptions.length > 0 && (
                    <div className="flex gap-2 mt-3">
                      {nextOptions.map((status) => {
                        const action = STATUS_ACTIONS[status];
                        const Icon = action.icon;
                        return (
                          <button
                            key={status}
                            onClick={() => updateStatus(order.id, status)}
                            disabled={updatingId === order.id}
                            className={`inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-sm font-medium disabled:opacity-50 transition-colors ${
                              status === "failed"
                                ? "bg-danger/5 text-danger border border-danger/30 hover:bg-danger/10"
                                : "bg-ink text-paper hover:bg-ink-light"
                            }`}
                          >
                            <Icon size={13} />
                            {updatingId === order.id ? "Updating..." : action.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <RoleGuard allowed={["agent"]}>
      <AgentDashboard />
    </RoleGuard>
  );
}