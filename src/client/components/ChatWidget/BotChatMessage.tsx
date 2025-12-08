import ReactMarkdown from "react-markdown";

interface BotChatMessageProps {
  message: string;
  loading?: boolean;
}

function LoadingDots() {
  return (
    <div className="chat-bot-message-wrapper">
      <div className="chat-loading-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
}

export default function BotChatMessage({ message, loading }: BotChatMessageProps) {
  if (loading || message === "...") {
    return <LoadingDots />;
  }

  return (
    <div className="chat-bot-message-wrapper">
      <div className="chat-bot-message-markdown">
        <ReactMarkdown>{message}</ReactMarkdown>
      </div>
    </div>
  );
}
