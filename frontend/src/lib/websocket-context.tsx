"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { API_BASE, wsApi } from "@/lib/api";

export interface WebSocketEventEnvelope<T = any> {
  event: string;
  agency_id: string;
  timestamp: string;
  data: T;
}

type EventListener<T = any> = (envelope: WebSocketEventEnvelope<T>) => void;

interface WebSocketContextType {
  isConnected: boolean;
  subscribe: (eventType: string, listener: EventListener) => () => void;
  registerResyncHandler: (handler: () => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  agencyId?: string | null;
  token?: string | null;
  children: ReactNode;
}

export function WebSocketProvider({ agencyId, token, children }: WebSocketProviderProps) {
  const [isConnected, setIsConnected] = useState(false);

  // Active socket instance
  const wsRef = useRef<WebSocket | null>(null);

  // Listeners registry: eventType -> Set of callbacks
  const listenersRef = useRef<Map<string, Set<EventListener>>>(new Map());

  // Resync callbacks invoked on reconnection (to prevent UI drift after sleep/disconnect)
  const resyncHandlersRef = useRef<Set<() => void>>(new Set());

  // Flag tracking whether socket has connected at least once in this session
  const wasConnectedRef = useRef(false);

  // Reconnection backoff timer & attempt counter
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef(0);

  // Heartbeat ping timer
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe method for components
  const subscribe = useCallback((eventType: string, listener: EventListener) => {
    if (!listenersRef.current.has(eventType)) {
      listenersRef.current.set(eventType, new Set());
    }
    listenersRef.current.get(eventType)!.add(listener);

    return () => {
      const set = listenersRef.current.get(eventType);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          listenersRef.current.delete(eventType);
        }
      }
    };
  }, []);

  // Register re-sync handler invoked on re-connection
  const registerResyncHandler = useCallback((handler: () => void) => {
    resyncHandlersRef.current.add(handler);
    return () => {
      resyncHandlersRef.current.delete(handler);
    };
  }, []);

  useEffect(() => {
    // Flag to guard against React 18 StrictMode double-mount race conditions
    let isCancelled = false;

    if (!agencyId || !token) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const clearTimers = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };

    const connect = async () => {
      if (isCancelled) return;
      clearTimers();

      try {
        // 1. Mint a fresh 30-second single-use ticket before EVERY connect/reconnect attempt
        // (Never reuse an expired or GETDEL-consumed ticket)
        const ticketRes = await wsApi.getTicket(agencyId, token);
        if (isCancelled || !ticketRes.ticket) return;

        // 2. Derive WebSocket URL from API_BASE
        const baseUrl = API_BASE.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
        const wsUrl = `${baseUrl}/ws/agencies/${agencyId}?ticket=${ticketRes.ticket}`;

        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          if (isCancelled) {
            socket.close();
            return;
          }

          setIsConnected(true);
          reconnectAttemptRef.current = 0;

          // If this is a re-connection, trigger re-sync handlers
          if (wasConnectedRef.current) {
            resyncHandlersRef.current.forEach((handler) => {
              try {
                handler();
              } catch (err) {
                console.error("WebSocket resync handler error:", err);
              }
            });
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("agencyos:ws-reconnected"));
            }
          }
          wasConnectedRef.current = true;

          // Start 25s heartbeat keepalive
          heartbeatTimerRef.current = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send("ping");
            }
          }, 25000);
        };

        socket.onmessage = (event) => {
          if (isCancelled) return;
          if (event.data === "pong") return;

          try {
            const envelope: WebSocketEventEnvelope = JSON.parse(event.data);
            if (envelope && envelope.event) {
              // Dispatch to registered event listeners
              const specificListeners = listenersRef.current.get(envelope.event);
              if (specificListeners) {
                specificListeners.forEach((listener) => {
                  try {
                    listener(envelope);
                  } catch (err) {
                    console.error(`Error in WebSocket listener for ${envelope.event}:`, err);
                  }
                });
              }

              // Dispatch to wildcard "*" listeners
              const allListeners = listenersRef.current.get("*");
              if (allListeners) {
                allListeners.forEach((listener) => {
                  try {
                    listener(envelope);
                  } catch (err) {
                    console.error("Error in wildcard WebSocket listener:", err);
                  }
                });
              }

              // Also trigger window custom event for decoupled UI sync
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("agencyos:ws-event", { detail: envelope })
                );
              }
            }
          } catch (err) {
            console.error("Failed to parse incoming WebSocket message:", err);
          }
        };

        socket.onerror = (err) => {
          // Normal during brief network disconnects, handled in onclose
          console.debug("WebSocket connection error:", err);
        };

        socket.onclose = (event) => {
          if (isCancelled) return;

          setIsConnected(false);
          clearTimers();
          wsRef.current = null;

          // If closed by policy violation (1008), do not spam immediate reconnects
          const isPolicyViolation = event.code === 1008;
          const attempt = reconnectAttemptRef.current++;
          
          // Exponential backoff: 1s, 2s, 4s, 8s ... up to max 30s
          const delay = isPolicyViolation
            ? 5000
            : Math.min(1000 * Math.pow(2, attempt), 30000);

          reconnectTimerRef.current = setTimeout(() => {
            if (!isCancelled) {
              connect();
            }
          }, delay);
        };
      } catch (err) {
        if (isCancelled) return;
        setIsConnected(false);

        // Retry minting ticket and connecting
        const attempt = reconnectAttemptRef.current++;
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        reconnectTimerRef.current = setTimeout(() => {
          if (!isCancelled) {
            connect();
          }
        }, delay);
      }
    };

    connect();

    return () => {
      // Cleanup for unmount / React 18 StrictMode double-mount
      isCancelled = true;
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
    };
  }, [agencyId, token]);

  return (
    <WebSocketContext.Provider value={{ isConnected, subscribe, registerResyncHandler }}>
      {children}
    </WebSocketContext.Provider>
  );
}

/**
 * Hook to consume the WebSocket context.
 */
export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
}

/**
 * Stabilized component hook for listening to specific AgencyOS real-time events.
 * Uses a ref to store the latest callback so inline arrow functions never cause
 * un-subscribe/re-subscribe thrashing or stale closures.
 */
export function useAgencyWebSocket<T = any>(
  eventType: string,
  callback: (envelope: WebSocketEventEnvelope<T>) => void,
  onReconnect?: () => void
) {
  const { subscribe, registerResyncHandler, isConnected } = useWebSocket();

  // Stabilize the callback reference across renders
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;

  useEffect(() => {
    const unsubscribe = subscribe(eventType, (envelope) => {
      callbackRef.current(envelope);
    });
    return unsubscribe;
  }, [eventType, subscribe]);

  useEffect(() => {
    if (!onReconnectRef.current) return;
    const unregister = registerResyncHandler(() => {
      if (onReconnectRef.current) {
        onReconnectRef.current();
      }
    });
    return unregister;
  }, [registerResyncHandler]);

  return { isConnected };
}
