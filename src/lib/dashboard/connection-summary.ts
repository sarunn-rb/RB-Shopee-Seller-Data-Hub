import type { ShopeeConnection } from "@/types/firestore";

type ConnectionStatus = ShopeeConnection["status"];

export function getConnectionSummary(connections: Array<{ status: ConnectionStatus }>) {
  let connectedShops = 0;
  let healthyConnections = 0;
  let needsAttention = 0;

  for (const connection of connections) {
    if (connection.status !== "disconnected") {
      connectedShops += 1;
    }

    if (connection.status === "active") {
      healthyConnections += 1;
    } else if (connection.status !== "disconnected") {
      needsAttention += 1;
    }
  }

  return { connectedShops, healthyConnections, needsAttention };
}
