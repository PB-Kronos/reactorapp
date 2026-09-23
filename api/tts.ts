import type { IncomingMessage, ServerResponse } from "node:http";

type TtsRequest = { text?: unknown };

const readJson = async (request: IncomingMessage): Promise<TtsRequest> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as TtsRequest;
};

const respond = (response: ServerResponse, status: number, body: object) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "private, max-age=300");
  response.end(JSON.stringify(body));
};

/**
 * Keeps PlayHT credentials off the client bundle. The simulator only sends
 * its fixed in-game announcement text and receives MP3 bytes to play.
 */
export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    respond(response, 405, { error: "Method not allowed" });
    return;
  }

  const origin = request.headers.origin;
  const host = request.headers.host;
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        respond(response, 403, { error: "Cross-origin request rejected" });
        return;
      }
    } catch {
      respond(response, 400, { error: "Invalid request origin" });
      return;
    }
  }

  const apiKey = process.env.PLAYHT_API_KEY;
  const userId = process.env.PLAYHT_USER_ID;
  const voice = process.env.PLAYHT_VOICE;
  if (!apiKey || !userId || !voice) {
    respond(response, 503, { error: "PlayHT is not configured" });
    return;
  }

  try {
    const body = await readJson(request);
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text || text.length > 700) {
      respond(response, 400, { error: "Announcement text is invalid" });
      return;
    }

    const upstream = await fetch("https://api.play.ht/api/v2/tts/stream", {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "X-USER-ID": userId,
        Authorization: apiKey,
      },
      body: JSON.stringify({
        text,
        voice,
        voice_engine: process.env.PLAYHT_VOICE_ENGINE || "PlayDialog",
        output_format: "mp3",
      }),
    });
    if (!upstream.ok) {
      respond(response, 502, { error: "PlayHT synthesis failed" });
      return;
    }

    const audio = Buffer.from(await upstream.arrayBuffer());
    if (!audio.length) {
      respond(response, 502, { error: "PlayHT returned no audio" });
      return;
    }
    response.statusCode = 200;
    response.setHeader("Content-Type", "audio/mpeg");
    response.setHeader("Cache-Control", "private, max-age=300");
    response.end(audio);
  } catch {
    respond(response, 502, { error: "PlayHT synthesis unavailable" });
  }
}
