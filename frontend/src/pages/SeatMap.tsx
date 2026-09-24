import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSeatWebSocket } from "../hooks/useWebSocket";
import Seat from "../components/Seat";
import type { EventItem, Seat as SeatType, WsMessage } from "../types";

const LOCK_TTL_SECONDS = 300;

export default function SeatMap() {
  const { eventId } = useParams();
  const id = Number(eventId);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [seats, setSeats] = useState<SeatType[]>([]);
  const [mySeat, setMySeat] = useState<SeatType | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const fetchSeatMap = useCallback(() => {
    api.get(`/events/${id}/seats`).then((res) => {
      setEvent(res.data.event);
      setSeats(res.data.seats);
    });
  }, [id]);

  useEffect(() => {
    fetchSeatMap();
  }, [fetchSeatMap]);

  // Live updates from other users' actions on this event.
  const handleWsMessage = useCallback((msg: WsMessage) => {
    setSeats((prev) =>
      prev.map((s) => {
        if (s.id !== msg.seat_id) return s;
        if (msg.type === "seat_locked") return { ...s, status: "locked", locked_by_me: false };
        if (msg.type === "seat_released") return { ...s, status: "available", locked_by_me: false };
        if (msg.type === "seat_booked") return { ...s, status: "booked", locked_by_me: false };
        return s;
      })
    );
  }, []);
  useSeatWebSocket(id, handleWsMessage);

  // Countdown for the seat I'm currently holding.
  useEffect(() => {
    if (!mySeat) return;
    setSecondsLeft(LOCK_TTL_SECONDS);
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          setMySeat(null);
          fetchSeatMap();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [mySeat, fetchSeatMap]);

  async function handleSeatClick(seat: SeatType) {
    if (!user) {
      navigate("/login");
      return;
    }
    setError(null);

    if (seat.locked_by_me) {
      // Clicking your own held seat opens the confirm step (no-op here,
      // the "Confirm Booking" button below handles it).
      return;
    }

    try {
      await api.post(`/seats/${seat.id}/lock`);
      setMySeat(seat);
      setSeats((prev) =>
        prev.map((s) => (s.id === seat.id ? { ...s, status: "locked", locked_by_me: true } : s))
      );
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Could not hold that seat — try another.");
      fetchSeatMap();
    }
  }

  async function handleConfirm() {
    if (!mySeat) return;
    setConfirming(true);
    setError(null);
    try {
      await api.post("/bookings", { seat_id: mySeat.id });
      setConfirmed(true);
      setMySeat(null);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Booking failed — the seat may have been taken.");
      fetchSeatMap();
      setMySeat(null);
    } finally {
      setConfirming(false);
    }
  }

  async function handleCancelHold() {
    if (!mySeat) return;
    await api.delete(`/seats/${mySeat.id}/lock`);
    setSeats((prev) =>
      prev.map((s) => (s.id === mySeat.id ? { ...s, status: "available", locked_by_me: false } : s))
    );
    setMySeat(null);
  }

  const seatsByRow = useMemo(() => {
    const grouped: Record<string, SeatType[]> = {};
    for (const seat of seats) {
      grouped[seat.row_label] = grouped[seat.row_label] || [];
      grouped[seat.row_label].push(seat);
    }
    return grouped;
  }, [seats]);

  if (!event) return <p className="text-center mt-16 text-slate-500">Loading seat map...</p>;

  if (confirmed) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white p-8 rounded-xl shadow-sm text-center">
        <h1 className="text-xl font-bold text-green-700 mb-2">Booking Confirmed 🎉</h1>
        <p className="text-slate-600 text-sm mb-6">
          Your seat for <strong>{event.name}</strong> is booked.
        </p>
        <button
          onClick={() => navigate("/")}
          className="bg-slate-900 text-white rounded px-4 py-2 text-sm"
        >
          Back to events
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto mt-8 px-4 pb-16">
      <h1 className="text-2xl font-bold">{event.name}</h1>
      <p className="text-slate-500 text-sm mb-6">
        {event.venue} · ₹{event.price} per seat
      </p>

      <div className="flex gap-4 text-xs mb-4 text-slate-600">
        <Legend color="bg-seatAvailable" label="Available" />
        <Legend color="bg-seatLocked" label="Held by someone" />
        <Legend color="bg-seatMine" label="Held by you" />
        <Legend color="bg-seatBooked" label="Booked" />
      </div>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      <div className="bg-white rounded-xl shadow-sm p-6 overflow-x-auto">
        <div className="space-y-2 w-fit mx-auto">
          {Object.entries(seatsByRow).map(([row, rowSeats]) => (
            <div key={row} className="flex items-center gap-2">
              <span className="w-4 text-xs text-slate-400">{row}</span>
              <div className="flex gap-1.5">
                {rowSeats.map((seat) => (
                  <Seat key={seat.id} seat={seat} onClick={handleSeatClick} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="text-center text-xs text-slate-400 mt-6 border-t pt-3">SCREEN THIS WAY</div>
      </div>

      {mySeat && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                Holding seat {mySeat.label} — expires in {secondsLeft}s
              </p>
              <p className="text-xs text-slate-500">Confirm now to lock in your booking.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCancelHold}
                className="px-4 py-2 text-sm rounded bg-slate-100 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="px-4 py-2 text-sm rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {confirming ? "Confirming..." : "Confirm Booking"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded-sm ${color}`} />
      {label}
    </div>
  );
}
