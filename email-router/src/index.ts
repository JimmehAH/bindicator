import PostalMime from "postal-mime";

export interface Env {
  POST_DB: KVNamespace;
}

export default {
  async fetch(
    _request: Request,
    _env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    return new Response("Hello World!");
  },

  async email(
    message: ForwardableEmailMessage,
    _env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    const emailParser = new PostalMime();

    const email = await emailParser.parse(message.raw);

    console.log(email.text);
  },
};
