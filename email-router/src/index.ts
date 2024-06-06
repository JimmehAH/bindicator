import PostalMime from "postal-mime";

export interface Env {
  POST_DB: KVNamespace;
  BINDICATOR_ENDPOINT: string;
}

type Auth_Data = {
  auth_type: string;
  auth_token: string;
};

export default {
  async fetch(
    _request: Request,
    _env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    return new Response("Hello World!");
  },

  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const emailParser = new PostalMime();

    const email = await emailParser.parse(message.raw);

    const sender = email.from.address ?? "unknown";
    // how would the email arrive without a recipient?
    const recipient = (email.to && email.to[0].address) || "unknown";

    console.log(`Incoming email: ${email.subject}`);

    // use a random suffix to prevent future emails from clobbering
    const suffix = Math.random().toString(16).slice(2, 10);
    const key = recipient + "_" + suffix;

    const data = {
      suffix: suffix,
      recipient: recipient,
      sender: sender,
      subject: email.subject,
      "content-plain": email.text,
      date: email.date,
    };

    await env.POST_DB.put(key, JSON.stringify(data));

    // make sure this email is the correct type (i.e. one about when the bins are going out)
    if (email.subject?.includes("Your bins")) {
      // get auth for this recipient from database
      const auth_data: Auth_Data = JSON.parse(
        `${await env.POST_DB.get(`auth_${recipient}`)}`,
      );
      const auth_string = `${auth_data.auth_type} ${auth_data.auth_token}`;

      const req_headers = new Headers();
      req_headers.append("Content-Type", "application/json");
      req_headers.append("Authorization", auth_string);

      // post body of the email to the bindicator web service
      const body = JSON.stringify({ body: email.text });

      const req_options = {
        method: "POST",
        headers: req_headers,
        body: body,
        redirect: "follow",
      };

      const res = await fetch(env.BINDICATOR_ENDPOINT, req_options);
      if (res.status != 200) {
        console.error(`Request failed! ${res.statusText}`);
      } else {
        console.log("Updated bin collection data");
      }
    } else {
      console.log("Not a bin related email");
    }
  },
};
