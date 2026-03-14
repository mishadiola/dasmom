import React from 'react';
import { createRoot } from 'react-dom/client';

export default function App() {
    return (
        <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh',
            fontFamily: 'sans-serif',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
        }}>
            <div style={{
                background: 'rgba(255, 255, 255, 0.1)',
                padding: '2rem',
                borderRadius: '1rem',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)'
            }}>
                <h1>🚀 Frontend Loaded Successfully!</h1>
                <p>Laravel + React + Vite is now working.</p>
                <button 
                    onClick={() => alert('React logic is working too!')}
                    style={{
                        padding: '0.5rem 1rem',
                        fontSize: '1rem',
                        borderRadius: '0.5rem',
                        border: 'none',
                        backgroundColor: '#fff',
                        color: '#764ba2',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    Test Interaction
                </button>
            </div>
        </div>
    );
}

const rootElement = document.getElementById('root');
if (rootElement) {
    createRoot(rootElement).render(<App />);
}
