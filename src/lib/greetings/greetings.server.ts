import { env } from "cloudflare:workers";
import { createDb } from "../database/database";
import type { GreetingMessage } from "./greetings-core";

const db = createDb(env.DB);

export async function listGreetingMessages(): Promise<GreetingMessage[]> {
  return db.selectFrom("greetings").select(["message", "time", "days"]).execute();
}
