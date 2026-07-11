"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RoleGuard from "@/components/RoleGuard";
import Navbar from "@/components/Navbar";
import { api, ApiError } from "@/lib/api";
import { Zone, Agent } from "@/lib/types";

function AdminDashboard() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [zonesData, agentsData] = await Promise.all([
        api.get<Zone[]>("/zones"),
        api.get<Agent[]>("/agents"),
      ]);
      setZones(zonesData);
      setAgents(agentsData);
    } catch {
      // no-op
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-xl font-semibold mb-6">Admin overview</h1>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-2xl font-semibold">{zones.length}</p>
            <p className="text-sm text-slate-400">Zones</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-2xl font-semibold">{agents.length}</p>
            <p className="text-sm text-slate-400">Agents</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-2xl font-semibold">
              {agents.filter((a) => a.is_available).length}
            </p>
            <p className="text-sm text-slate-400">Available now</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <Link
            href="/admin/orders"
            className="bg-white border border-slate-200 rounded-lg p-4 hover:border-slate-400 transition-colors"
          >
            <p className="font-medium">Manage orders</p>
            <p className="text-sm text-slate-400 mt-1">Filter, assign, and override order status</p>
          </Link>
          <Link
            href="/admin/zones"
            className="bg-white border border-slate-200 rounded-lg p-4 hover:border-slate-400 transition-colors"
          >
            <p className="font-medium">Zones & rate cards</p>
            <p className="text-sm text-slate-400 mt-1">Configure coverage areas and pricing</p>
          </Link>
        </div>

        <h2 className="text-lg font-semibold mb-4">Agents</h2>
        {loading && <p className="text-slate-400">Loading...</p>}
        <div className="space-y-2">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-white border border-slate-200 rounded-lg p-4 flex justify-between items-center"
            >
              <div>
                <p className="text-sm font-medium">
                  {zones.find((z) => z.id === agent.current_zone_id)?.name || "No zone"}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {agent.active_order_count} active order{agent.active_order_count !== 1 ? "s" : ""}
                </p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full font-medium ${
                  agent.is_available
                    ? "bg-green-100 text-green-700"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {agent.is_available ? "Available" : "Busy"}
              </span>
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
      <AdminDashboard />
    </RoleGuard>
  );
}