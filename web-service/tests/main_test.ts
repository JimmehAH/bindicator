import { assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import app from "../main.ts";

Deno.test("basic test", async () => {
  const res = await app.request("/");

  assertStringIncludes(await res.text(), "Bindicator");
});
