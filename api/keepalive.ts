export const config = { runtime: "edge" };

/**
 * Vercel Edge Function – pings the backend aggregator to keep it warm.
 * Triggered by Vercel Cron every 5 minutes (configured in vercel.json).
 */
export default async function handler() {
  const API = process.env.AGGREGATOR_KEEPALIVE_URL ?? "https://evm-api.deserialize.xyz";

  let status = "ok";
  let latencyMs = 0;

  try {
    const start = Date.now();
    // Lightweight health check — most Express apps respond instantly to GET /
    const res = await fetch(`${API}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    });
    latencyMs = Date.now() - start;
    if (!res.ok) status = `non-200: ${res.status}`;
  } catch (err) {
    status = err instanceof Error ? err.message : "error";
  }

  return new Response(
    JSON.stringify({ pinged: API, status, latencyMs, ts: new Date().toISOString() }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
