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
  onMessage(message: ChatMessage): void;
  onReset(): void;
}

class ChatHub {
  private subscribers = new Set<ChatSubscriber>();
  private client: Client | null = null;
  private connecting = false;
  private retryMs = 1000;

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
      client.on("notification", (n) => void this.fanOut(Number(n.payload)));
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
    client.removeAllListeners();
    client.end().catch(() => {});
    if (this.client === client) this.client = null;
    // retry while anyone's listening; the next subscriber starts it otherwise
    if (this.subscribers.size === 0) return;
    const wait = this.retryMs;
    this.retryMs = Math.min(wait * 2, 30_000);
    setTimeout(() => void this.listen(), wait).unref();
  }

  private async fanOut(id: number) {
    if (!Number.isFinite(id) || this.subscribers.size === 0) return;
    const found = await getChatForFanout(id).catch(() => null);
    if (!found) return;
    for (const s of this.subscribers) if (found.memberIds.includes(s.memberId)) s.onMessage(found.message);
  }
}

// one per process, surviving the dev server's module reloads
const globalForHub = globalThis as unknown as { chatHub?: ChatHub };
export const chatHub = (globalForHub.chatHub ??= new ChatHub());
