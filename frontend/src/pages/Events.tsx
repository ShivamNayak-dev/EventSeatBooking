import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { EventItem } from "../types";

const emptyForm = { name: "", venue: "", event_time: "", rows: 6, cols: 8, price: "" };

export default function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function fetchEvents() {
    api
      .get<EventItem[]>("/events")
      .then((res) => setEvents(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchEvents();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/events", {
        name: form.name,
        venue: form.venue,
        event_time: new Date(form.event_time).toISOString(),
        rows: Number(form.rows),
        cols: Number(form.cols),
        price: Number(form.price),
      });
      setForm(emptyForm);
      setShowForm(false);
      fetchEvents();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Could not create event.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this event? This also removes its bookings.")) return;
    await api.delete(`/events/${id}`);
    fetchEvents();
  }

  if (loading) return <p className="text-center mt-16 text-slate-500">Loading events...</p>;

  return (
    <div className="max-w-3xl mx-auto mt-10 px-4 pb-16">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Upcoming Events</h1>
        {user?.is_admin && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="px-4 py-2 text-sm rounded bg-slate-900 text-white hover:bg-slate-700"
          >
            {showForm ? "Cancel" : "+ Create Event"}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-5 rounded-xl shadow-sm mb-6 space-y-3">
          <input
            required
            placeholder="Event name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="Venue"
            value={form.venue}
            onChange={(e) => setForm({ ...form, venue: e.target.value })}
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <input
            required
            type="datetime-local"
            value={form.event_time}
            onChange={(e) => setForm({ ...form, event_time: e.target.value })}
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-3 gap-3">
            <input
              required
              type="number"
              min={1}
              max={26}
              placeholder="Rows"
              value={form.rows}
              onChange={(e) => setForm({ ...form, rows: Number(e.target.value) })}
              className="border rounded px-3 py-2 text-sm"
            />
            <input
              required
              type="number"
              min={1}
              max={30}
              placeholder="Seats per row"
              value={form.cols}
              onChange={(e) => setForm({ ...form, cols: Number(e.target.value) })}
              className="border rounded px-3 py-2 text-sm"
            />
            <input
              required
              type="number"
              min={0}
              placeholder="Price (₹)"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="border rounded px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green-600 text-white rounded py-2 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Event"}
          </button>
        </form>
      )}

      <div className="grid gap-4">
        {events.map((event) => (
          <div key={event.id} className="bg-white p-5 rounded-xl shadow-sm hover:shadow-md transition">
            <div className="flex justify-between items-start">
              <Link to={`/events/${event.id}`} className="flex-1">
                <h2 className="font-semibold text-lg">{event.name}</h2>
                <p className="text-slate-500 text-sm">{event.venue}</p>
                <p className="text-slate-400 text-xs mt-1">
                  {new Date(event.event_time).toLocaleString()}
                </p>
              </Link>
              <div className="flex items-center gap-3">
                <span className="font-medium text-slate-800">₹{event.price}</span>
                {user?.is_admin && (
                  <button
                    onClick={() => handleDelete(event.id)}
                    className="text-red-500 hover:text-red-700 text-xs border border-red-200 rounded px-2 py-1"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {events.length === 0 && (
          <p className="text-slate-500 text-sm">
            No events yet {user?.is_admin ? '— use "Create Event" above.' : "— check back soon."}
          </p>
        )}
      </div>
    </div>
  );
}