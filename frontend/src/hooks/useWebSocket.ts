import { useEffect, useRef } from "react";
import type { WsMessage } from "../types";

const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || "ws://localhost:8000";

/**
 * Opens a WebSocket connection to /ws/events/{eventId} and invokes
 * onMessage for every seat_locked / seat_released / seat_booked event
 * broadcast by the backend. Auto-reconnects with a short backoff if the
 * connection drops (e.g. brief network blip).
 */
export function useSeatWebSocket(eventId: number, onMessage: (msg: WsMessage) => void) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    let socket: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let closedByUs = false;

    function connect() {
      socket = new WebSocket(`${WS_BASE_URL}/ws/events/${eventId}`);

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WsMessage;
          onMessageRef.current(data);
        } catch {
          // ignore malformed messages
        }
      };

      socket.onclose = () => {
        if (!closedByUs) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };
    }

    connect();

    return () => {
      closedByUs = true;
      clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [eventId]);
}
