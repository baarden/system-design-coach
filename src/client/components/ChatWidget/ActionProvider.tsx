import { Dispatch, SetStateAction } from "react";

interface Message {
  message: string;
  type: string;
  id: number;
  loading?: boolean;
}

interface State {
  messages: Message[];
}

type CreateChatBotMessage = (
  message: string,
  options?: { loading?: boolean; delay?: number }
) => Message;

type SetState = Dispatch<SetStateAction<State>>;

class ActionProvider {
  createChatBotMessage: CreateChatBotMessage;
  setState: SetState;

  constructor(
    createChatBotMessage: CreateChatBotMessage,
    setState: SetState
  ) {
    this.createChatBotMessage = createChatBotMessage;
    this.setState = setState;
  }

  addBotMessage = (text: string) => {
    const message = this.createChatBotMessage(text, {});
    this.setState((prev) => ({
      ...prev,
      messages: [...prev.messages, message],
    }));
  };

  addLoadingMessage = (): number => {
    const message = this.createChatBotMessage("...", { loading: true });
    this.setState((prev) => ({
      ...prev,
      messages: [...prev.messages, message],
    }));
    return message.id;
  };

  replaceLoadingMessage = (messageId: number, text: string) => {
    this.setState((prev) => ({
      ...prev,
      messages: prev.messages.map((msg) =>
        msg.id === messageId
          ? { ...msg, message: text, loading: false }
          : msg
      ),
    }));
  };

  removeLoadingMessage = (messageId: number) => {
    this.setState((prev) => ({
      ...prev,
      messages: prev.messages.filter((msg) => msg.id !== messageId),
    }));
  };
}

export default ActionProvider;
