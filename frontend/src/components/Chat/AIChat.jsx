import { useState, useEffect, useRef } from 'react';
import useStore from '../../stores/useStore';
import { chatAPI } from '../../services/api';

const AIChat = () => {
  const { projects, selectedProject, selectProject, setStatus } = useStore();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load chat history when component mounts or project changes
  useEffect(() => {
    loadChatHistory();
  }, [currentProjectId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatHistory = async () => {
    try {
      const response = await chatAPI.getHistory(currentProjectId);
      setMessages(response.messages || []);
    } catch (error) {
      console.error('Error loading chat history:', error);
      setMessages([]);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');

    // Add user message to UI immediately
    const tempUserMessage = {
      id: Date.now(),
      role: 'user',
      content: userMessage,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      setIsLoading(true);
      const response = await chatAPI.sendMessage(userMessage, currentProjectId);

      // Add AI response to messages
      const aiMessage = {
        id: response.messageId,
        role: 'assistant',
        content: response.message,
        createdAt: new Date().toISOString(),
      };

      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);
      inputRef.current?.focus();
    } catch (error) {
      console.error('Error sending message:', error);
      setStatus('error', 'Failed to get AI response: ' + error.message);
      setIsLoading(false);

      // Add error message
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: '❌ Sorry, I encountered an error. Please try again.',
        createdAt: new Date().toISOString(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Are you sure you want to clear the chat history?')) return;

    try {
      await chatAPI.clearHistory(currentProjectId);
      setMessages([]);
      setStatus('success', 'Chat history cleared');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (error) {
      setStatus('error', 'Failed to clear history: ' + error.message);
    }
  };

  const handleProjectChange = (projectId) => {
    const newProjectId = projectId ? parseInt(projectId) : null;
    setCurrentProjectId(newProjectId);

    // Also update global selected project if a project is chosen
    if (newProjectId) {
      const project = projects.find(p => p.id === newProjectId);
      if (project) {
        selectProject(project);
      }
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div style={{
      background: '#fff',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      overflow: 'hidden',
      height: 'calc(100vh - 200px)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '15px 20px',
        borderBottom: '1px solid #dee2e6',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
            🤖 AI Mentor & Companion
          </h2>
          <button
            onClick={handleClearHistory}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            🗑️ Clear History
          </button>
        </div>

        {/* Project Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '13px', fontWeight: '500' }}>
            Project Context:
          </label>
          <select
            value={currentProjectId || ''}
            onChange={(e) => handleProjectChange(e.target.value)}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              background: 'rgba(255,255,255,0.9)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '4px',
              color: '#495057',
              minWidth: '200px',
            }}
          >
            <option value="">General Chat (No Project)</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Messages Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        background: '#f8f9fa',
      }}>
        {messages.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#6c757d',
          }}>
            <p style={{ fontSize: '48px', margin: '0 0 20px 0' }}>👋</p>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '20px' }}>
              Hey there! I'm your AI mentor.
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', lineHeight: '1.6' }}>
              Ask me anything about your projects, get advice on technical decisions,<br />
              or just chat about what's on your mind. I'm here to help!
            </p>
            {currentProjectId && (
              <div style={{
                background: '#e7f3ff',
                border: '1px solid #b3d9ff',
                borderRadius: '6px',
                padding: '12px',
                fontSize: '13px',
                color: '#004085',
                maxWidth: '400px',
                margin: '0 auto',
              }}>
                💡 I have access to your project's meetings, wiki, and summaries.<br />
                Try asking: "What have we discussed about authentication?"
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((msg, index) => (
              <div
                key={msg.id || index}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: '15px',
                }}
              >
                <div style={{
                  maxWidth: '70%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}>
                  {/* Message Bubble */}
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: msg.isError
                      ? '#f8d7da'
                      : msg.role === 'user'
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        : '#fff',
                    color: msg.isError
                      ? '#721c24'
                      : msg.role === 'user'
                        ? '#fff'
                        : '#495057',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    border: msg.role === 'user' ? 'none' : '1px solid #dee2e6',
                  }}>
                    {msg.content}
                  </div>

                  {/* Timestamp */}
                  <div style={{
                    fontSize: '11px',
                    color: '#6c757d',
                    marginTop: '4px',
                    paddingLeft: msg.role === 'user' ? '0' : '8px',
                    paddingRight: msg.role === 'user' ? '8px' : '0',
                  }}>
                    {formatTime(msg.createdAt)}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div style={{
                display: 'flex',
                justifyContent: 'flex-start',
                marginBottom: '15px',
              }}>
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '18px 18px 18px 4px',
                  background: '#fff',
                  border: '1px solid #dee2e6',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}>
                  <div style={{
                    display: 'flex',
                    gap: '6px',
                    alignItems: 'center',
                  }}>
                    <div className="typing-dot" style={{ animationDelay: '0s' }}></div>
                    <div className="typing-dot" style={{ animationDelay: '0.2s' }}></div>
                    <div className="typing-dot" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div style={{
        padding: '15px 20px',
        borderTop: '1px solid #dee2e6',
        background: '#fff',
      }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <textarea
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message... (Shift+Enter for new line)"
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '12px',
              fontSize: '14px',
              border: '1px solid #ced4da',
              borderRadius: '8px',
              resize: 'none',
              fontFamily: 'inherit',
              minHeight: '50px',
              maxHeight: '120px',
              outline: 'none',
            }}
            rows={2}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 'bold',
              background: !inputMessage.trim() || isLoading
                ? '#6c757d'
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: !inputMessage.trim() || isLoading ? 'not-allowed' : 'pointer',
              opacity: !inputMessage.trim() || isLoading ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {isLoading ? '⏳ Thinking...' : '📤 Send'}
          </button>
        </div>
        <div style={{
          marginTop: '8px',
          fontSize: '12px',
          color: '#6c757d',
          textAlign: 'center',
        }}>
          Press Enter to send • Shift+Enter for new line
        </div>
      </div>

      {/* Typing Animation CSS */}
      <style>{`
        .typing-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #6c757d;
          animation: typing 1.4s infinite;
        }

        @keyframes typing {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.6;
          }
          30% {
            transform: translateY(-10px);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default AIChat;
