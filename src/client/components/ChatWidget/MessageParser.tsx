import ActionProvider from "./ActionProvider";

class MessageParser {
  actionProvider: ActionProvider;
  onUserMessage: (message: string, actionProvider: ActionProvider) => void;

  constructor(
    actionProvider: ActionProvider,
    _state: unknown,
    onUserMessage: (message: string, actionProvider: ActionProvider) => void
  ) {
    this.actionProvider = actionProvider;
    this.onUserMessage = onUserMessage;
  }

  parse = (message: string) => {
    this.onUserMessage(message, this.actionProvider);
  };
}

export default MessageParser;
