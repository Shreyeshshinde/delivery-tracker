"use client";

import { useEffect, useState } from "react";
import RoleGuard from "@/components/RoleGuard";
import Navbar from "@/components/Navbar";
import { api, ApiError } from "@/lib/api";
import { Zone } from "@/lib/types";

interface RateCard {
  id: string;
  zone_from_id: string;
  zone_to_id: string;
  order_type: string;
  base_fee: number;
  rate_per_kg: number;
  effective_from: string;
  effective_to: string;
}

function ZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(true);

  const [newZoneName, setNewZoneName] = useState("");
  const [creatingZone, setCreatingZone] = useState(false);

  const [pincodeZoneId, setPincodeZoneId] = useState("");
  const [pincodeInput, setPincodeInput] = useState("");
  const [assigningPincode, setAssigningPincode] = useState(false);

  const [rcForm, setRcForm] = useState({
    zone_from_id: "", zone_to_id: "", order_type: "b2c",
    base_fee: "", rate_per_kg: "", effective_from: "", effective_to: "",
  });
  const [creatingRateCard, setCreatingRateCard] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [zonesData, rcData] = await Promise.all([
        api.get<Zone[]>("/zones"),
        api.get<RateCard[]>("/rate-cards"),
      ]);
      setZones(zonesData);
      setRateCards(rcData);
    } catch {
      // no-op
    } finally {
      setLoading(false);
    }
  }

  async function createZone(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreatingZone(true);
    try {
      await api.post("/zones", { name: newZoneName });
      setNewZoneName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create zone");
    } finally {
      setCreatingZone(false);
    }
  }

  async function assignPincodes(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAssigningPincode(true);
    try {
      const pincodes = pincodeInput.split(",").map((p) => p.trim()).filter(Boolean);
      await api.post(`/zones/${pincodeZoneId}/pincodes`, { pincodes });
      setPincodeInput("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not assign pincodes");
    } finally {
      setAssigningPincode(false);
    }
  }

  async function createRateCard(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreatingRateCard(true);
    try {
      await api.post("/rate-cards", {
        zone_from_id: rcForm.zone_from_id,
        zone_to_id: rcForm.zone_to_id,
        order_type: rcForm.order_type,
        base_fee: parseFloat(rcForm.base_fee),
        rate_per_kg: parseFloat(rcForm.rate_per_kg),
        effective_from: rcForm.effective_from,
        effective_to: rcForm.effective_to,
      });
      setRcForm({
        zone_from_id: "", zone_to_id: "", order_type: "b2c",
        base_fee: "", rate_per_kg: "", effective_from: "", effective_to: "",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create rate card");
    } finally {
      setCreatingRateCard(false);
    }
  }

  function zoneName(id: string) {
    return zones.find((z) => z.id === id)?.name || "Unknown";
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <h1 className="text-xl font-semibold">Zones and rate cards</h1>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="font-medium mb-3">Create a zone</h2>
          <form onSubmit={createZone} className="flex gap-2">
            <input
              placeholder="e.g. East Zone"
              value={newZoneName}
              onChange={(e) => setNewZoneName(e.target.value)}
              required
              className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
            <button
              disabled={creatingZone}
              className="bg-slate-900 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {creatingZone ? "Creating..." : "Create"}
            </button>
          </form>
          <div className="flex flex-wrap gap-2 mt-4">
            {zones.map((z) => (
              <span key={z.id} className="text-xs bg-slate-100 px-2 py-1 rounded-full">
                {z.name}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="font-medium mb-3">Assign pincodes to a zone</h2>
          <form onSubmit={assignPincodes} className="space-y-3">
            <select
              value={pincodeZoneId}
              onChange={(e) => setPincodeZoneId(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Select a zone</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
            <input
              placeholder="Comma-separated pincodes, e.g. 411001, 411002"
              value={pincodeInput}
              onChange={(e) => setPincodeInput(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
            <button
              disabled={assigningPincode}
              className="bg-slate-900 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {assigningPincode ? "Assigning..." : "Assign"}
            </button>
          </form>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="font-medium mb-3">Create a rate card</h2>
          <form onSubmit={createRateCard} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <select
                value={rcForm.zone_from_id}
                onChange={(e) => setRcForm((f) => ({ ...f, zone_from_id: e.target.value }))}
                required
                className="border border-slate-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">From zone</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
              <select
                value={rcForm.zone_to_id}
                onChange={(e) => setRcForm((f) => ({ ...f, zone_to_id: e.target.value }))}
                required
                className="border border-slate-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">To zone</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <select
                value={rcForm.order_type}
                onChange={(e) => setRcForm((f) => ({ ...f, order_type: e.target.value }))}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="b2c">B2C</option>
                <option value="b2b">B2B</option>
              </select>
              <input
                type="number"
                placeholder="Base fee"
                value={rcForm.base_fee}
                onChange={(e) => setRcForm((f) => ({ ...f, base_fee: e.target.value }))}
                required
                className="border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
              <input
                type="number"
                placeholder="Rate per kg"
                value={rcForm.rate_per_kg}
                onChange={(e) => setRcForm((f) => ({ ...f, rate_per_kg: e.target.value }))}
                required
                className="border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Effective from</label>
                <input
                  type="date"
                  value={rcForm.effective_from}
                  onChange={(e) => setRcForm((f) => ({ ...f, effective_from: e.target.value }))}
                  required
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Effective to</label>
                <input
                  type="date"
                  value={rcForm.effective_to}
                  onChange={(e) => setRcForm((f) => ({ ...f, effective_to: e.target.value }))}
                  required
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              disabled={creatingRateCard}
              className="bg-slate-900 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {creatingRateCard ? "Creating..." : "Create rate card"}
            </button>
          </form>

          {!loading && rateCards.length > 0 && (
            <div className="mt-6 space-y-2">
              {rateCards.map((rc) => (
                <div key={rc.id} className="text-sm border border-slate-200 rounded-md p-3 flex justify-between">
                  <span>
                    {zoneName(rc.zone_from_id)} to {zoneName(rc.zone_to_id)} ({rc.order_type.toUpperCase()})
                  </span>
                  <span className="text-slate-500">
                    Rs {rc.base_fee} + Rs {rc.rate_per_kg}/kg
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <RoleGuard allowed={["admin"]}>
      <ZonesPage />
    </RoleGuard>
  );
}
