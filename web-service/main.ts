import { Hono } from "https://deno.land/x/hono@v4.2.7/mod.ts";
import { basicAuth } from "https://deno.land/x/hono@v4.2.7/middleware.ts";
import { load } from "https://deno.land/std@0.223.0/dotenv/mod.ts";

const env = await load();
const app = new Hono();

// Protect the incoming webhook
app.use(
  "/incoming",
  basicAuth({
    username: env["BASIC_USER"],
    password: env["BASIC_PASSWORD"],
  }),
);

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.post("/incoming", async (c) => {
  const body = await c.req.json();
  console.log(body);
  return c.text("Thanks!");
});

Deno.serve(app.fetch);
