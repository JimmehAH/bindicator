import { Hono } from "https://deno.land/x/hono@v4.2.7/mod.ts";
import { basicAuth } from "https://deno.land/x/hono@v4.2.7/middleware.ts";
import { load } from "https://deno.land/std@0.223.0/dotenv/mod.ts";
import dayjs from "npm:dayjs@^1.11.10";
import Color from "npm:ts-color-class@^0.10.1";

const env = await load();
const app = new Hono();

const kv = await Deno.openKv();

type CollectionType = { collection: string; colour: Color };

// see https://docs.micropython.org/en/latest/library/time.html#time.mktime for details of this 8-tuple
type MicropythonTimestamp = {
  year: number; // year includes the century (for example 2014).
  month: number; // month is 1-12
  mday: number; // mday is 1-31
  hour: number; // hour is 0-23
  minute: number; // minute is 0-59
  second: number; // second is 0-59
  weekday: number; // weekday is 0-6 for Mon-Sun
  yearday: number; // yearday is 1-366
};

// see https://dsteinman.github.io/ts-color-class/colors.html for colour reference
const COLLECTION_TYPES: CollectionType[] = [
  { collection: "RECYCLING", colour: new Color("blue") },
  { collection: "RUBBISH", colour: new Color("green 4") },
  { collection: "GARDEN", colour: new Color("brown") },
  { collection: "FOOD WASTE", colour: new Color("green 3") },
];

type WasteCollection = {
  start_date: Date;
  end_date: Date;
  mp_start_date?: MicropythonTimestamp;
  mp_end_date?: MicropythonTimestamp;
  collections: CollectionType[];
};

/**
 * Searches the email body for the day the next collection takes place and returns a Date object representing that collection.
 * @param _email_body the body of the email from the council
 * @returns the date of the waste collection, with the time set to 6am
 */
function find_date_in_email(email_body: string): Date {
  // we only care about the date so set minutes and seconds to 0
  // we'll also set the hour to 6am now
  const now = dayjs().set("hour", 6).set("minute", 0).set("second", 0);

  const day_regex = RegExp(
    /Your next collection is on\s+(?<day_name>MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)/,
    "gm",
  );

  const search = day_regex.exec(email_body)?.groups;

  // iterate over today and the next 7 days to find the correct date offset so we can make a proper timestamp for the collection
  // this will almost always be tomorrow
  if (search) {
    for (let date_offset = 0; date_offset < 7; date_offset++) {
      // add the offset to create our new date to test
      const calculated_date = now.add(date_offset, "day");
      console.log(calculated_date.format("dddd").toUpperCase());
      if (search.day_name == calculated_date.format("dddd").toUpperCase()) {
        return calculated_date.toDate();
      }
    }
  }

  // if the search was not successful then just set the date to tomorrow
  return now.add(1, "day").toDate();
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

function convert_to_micropython_timestamp(
  timestamp: Date,
): MicropythonTimestamp {
  const mp_timestamp: MicropythonTimestamp = {
    year: timestamp.getUTCFullYear(),
    month: timestamp.getUTCMonth() + 1, // this is 0-indexed in JS/TS, of course 😡
    mday: timestamp.getUTCDate(),
    hour: timestamp.getUTCHours(),
    minute: timestamp.getUTCMinutes(),
    second: timestamp.getUTCSeconds(),
    weekday: timestamp.getUTCDay(),
    yearday: 0, // we don't care about day of the year
  };
  return mp_timestamp;
}

// Protect the routes
const basic_auth_mw = basicAuth({
  username: env["BASIC_USER"],
  password: env["BASIC_PASSWORD"],
});
app.use("/incoming", basic_auth_mw);
app.use("/next-collection", basic_auth_mw);

app.get("/", (c) => {
  return c.text("Bindicator v0.0.1");
});

app.post("/incoming", async (c) => {
  const body = await c.req.json();

  const end_date = find_date_in_email(body.body);
  const start_date = dayjs(end_date).subtract(1, "day").set("hour", 16)
    .toDate();

  const collection: WasteCollection = {
    end_date: end_date,
    start_date: start_date,
    collections: find_collections_in_email(body.body),
  };

  await kv.set(
    ["next_collection", env["BASIC_USER"]],
    collection,
  );

  return c.text("Thanks!");
});

app.get("/next-collection", async (c) => {
  const next_collecton = (await kv.get(["next_collection", env["BASIC_USER"]]))
    .value as WasteCollection;

  // check to see if it's our dedicated device that is making the request
  // if so then we must transform the timestamps to a form that is easier to use in micropython
  if (c.req.header("User-Agent")?.search(/Bindicator/) !== -1) {
    next_collecton.mp_end_date = convert_to_micropython_timestamp(
      next_collecton.end_date,
    );
    next_collecton.mp_start_date = convert_to_micropython_timestamp(
      next_collecton.start_date,
    );
  }

  return c.json(next_collecton);
});

Deno.serve(app.fetch);
