export interface RoomMetadata {
  roomId: string;
  ownerId: string;
  problemId: string;
  shareToken: string;
  createdAt: string;
  tokenCreatedAt: string;
}

export interface RoomRegistry {
  getRoomByToken(token: string): Promise<RoomMetadata | null>;
  getTokenByRoom(roomId: string): Promise<string | null>;
  createRoom(ownerId: string, problemId: string): Promise<RoomMetadata>;
  regenerateToken(roomId: string, ownerId: string): Promise<string>;
  roomExists(roomId: string): Promise<boolean>;
  getRoomMetadata(roomId: string): Promise<RoomMetadata | null>;
}
