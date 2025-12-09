import { createChatBotMessage } from "react-chatbot-kit";
import BotChatMessage from "./BotChatMessage";

const config = {
  botName: "System Design Assistant",
  initialMessages: [
    createChatBotMessage(
      "Hi! Feel free to ask me anything. But you should know I can't see your current design until after you've clicked the Get Feedback button.",
      {}
    ),
  ],
  customStyles: {
    botMessageBox: {
      backgroundColor: "#f5f5f5",
    },
    chatButton: {
      backgroundColor: "#1976d2",
    },
  },
  customComponents: {
    botChatMessage: (props: { message: string; loading?: boolean }) => (
      <BotChatMessage message={props.message} loading={props.loading} />
    ),
  },
};

export default config;
