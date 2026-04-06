import { WebSocket } from 'ws';

// userId → 연결된 WebSocket 집합
const userClients = new Map<string, Set<WebSocket>>();
// ws → userId (역방향 조회용)
const wsUser = new Map<WebSocket, string>();

export function registerClient(userId: string, ws: WebSocket) {
  if (!userClients.has(userId)) userClients.set(userId, new Set());
  userClients.get(userId)!.add(ws);
  wsUser.set(ws, userId);
}

export function unregisterClient(ws: WebSocket) {
  const userId = wsUser.get(ws);
  if (userId) {
    userClients.get(userId)?.delete(ws);
    if (userClients.get(userId)?.size === 0) userClients.delete(userId);
  }
  wsUser.delete(ws);
}

/**
 * 지정한 userId 목록에 속한 모든 WS 클라이언트에게 데이터를 전송합니다.
 * excludeUserId 에 해당하는 유저는 건너뜁니다 (메시지 발신자 제외용).
 */
export function broadcastToUsers(userIds: string[], data: object, excludeUserId?: string) {
  const payload = JSON.stringify(data);
  for (const uid of userIds) {
    if (uid === excludeUserId) continue;
    const clients = userClients.get(uid);
    if (!clients) continue;
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    }
  }
}
