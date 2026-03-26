import type { MessageResponse } from "../../shared/messages";
import { broadcastEvent } from "../broadcast";
import {
  ensureConnectedOriginsLoaded,
  getConnectedOrigins,
  isOriginConnected,
  removeConnectedOrigin,
} from "../connected-origins";

export async function handleGetConnectedSites(): Promise<MessageResponse> {
  await ensureConnectedOriginsLoaded();
  return { ok: true, data: { origins: getConnectedOrigins() } };
}

export async function handleRevokeConnectedOrigin(origin: string): Promise<MessageResponse> {
  await ensureConnectedOriginsLoaded();
  if (!isOriginConnected(origin)) {
    return { ok: true, data: undefined };
  }
  await removeConnectedOrigin(origin);
  broadcastEvent("accountsChanged", []);
  return { ok: true, data: undefined };
}
