import { Client } from "pg";

/* One Postgres connection per process that LISTENs on a channel and hands each
   NOTIFY's payload to whoever is subscribed: the machinery chat's hub has, for
   the next stream that wants it (see lib/db/meeting-stream.ts). Writers NOTIFY
   inside their own transaction, so only a committed write is announced,
   whichever server instance made it.

   A NOTIFY is lost if the listening connection is down when it's sent, so a
   reconnect tells every subscriber (`onReset`) to read afresh. A socket killed
   by a NAT or load balancer raises no error, so the connection is asked
   something now and then and given up on if it doesn't answer. */

export interface PgSubscriber {
  onPayload(payload: string): void;
  onReset(): void;
}

const PROBE_MS = 30_000;
const PROBE_TIMEOUT_MS = 10_000;

export class PgListener {
  private subscribers = new Set<PgSubscriber>();
  private client: Client | null = null;
  private connecting = false;
  private retryMs = 1000;
  // connections already given up on, so a second report of the same loss is ignored
  private gone = new WeakSet<Client>();
  private keepalive: ReturnType<typeof setInterval> | null = null;

  // the channel is a fixed name of ours, never member input
  constructor(private channel: string) {}

  subscribe(subscriber: PgSubscriber): () => void {
    this.subscribers.add(subscriber);
    void this.listen();
    return () => {
      this.subscribers.delete(subscriber);
      if (this.subscribers.size === 0) this.release();
    };
  }

  // nobody's listening: let the connection go rather than hold it for good
  private release() {
    const client = this.client;
    if (!client) return;
    this.lost(client);
  }

  private async listen() {
    if (this.client || this.connecting) return;
    this.connecting = true;
    const client = new Client({ connectionString: process.env.DATABASE_URL, keepAlive: true });
    try {
      client.on("notification", (n) => {
        for (const s of this.subscribers) s.onPayload(n.payload ?? "");
      });
      client.on("error", () => this.lost(client));
      client.on("end", () => this.lost(client));
      await client.connect();
      await client.query(`LISTEN ${this.channel}`);
      this.client = client;
      // the last listener may have gone while this was connecting
      if (this.subscribers.size === 0) return this.release();
      this.watch(client);
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

  private watch(client: Client) {
    if (this.keepalive) clearInterval(this.keepalive);
    this.keepalive = setInterval(() => {
      const dead = setTimeout(() => this.lost(client), PROBE_TIMEOUT_MS);
      client.query("select 1").then(
        () => clearTimeout(dead),
        () => {
          clearTimeout(dead);
          this.lost(client);
        },
      );
    }, PROBE_MS);
    this.keepalive.unref();
  }

  private lost(client: Client) {
    if (this.gone.has(client)) return;
    this.gone.add(client);
    if (this.client === client && this.keepalive) {
      clearInterval(this.keepalive);
      this.keepalive = null;
    }
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
}
