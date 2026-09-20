export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { loadHostVerticals } = await import("./lib/load-host-verticals");
  await loadHostVerticals();
}
