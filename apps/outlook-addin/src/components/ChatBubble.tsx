import React, { useState, useRef, useEffect } from 'react';
import {
  Button,
  Input,
  Spinner,
} from '@fluentui/react-components';
import {
  DismissRegular,
  SendRegular,
  DocumentRegular,
} from '@fluentui/react-icons';
import { useStore } from '../hooks/useStore';

interface ChatBubbleProps {
  isOpen: boolean;
  onToggle: () => void;
  mailbox: string;
  messageId: string;
}

export default function ChatBubble({ isOpen, onToggle, mailbox }: ChatBubbleProps) {
  const { chatMessages, chatLoading, sendChatMessage, clearChat } = useStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = async () => {
    if (!input.trim() || chatLoading) return;

    const query = input.trim();
    setInput('');
    await sendChatMessage(mailbox, query);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-brand-500 text-white">
        <div>
          <h2 className="font-medium">Search Assistant</h2>
          <p className="text-xs opacity-80">Ask questions about your emails</p>
        </div>
        <Button
          appearance="subtle"
          icon={<DismissRegular />}
          onClick={onToggle}
          className="text-white hover:bg-brand-600"
        />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatMessages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <p className="mb-4">Ask me anything about your emails!</p>
            <div className="space-y-2 text-sm">
              <p className="text-gray-400">Try asking:</p>
              <button
                onClick={() => setInput('Did the client send the signed contract?')}
                className="block w-full text-left px-3 py-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
              >
                "Did the client send the signed contract?"
              </button>
              <button
                onClick={() => setInput('Show me emails with PDF attachments')}
                className="block w-full text-left px-3 py-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
              >
                "Show me emails with PDF attachments"
              </button>
              <button
                onClick={() => setInput('When was the last email about this dossier?')}
                className="block w-full text-left px-3 py-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
              >
                "When was the last email about this dossier?"
              </button>
            </div>
          </div>
        )}

        {chatMessages.map((message) => (
          <div
            key={message.id}
            className={`chat-message ${
              message.role === 'user' ? 'chat-message-user' : 'chat-message-assistant'
            }`}
          >
            <div className="whitespace-pre-wrap">{message.content}</div>

            {/* Citations */}
            {message.citations && message.citations.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                <div className="text-xs text-gray-500 uppercase tracking-wide">
                  Sources
                </div>
                {message.citations.map((citation, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 p-2 bg-gray-50 rounded text-xs"
                  >
                    <DocumentRegular className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{citation.subject}</div>
                      <div className="text-gray-500">
                        {citation.sender} - {new Date(citation.date).toLocaleDateString()}
                      </div>
                      {citation.excerpt && (
                        <div className="text-gray-600 mt-1 line-clamp-2">
                          {citation.excerpt}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {chatLoading && (
          <div className="chat-message chat-message-assistant">
            <div className="flex items-center gap-2">
              <Spinner size="tiny" />
              <span className="text-gray-500">Searching...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex gap-2">
          <Input
            placeholder="Ask about your emails..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={chatLoading}
            className="flex-1"
          />
          <Button
            appearance="primary"
            icon={<SendRegular />}
            onClick={handleSend}
            disabled={!input.trim() || chatLoading}
          />
        </div>
        {chatMessages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-xs text-gray-400 hover:text-gray-600 mt-2"
          >
            Clear conversation
          </button>
        )}
      </div>
    </div>
  );
}
