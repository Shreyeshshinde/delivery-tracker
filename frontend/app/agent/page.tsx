"use client";

import { useEffect, useState } from "react";
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

const STATUS_LABELS: Record<string, string> = {
  picked_up: "Picked up",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  failed: "Failed",
};

function AgentDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [agentProfile, setAgentProfile] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
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
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-semibold">Your deliveries</h1>
          {agentProfile && (
            <button
              onClick={toggleAvailability}
              className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                agentProfile.is_available
                  ? "bg-green-100 text-green-700"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {agentProfile.is_available ? "Available" : "Unavailable"} · click to toggle
            </button>
          )}
        </div>

        {!agentProfile && !loading && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm">
            You don't have an agent profile yet. Ask an admin to help set one up, or create one via the API with your assigned zone.
          </div>
        )}

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        {loading && <p className="text-slate-400">Loading...</p>}

        {!loading && activeOrders.length === 0 && (
          <p className="text-slate-400">No active deliveries assigned to you right now.</p>
        )}

        <div className="space-y-3">
          {activeOrders.map((order) => {
            const nextOptions = NEXT_STATUS[order.current_status] || [];
            return (
              <div
                key={order.id}
                className="bg-white border border-slate-200 rounded-lg p-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium">
                      {order.pickup_address} → {order.drop_address}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      ₹{order.charge} · {order.payment_type.toUpperCase()} ·{" "}
                      {order.billable_weight_kg}kg
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 capitalize">
                    {order.current_status.replace(/_/g, " ")}
                  </span>
                </div>

                {nextOptions.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    {nextOptions.map((status) => (
                      <button
                        key={status}
                        onClick={() => updateStatus(order.id, status)}
                        disabled={updatingId === order.id}
                        className={`text-sm px-3 py-1.5 rounded-md font-medium disabled:opacity-50 ${
                          status === "failed"
                            ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                            : "bg-slate-900 text-white hover:bg-slate-800"
                        }`}
                      >
                        {updatingId === order.id ? "Updating..." : STATUS_LABELS[status]}
                      </button>
                    ))}
                  </div>
                )}
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