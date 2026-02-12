export const AGENT_ENDPOINTS = {
  CANCEL_DISPATCH: "/api/cancel_dispatch",
  CREATE_DISPATCH: "/api/create_dispatch",
  TTS_SPEAK: "/api/tts/speak",
  STREAM_MESSAGE: "/api/stream_message",
  AGENT_CONTROL_TRANSCRIPT: "/api/agent-control/transcript",
} as const;

export function buildStreamMessageUrl(
  baseUrl: string,
  appid: string,
  token: string,
  room: string
): string {
  return `${baseUrl}${
    AGENT_ENDPOINTS.STREAM_MESSAGE
  }?appid=${encodeURIComponent(appid)}&token=${encodeURIComponent(
    token
  )}&room=${encodeURIComponent(room)}`;
}
