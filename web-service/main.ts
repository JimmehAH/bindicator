import { Hono } from "https://deno.land/x/hono@v4.2.7/mod.ts";
import { basicAuth } from "https://deno.land/x/hono@v4.2.7/middleware.ts";
import { load } from "https://deno.land/std@0.223.0/dotenv/mod.ts";
import dayjs from "npm:dayjs@^1.11.10";
import Color from "npm:ts-color-class@^0.10.1";

const env = await load();
const app = new Hono();

const kv = await Deno.openKv();

type CollectionType = { collection: string; colour: Color };

// see https://dsteinman.github.io/ts-color-class/colors.html for colour reference
const COLLECTION_TYPES: CollectionType[] = [
  { collection: "RECYCLING", colour: new Color("blue") },
  { collection: "RUBBISH", colour: new Color("green 4") },
  { collection: "GARDEN", colour: new Color("brown") },
  { collection: "FOOD WASTE", colour: new Color("green 3") },
];

type WasteCollection = { date: Date; collections: CollectionType[] };

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
function find_collections_in_email(email_body: string): CollectionType[] {
  const collections: CollectionType[] = [];

  COLLECTION_TYPES.forEach(
    (collection_type) => {
      if (email_body.search(collection_type.collection) !== -1) {
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
  const collection: WasteCollection = {
    date: find_date_in_email(body.body),
    collections: find_collections_in_email(body.body),
  };
  console.log(JSON.stringify(collection));

  await kv.set(
    [`${env["BASIC_USER"]}_next_collection`],
    JSON.stringify(collection),
  );

  return c.text("Thanks!");
});

Deno.serve(app.fetch);
