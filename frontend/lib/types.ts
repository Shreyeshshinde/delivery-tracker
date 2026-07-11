export type UserRole = "customer" | "agent" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export type OrderStatus =
  | "created" | "assigned" | "picked_up" | "in_transit"
  | "out_for_delivery" | "delivered" | "failed" | "rescheduled";

export interface Order {
  id: string;
  customer_id: string;
  created_by_id: string;
  pickup_address: string;
  drop_address: string;
  pickup_zone_id: string;
  drop_zone_id: string;
  length_cm: number;
  breadth_cm: number;
  height_cm: number;
  actual_weight_kg: number;
  volumetric_weight_kg: number;
  billable_weight_kg: number;
  order_type: "b2b" | "b2c";
  payment_type: "prepaid" | "cod";
  charge: number;
  agent_id: string | null;
  current_status: OrderStatus;
  created_at: string;
}

export interface StatusHistoryEntry {
  id: string;
  order_id: string;
  status: OrderStatus;
  actor_id: string;
  actor_role: string;
  note: string | null;
  created_at: string;
}

export interface Zone {
  id: string;
  name: string;
}

export interface Agent {
  id: string;
  user_id: string;
  current_zone_id: string | null;
  current_lat: number | null;
  current_lng: number | null;
  is_available: boolean;
  active_order_count: number;
}

export interface OrderQuote {
  pickup_zone_name: string;
  drop_zone_name: string;
  volumetric_weight_kg: number;
  billable_weight_kg: number;
  base_fee: number;
  weight_charge: number;
  cod_surcharge: number;
  total_charge: number;
}