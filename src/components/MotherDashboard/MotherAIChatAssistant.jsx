import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, ArrowUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { askAI } from '../../services/aichatservice';
import '../../styles/components/MotherAIChatAssistant.css';
import { useLanguage } from '../../context/LanguageContext';

const MotherAIChatAssistant = () => {
    const { t } = useLanguage();
    const SUGGESTIONS = [
        t('chat_sug1'),
        t('chat_sug2'),
        t('chat_sug3'),
        t('chat_sug4'),
        t('chat_sug5')
    ];

    const [isOpen, setIsOpen] = useState(false);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [messages, setMessages] = useState([
        {
            id: 'welcome',
            sender: 'ai',
            text: t('chat_welcome'),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isWelcome: true
        }
    ]);

    const chatBodyRef = useRef(null);

    const [showBackToTop, setShowBackToTop] = useState(false);

    // Scroll to bottom on new messages or when opened, if not manually scrolled far up
    useEffect(() => {
        if (chatBodyRef.current && (messages.length > 0 || isLoading)) {
            // Only auto-scroll if it's a new user message or AI response, 
            // but for simplicity and current behavior, just scroll to bottom.
            chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        }
    }, [messages, isOpen, isLoading]);

    const handleScroll = (e) => {
        const { scrollTop } = e.target;
        if (scrollTop > 200) {
            setShowBackToTop(true);
        } else {
            setShowBackToTop(false);
        }
    };

    const scrollToTop = () => {
        if (chatBodyRef.current) {
            chatBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const sendMessage = async (text) => {
        if (!text.trim() || isLoading) return;

        const userMessage = {
            id: `user-${Date.now()}`,
            sender: 'user',
            text: text.trim(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);

        try {
            const response = await askAI(userMessage.text);
            const aiMessage = {
                id: `ai-${Date.now()}`,
                sender: 'ai',
                text: response || t('chat_error'),
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            console.error('Error getting AI response:', error);
            const errorMessage = {
                id: `ai-${Date.now()}`,
                sender: 'ai',
                text: t('chat_error_retry'),
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = async (e) => {
        if (e) e.preventDefault();
        const textToSend = inputText;
        setInputText('');
        await sendMessage(textToSend);
    };

    const handleSuggestionClick = (suggestion) => {
        sendMessage(suggestion);
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
                            <h3>{t('chat_title')}</h3>
                            <p>{t('chat_subtitle')}</p>
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
                    <div className="ai-chat-body" ref={chatBodyRef} onScroll={handleScroll}>
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
                                            <div className="ai-suggestions-title">{t('chat_suggestions_title')}</div>
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

                        {/* Typing Indicator */}
                        {isLoading && (
                            <div className="ai-message ai-message--ai">
                                <div className="ai-message-bubble" style={{ width: 'fit-content' }}>
                                    <div className="ai-typing-indicator">
                                        <div className="ai-typing-dot"></div>
                                        <div className="ai-typing-dot"></div>
                                        <div className="ai-typing-dot"></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Back to Top Button */}
                    {showBackToTop && (
                        <div style={{ position: 'absolute', bottom: '80px', left: '0', right: '0', display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
                            <button 
                                onClick={scrollToTop}
                                aria-label="Back to top"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 14px',
                                    backgroundColor: '#fff',
                                    border: '1px solid #eef0f4',
                                    borderRadius: '20px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                    color: 'var(--color-primary, #6B5B95)',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    pointerEvents: 'auto',
                                    transition: 'all 0.2s ease',
                                    zIndex: 10
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                <ArrowUp size={14} /> Back to Top
                            </button>
                        </div>
                    )}

                    {/* Input Footer */}
                    <div className="ai-chat-footer">
                        <form onSubmit={handleSend} className="ai-input-form">
                                <input
                                    type="text"
                                    className="ai-chat-input"
                                    value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                    placeholder={t('chat_placeholder')}
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
