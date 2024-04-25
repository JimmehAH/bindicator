import { Hono } from "https://deno.land/x/hono@v4.2.7/mod.ts";
import { basicAuth } from "https://deno.land/x/hono@v4.2.7/middleware.ts";
import { load } from "https://deno.land/std@0.223.0/dotenv/mod.ts";
import dayjs from "npm:dayjs@1.11.10";

const env = await load();
const app = new Hono();

const COLLECTION_TYPES = ["RECYCLING", "RUBBISH", "GARDEN", "FOOD WASTE"];

class WasteCollection {
  date: Date;
  collected_items: string[];

  constructor(date: Date, collected_items: string[]) {
    this.date = date;
    this.collected_items = collected_items;
  }
}

/**
 * TODO: actually parse the email and return a sensible value based on that
 * @param _email_body the body of the email from the council
 * @returns the date of the waste collection
 */
function find_date_in_email(_email_body: string): Date {
  return dayjs().toDate();
}

/**
 * TODO: make a collection type object and pair it with a colour maybe?
 * @param email_body the body of the email from the council
 * @returns an array of only the collection types found in the email body
 */
function find_collections_in_email(email_body: string): string[] {
  const collections: string[] = [];

  COLLECTION_TYPES.forEach(
    (collection_type) => {
      if (email_body.search(collection_type) !== -1) {
        collections.push(collection_type);
      }
    },
  );

  return collections;
}

// Protect the incoming webhook
app.use(
  "/incoming",
  basicAuth({
    username: env["BASIC_USER"],
    password: env["BASIC_PASSWORD"],
  }),
);

app.get("/", (c) => {
  return c.text("Bindicator v0.0.1");
});

app.post("/incoming", async (c) => {
  const body = await c.req.json();
  const collection: WasteCollection = new WasteCollection(
    find_date_in_email(body.body),
    find_collections_in_email(body.body),
  );
  console.log(JSON.stringify(collection));
  return c.text("Thanks!");
});

Deno.serve(app.fetch);
