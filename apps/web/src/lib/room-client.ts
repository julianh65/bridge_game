import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Command, GameView, PlayerID } from "@bridgefront/engine";

export type RoomConnectionStatus = "idle" | "connecting" | "connected" | "closed" | "error";

export type RoomOptions = {
  roomId: string;
  name: string;
  host?: string;
  party?: string;
  asSpectator?: boolean;
};

export type LobbyCommand = "rerollMap";

type RoomMessage =
  | {
      type: "welcome";
      playerId: PlayerID;
      seatIndex: number | null;
      rejoinToken?: string | null;
      view?: GameView | null;
      revision?: number;
    }
  | {
      type: "update";
      revision: number;
      events?: unknown[];
      view: GameView;
    }
  | { type: "error"; message: string }
  | { type: "connected"; roomId: string }
  | { type: string; [key: string]: unknown };

type RoomState = {
  status: RoomConnectionStatus;
  view: GameView | null;
  playerId: PlayerID | null;
  seatIndex: number | null;
  roomId: string | null;
  host: string | null;
  error: string | null;
  revision: number | null;
};

const DEFAULT_STATE: RoomState = {
  status: "idle",
  view: null,
  playerId: null,
  seatIndex: null,
  roomId: null,
  host: null,
  error: null,
  revision: null
};

const storageKeyForRoom = (roomId: string) => `bridgefront:room:${roomId}:rejoinToken`;

const loadRejoinToken = (roomId: string) => {
  try {
    return window.localStorage.getItem(storageKeyForRoom(roomId));
  } catch {
    return null;
  }
};

const storeRejoinToken = (roomId: string, token: string) => {
  try {
    window.localStorage.setItem(storageKeyForRoom(roomId), token);
  } catch {
    // Ignore storage failures.
  }
};

export const getDefaultPartyHost = () => {
  const envHost = import.meta.env.VITE_PARTYKIT_HOST as string | undefined;
  if (envHost) {
    return envHost;
  }
  if (typeof window !== "undefined") {
    const { hostname, port, host } = window.location;
    if (port && port !== "1999") {
      return `${hostname}:1999`;
    }
    return host || "localhost:1999";
  }
  return "localhost:1999";
};

const buildSocketUrl = (host: string, roomId: string, party?: string) => {
  const protocol =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "wss" : "ws";
  const path = party ? `/parties/${party}/${roomId}` : `/party/${roomId}`;
  return `${protocol}://${host}${path}`;
};

export const useRoom = (options: RoomOptions | null) => {
  const [state, setState] = useState<RoomState>(DEFAULT_STATE);
  const socketRef = useRef<WebSocket | null>(null);
  const seqRef = useRef(1);

  useEffect(() => {
    if (!options) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setState(DEFAULT_STATE);
      return undefined;
    }

    const host = options.host ?? getDefaultPartyHost();
    const url = buildSocketUrl(host, options.roomId, options.party);
    const socket = new WebSocket(url);
    socketRef.current = socket;
    seqRef.current = 1;

    setState((prev) => ({
      ...prev,
      status: "connecting",
      roomId: options.roomId,
      host,
      error: null
    }));

    const sendJoin = () => {
      const payload = {
        type: "join",
        name: options.name,
        rejoinToken: loadRejoinToken(options.roomId),
        asSpectator: options.asSpectator ?? false
      };
      socket.send(JSON.stringify(payload));
    };

    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data !== "string") {
        return;
      }
      let parsed: RoomMessage;
      try {
        parsed = JSON.parse(event.data) as RoomMessage;
      } catch {
        return;
      }

      if (parsed.type === "welcome") {
        if (typeof parsed.rejoinToken === "string" && parsed.rejoinToken.length > 0) {
          storeRejoinToken(options.roomId, parsed.rejoinToken);
        }
        setState((prev) => ({
          ...prev,
          status: "connected",
          playerId: parsed.playerId,
          seatIndex: parsed.seatIndex,
          view: parsed.view ?? null,
          revision: parsed.revision ?? prev.revision,
          error: null
        }));
        return;
      }

      if (parsed.type === "update") {
        setState((prev) => ({
          ...prev,
          status: "connected",
          view: parsed.view,
          revision: parsed.revision,
          error: null
        }));
        return;
      }

      if (parsed.type === "error") {
        setState((prev) => ({ ...prev, status: "error", error: parsed.message }));
      }
    };

    const handleOpen = () => {
      setState((prev) => ({ ...prev, status: "connected", error: null }));
      sendJoin();
    };

    const handleClose = () => {
      setState((prev) => ({ ...prev, status: "closed" }));
    };

    const handleError = () => {
      setState((prev) => ({ ...prev, status: "error", error: "Connection error" }));
    };

    socket.addEventListener("open", handleOpen);
    socket.addEventListener("message", handleMessage);
    socket.addEventListener("close", handleClose);
    socket.addEventListener("error", handleError);

    return () => {
      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("message", handleMessage);
      socket.removeEventListener("close", handleClose);
      socket.removeEventListener("error", handleError);
      socket.close();
    };
  }, [options?.roomId, options?.name, options?.host, options?.party, options?.asSpectator]);

  const sendCommand = useCallback(
    (command: Command) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN || !state.playerId) {
        return false;
      }

      const payload = {
        type: "command",
        playerId: state.playerId,
        clientSeq: seqRef.current,
        command
      };
      seqRef.current += 1;
      socket.send(JSON.stringify(payload));
      return true;
    },
    [state.playerId]
  );

  const sendLobbyCommand = useCallback(
    (command: LobbyCommand) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN || !state.playerId) {
        return false;
      }
      const payload = {
        type: "lobbyCommand",
        playerId: state.playerId,
        command
      };
      socket.send(JSON.stringify(payload));
      return true;
    },
    [state.playerId]
  );

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
  }, []);

  return useMemo(
    () => ({
      ...state,
      sendCommand,
      sendLobbyCommand,
      disconnect
    }),
    [state, sendCommand, sendLobbyCommand, disconnect]
  );
};
