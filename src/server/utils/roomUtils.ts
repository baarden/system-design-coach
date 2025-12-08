/**
 * Parses the problem ID from a room ID.
 * Room ID format: {userId}/{problemId}
 */
export function parseProblemIdFromRoomId(roomId: string): string | undefined {
  const parts = roomId.split("/");
  return parts.length >= 2 ? parts[1] : undefined;
}
