import { Hono } from "https://deno.land/x/hono@v4.2.7/mod.ts";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.post("/incoming", async (c) => {
  const body = await c.req.json();
  console.log(body);
  return c.text("Thanks!");
});

Deno.serve(app.fetch);
