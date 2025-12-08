import type { Operation } from "fast-json-patch";

export interface ConversationMessage {
  role: "assistant" | "user";
  content: string;
  timestamp: string;
  source: "chat" | "feedback";
}

export interface Problem {
  id: string;
  category: string;
  title: string;
  description: string;
  statement: string;
}

export interface SimplifiedElement {
  id: string;
  type: string;
  label?: string;
  frameId?: string | null;
  connections_to?: {
    target_id: string;
    target_label?: string;
    arrow_label?: string;
  }[];
}

export interface ElementsObject {
  [id: string]: SimplifiedElement;
}

export interface RoomConversationState {
  messages: ConversationMessage[];
  previousElements: ElementsObject;
  problemId: string;
}

export type { Operation };
