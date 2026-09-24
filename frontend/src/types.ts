export interface User {
  id: number;
  name: string;
  email: string;
}

export interface EventItem {
  id: number;
  name: string;
  venue: string;
  event_time: string;
  rows: number;
  cols: number;
  price: string;
}

export type SeatStatus = "available" | "locked" | "booked";

export interface Seat {
  id: number;
  row_label: string;
  col_number: number;
  label: string;
  status: SeatStatus;
  locked_by_me: boolean;
}

export interface SeatMapResponse {
  event: EventItem;
  seats: Seat[];
}

export interface WsMessage {
  type: "seat_locked" | "seat_released" | "seat_booked";
  seat_id: number;
  user_id?: number;
}
