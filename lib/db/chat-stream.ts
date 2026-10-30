import { Client } from "pg";
import type { ChatMessage } from "@/lib/types";
import { CHAT_CHANNEL, getChatForFanout } from "./chat";

/* What keeps every open app current as chat is written. One Postgres
   connection per server process LISTENs on CHAT_CHANNEL; every write in
   lib/db/chat.ts NOTIFYs it with the message's id (in its own transaction,
   so only a committed write is announced, whichever server instance made it).
   This hands the message on to the streams (app/api/chat/stream) of the
   members of its circle, and no one else: membership is read at that moment,
   so someone who has just left stops hearing at once.

   A NOTIFY is lost if the listening connection is down when it's sent, so a
   reconnect tells every stream (`onReset`) to catch up from the last version
   it sent, the same as a client that reconnects its own stream. */

export interface ChatSubscriber {
  memberId: number;
  // `fresh`: a message just written, rather than one that changed
  onMessage(message: ChatMessage, fresh: boolean): void;
  onReset(): void;
}

// a client that stops saying it's still looking is taken to have gone
const VIEWING_TTL_MS = 2 * 60_000;
// what one member can make the hub remember, since the report comes from a browser
const VIEWING_CLIENTS_MAX = 10;
const VIEWING_CIRCLES_MAX = 20;

class ChatHub {
  private subscribers = new Set<ChatSubscriber>();
  // member -> client -> the threads it's showing right now, and until when
  private viewing = new Map<number, Map<string, { circleIds: Set<string>; until: number }>>();

  /* A client (one open copy of the app) says which threads it has on screen,
     visibly, or none. Chat pushes skip a member who's already reading the
     thread. Per process, so with several instances a push may still go to
     someone reading on another one: a spare notice, never a missed one. */
  setViewing(memberId: number, clientId: string, circleIds: string[]): void {
    const clients = this.viewing.get(memberId) ?? new Map();
    const now = Date.now();
    for (const [id, c] of clients) if (c.until < now) clients.delete(id);
    if (circleIds.length === 0) clients.delete(clientId);
    else if (clients.has(clientId) || clients.size < VIEWING_CLIENTS_MAX) {
      clients.set(clientId, { circleIds: new Set(circleIds.slice(0, VIEWING_CIRCLES_MAX)), until: now + VIEWING_TTL_MS });
    }
    if (clients.size === 0) this.viewing.delete(memberId);
    else this.viewing.set(memberId, clients);
  }

  isViewing(memberId: number, circleId: string): boolean {
    const clients = this.viewing.get(memberId);
    if (!clients) return false;
    const now = Date.now();
    for (const [id, c] of clients) {
      if (c.until < now) clients.delete(id);
      else if (c.circleIds.has(circleId)) return true;
    }
    if (clients.size === 0) this.viewing.delete(memberId);
    return false;
  }

  private client: Client | null = null;
  private connecting = false;
  private retryMs = 1000;
  // connections already given up on, so a second report of the same loss is ignored
  private gone = new WeakSet<Client>();

  subscribe(subscriber: ChatSubscriber): () => void {
    this.subscribers.add(subscriber);
    void this.listen();
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  private async listen() {
    if (this.client || this.connecting) return;
    this.connecting = true;
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      client.on("notification", (n) => void this.fanOut(n.payload ?? ""));
      client.on("error", () => this.lost(client));
      client.on("end", () => this.lost(client));
      await client.connect();
      await client.query(`LISTEN ${CHAT_CHANNEL}`);
      this.client = client;
      const reconnected = this.retryMs > 1000;
      this.retryMs = 1000;
      // anything sent while it was down was missed
      if (reconnected) for (const s of this.subscribers) s.onReset();
    } catch {
      this.lost(client);
    } finally {
      this.connecting = false;
    }
  }

  private lost(client: Client) {
    if (this.gone.has(client)) return;
    this.gone.add(client);
    // a dead connection may still raise an error, which must not go unhandled
    client.removeAllListeners();
    client.on("error", () => {});
    client.end().catch(() => {});
    if (this.client === client) this.client = null;
    // retry while anyone's listening; the next subscriber starts it otherwise
    if (this.subscribers.size === 0) return;
    const wait = this.retryMs;
    this.retryMs = Math.min(wait * 2, 30_000);
    setTimeout(() => void this.listen(), wait).unref();
  }

  // the payload is a message's id, with ":u" when it changed rather than was written
  private async fanOut(payload: string) {
    const id = Number.parseInt(payload, 10);
    const fresh = !payload.endsWith(":u");
    if (!Number.isFinite(id) || this.subscribers.size === 0) return;
    const found = await getChatForFanout(id).catch(() => null);
    if (!found) return;
    for (const s of this.subscribers) if (found.memberIds.includes(s.memberId)) s.onMessage(found.message, fresh);
  }
}

// one per process, surviving the dev server's module reloads
const globalForHub = globalThis as unknown as { chatHub?: ChatHub };
export const chatHub = (globalForHub.chatHub ??= new ChatHub());
