export function getCookieMaxAgeFromJwt(token: string, fallbackSeconds = 60 * 60 * 24 * 7) {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) {
      return fallbackSeconds;
    }

    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf-8")) as {
      exp?: number;
    };

    if (!payload.exp) {
      return fallbackSeconds;
    }

    const secondsLeft = Math.floor(payload.exp - Date.now() / 1000);
    return secondsLeft > 0 ? secondsLeft : fallbackSeconds;
  } catch {
    return fallbackSeconds;
  }
}
