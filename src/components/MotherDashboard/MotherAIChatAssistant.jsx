import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { askAI } from '../../services/aichatservice';
import '../../styles/components/MotherAIChatAssistant.css';

const SUGGESTIONS = [
    'When is my next appointment?',
    'What vaccines are due?',
    'What supplements should I take?',
    'Pregnancy nutrition tips',
    'Warning signs during pregnancy'
];

const MotherAIChatAssistant = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [messages, setMessages] = useState([
        {
            id: 'welcome',
            sender: 'ai',
            text: "👋 Hello, Mommy! I'm your DASMOM+ AI Assistant. I'm here to answer your pregnancy and maternal health questions.",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isWelcome: true
        }
    ]);

    const chatBodyRef = useRef(null);

    // Scroll to bottom on new messages or when opened
    useEffect(() => {
        if (chatBodyRef.current) {
            chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = async (e) => {
        if (e) e.preventDefault();
        if (!inputText.trim() || isLoading) return;

        const userMessage = {
            id: `user-${Date.now()}`,
            sender: 'user',
            text: inputText.trim(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsLoading(true);

        try {
            const response = await askAI(userMessage.text);
            const aiMessage = {
                id: `ai-${Date.now()}`,
                sender: 'ai',
                text: response || "I'm having trouble processing your request. Please try again.",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            console.error('Error getting AI response:', error);
            const errorMessage = {
                id: `ai-${Date.now()}`,
                sender: 'ai',
                text: "Sorry, I encountered an error. Please try again later.",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuggestionClick = (suggestion) => {
        setInputText(suggestion);
    };

    return (
        <div className="ai-chat-container">
            {/* Floating Trigger Button */}
            <button 
                className="ai-chat-trigger" 
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Toggle AI Assistant"
            >
                {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
            </button>

            {/* Chat Panel */}
            {isOpen && (
                <div className="ai-chat-panel">
                    {/* Header */}
                    <div className="ai-chat-header">
                        <div className="ai-chat-header-info">
                            <h3>DASMOM+ AI Assistant</h3>
                            <p>Ask questions about pregnancy & health</p>
                        </div>
                        <button 
                            className="ai-chat-close-btn"
                            onClick={() => setIsOpen(false)}
                            aria-label="Close Assistant"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Message Body */}
                    <div className="ai-chat-body" ref={chatBodyRef}>
                        {messages.map(msg => (
                            <div 
                                key={msg.id} 
                                className={`ai-message ai-message--${msg.sender}`}
                            >
                                <div className="ai-message-bubble">
                                    {msg.sender === 'ai' && !msg.isWelcome ? (
                                        <div className="ai-markdown">
                                            <ReactMarkdown>{msg.text}</ReactMarkdown>
                                        </div>
                                    ) : (
                                        msg.text
                                    )}
                                    {msg.isWelcome && (
                                        <div className="ai-suggestions-wrap">
                                            <div className="ai-suggestions-title">Suggested questions:</div>
                                            <div className="ai-suggestions-list">
                                                {SUGGESTIONS.map((sug, index) => (
                                                    <button
                                                        key={index}
                                                        type="button"
                                                        className="ai-suggestion-chip"
                                                        onClick={() => handleSuggestionClick(sug)}
                                                    >
                                                        {sug}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <span className="ai-message-time">{msg.time}</span>
                            </div>
                        ))}
                    </div>

                    {/* Input Footer */}
                    <div className="ai-chat-footer">
                        <form onSubmit={handleSend} className="ai-input-form">
                            <input
                                type="text"
                                className="ai-chat-input"
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                placeholder="Type your message..."
                                disabled={isLoading}
                            />
                            <button 
                                type="submit" 
                                className="ai-send-btn"
                                disabled={!inputText.trim() || isLoading}
                                aria-label="Send message"
                            >
                                {isLoading ? '⏳' : <Send size={14} />}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MotherAIChatAssistant;
