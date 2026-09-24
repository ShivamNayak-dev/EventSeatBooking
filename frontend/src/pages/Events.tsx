import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import type { EventItem } from "../types";

export default function Events() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<EventItem[]>("/events")
      .then((res) => setEvents(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-center mt-16 text-slate-500">Loading events...</p>;

  return (
    <div className="max-w-3xl mx-auto mt-10 px-4">
      <h1 className="text-2xl font-bold mb-6">Upcoming Events</h1>
      <div className="grid gap-4">
        {events.map((event) => (
          <Link
            key={event.id}
            to={`/events/${event.id}`}
            className="block bg-white p-5 rounded-xl shadow-sm hover:shadow-md transition"
          >
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-semibold text-lg">{event.name}</h2>
                <p className="text-slate-500 text-sm">{event.venue}</p>
                <p className="text-slate-400 text-xs mt-1">
                  {new Date(event.event_time).toLocaleString()}
                </p>
              </div>
              <span className="font-medium text-slate-800">₹{event.price}</span>
            </div>
          </Link>
        ))}
        {events.length === 0 && (
          <p className="text-slate-500 text-sm">
            No events yet — run the seed script (`python -m app.seed`) on the backend.
          </p>
        )}
      </div>
    </div>
  );
}
