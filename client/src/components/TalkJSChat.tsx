import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";

// TalkJS types
declare global {
  interface Window {
    Talk: any;
  }
}

interface TalkJSChatProps {
  conversationId?: string;
  className?: string;
}

export default function TalkJSChat({ conversationId = "support", className = "" }: TalkJSChatProps) {
  const { user } = useAuth();
  const chatboxElement = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !chatboxElement.current) return;

    // Initialize TalkJS
    window.Talk.ready.then(() => {
      // Create current user
      const currentUser = new window.Talk.User({
        id: user.id,
        name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email || "User",
        email: user.email || undefined,
        photoUrl: user.profileImageUrl || undefined,
        role: "default",
      });

      // Create support agent user
      const supportAgent = new window.Talk.User({
        id: "freightclear-support",
        name: "Freightclear Support",
        email: "support@freightclear.com",
        photoUrl: undefined,
        role: "support",
      });

      // Create session (using demo app ID for now)
      const session = new window.Talk.Session({
        appId: "t8lER2cu", // Demo app ID - user will need to replace with their own
        me: currentUser,
      });

      // Create conversation
      const conversation = session.getOrCreateConversation(conversationId);
      conversation.setParticipant(currentUser);
      conversation.setParticipant(supportAgent);
      
      // Set conversation attributes
      conversation.setAttributes({
        subject: "Customer Support",
        welcomeMessages: ["👋 Hi! How can we help you with your shipments today?"],
      });

      // Create and mount the chatbox
      const chatbox = session.createChatbox();
      chatbox.select(conversation);
      chatbox.mount(chatboxElement.current);

      // Cleanup function
      return () => {
        if (chatboxElement.current) {
          chatboxElement.current.innerHTML = '';
        }
      };
    });
  }, [user, conversationId]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
        <p className="text-gray-500">Please log in to access chat support</p>
      </div>
    );
  }

  return (
    <div className={`h-96 w-full rounded-lg overflow-hidden ${className}`}>
      <div ref={chatboxElement} className="h-full w-full" />
    </div>
  );
}