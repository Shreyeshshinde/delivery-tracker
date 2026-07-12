"use client";

import { useEffect, useState } from "react";
import RoleGuard from "@/components/RoleGuard";
import Navbar from "@/components/Navbar";
import { api, ApiError } from "@/lib/api";
import { Order, OrderStatus, Zone, Agent } from "@/lib/types";

const ALL_STATUSES: OrderStatus[] = [
  "created", "assigned", "picked_up", "in_transit",
  "out_for_delivery", "delivered", "failed", "rescheduled",
];

function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");

  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [selectedAgentForAssign, setSelectedAgentForAssign] = useState("");
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [ordersData, zonesData, agentsData] = await Promise.all([
        api.get<Order[]>("/orders"),
        api.get<Zone[]>("/zones"),
        api.get<Agent[]>("/agents"),
      ]);
      setOrders(ordersData);
      setZones(zonesData);
      setAgents(agentsData);
    } catch {
      // no-op
    } finally {
      setLoading(false);
    }
  }

  function zoneName(id: string) {
    return zones.find((z) => z.id === id)?.name || "Unknown";
  }

  const filteredOrders = orders.filter((o) => {
    if (statusFilter && o.current_status !== statusFilter) return false;
    if (zoneFilter && o.pickup_zone_id !== zoneFilter) return false;
    if (agentFilter && o.agent_id !== agentFilter) return false;
    return true;
  });

  async function manualAssign(orderId: string) {
    if (!selectedAgentForAssign) return;
    setError("");
    setBusyOrderId(orderId);
    try {
      await api.post(`/orders/${orderId}/assign`, { agent_id: selectedAgentForAssign });
      setAssigningOrderId(null);
      setSelectedAgentForAssign("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not assign agent");
    } finally {
      setBusyOrderId(null);
    }
  }

  async function autoAssign(orderId: string) {
    setError("");
    setBusyOrderId(orderId);
    try {
      await api.post(`/orders/${orderId}/auto-assign`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not auto-assign");
    } finally {
      setBusyOrderId(null);
    }
  }

  async function overrideStatus(orderId: string, newStatus: OrderStatus) {
    setError("");
    setBusyOrderId(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { new_status: newStatus, note: "Admin override" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not override status");
    } finally {
      setBusyOrderId(null);
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-xl font-semibold mb-6">Manage orders</h1>

        <div className="flex gap-3 mb-6">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All pickup zones</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </select>
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{zoneName(a.current_zone_id || "")} agent</option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        {loading && <p className="text-slate-400">Loading...</p>}
        {!loading && filteredOrders.length === 0 && (
          <p className="text-slate-400">No orders match these filters.</p>
        )}

        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <div key={order.id} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium">
                    {order.pickup_address} to {order.drop_address}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {zoneName(order.pickup_zone_id)} to {zoneName(order.drop_zone_id)} · Rs {order.charge}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 capitalize">
                  {order.current_status.replace(/_/g, " ")}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                {order.current_status === "created" && (
                  <>
                    <button
                      onClick={() => autoAssign(order.id)}
                      disabled={busyOrderId === order.id}
                      className="text-xs px-3 py-1.5 rounded-md bg-slate-900 text-white font-medium disabled:opacity-50"
                    >
                      Auto-assign
                    </button>
                    <button
                      onClick={() => setAssigningOrderId(assigningOrderId === order.id ? null : order.id)}
                      className="text-xs px-3 py-1.5 rounded-md border border-slate-300 font-medium"
                    >
                      Manual assign
                    </button>
                  </>
                )}

                {assigningOrderId === order.id && (
                  <div className="w-full flex gap-2 mt-2">
                    <select
                      value={selectedAgentForAssign}
                      onChange={(e) => setSelectedAgentForAssign(e.target.value)}
                      className="border border-slate-300 rounded-md px-2 py-1 text-xs flex-1"
                    >
                      <option value="">Select an agent</option>
                      {agents.filter((a) => a.is_available).map((a) => (
                        <option key={a.id} value={a.id}>
                          {zoneName(a.current_zone_id || "")} agent ({a.active_order_count} active)
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => manualAssign(order.id)}
                      disabled={busyOrderId === order.id || !selectedAgentForAssign}
                      className="text-xs px-3 py-1 rounded-md bg-slate-900 text-white font-medium disabled:opacity-50"
                    >
                      Confirm
                    </button>
                  </div>
                )}

                <select
                  onChange={(e) => {
                    if (e.target.value) overrideStatus(order.id, e.target.value as OrderStatus);
                    e.target.value = "";
                  }}
                  disabled={busyOrderId === order.id}
                  defaultValue=""
                  className="text-xs px-2 py-1.5 rounded-md border border-slate-300"
                >
                  <option value="" disabled>Override status</option>
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <RoleGuard allowed={["admin"]}>
      <AdminOrdersPage />
    </RoleGuard>
  );
}