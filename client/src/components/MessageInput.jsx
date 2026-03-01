import { useState } from 'react';

export default function MessageInput({ onSend, disabled }) {
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <textarea
        style={styles.input}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? 'Select a conversation to reply' : 'Type a message… (Enter to send)'}
        disabled={disabled}
        rows={1}
      />
      <button style={{ ...styles.button, opacity: disabled || !text.trim() ? 0.5 : 1 }} type="submit" disabled={disabled || !text.trim()}>
        Send
      </button>
    </form>
  );
}

const styles = {
  form: {
    display: 'flex',
    gap: 8,
    padding: '12px 16px',
    background: '#f0f2f5',
    borderTop: '1px solid #ddd',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    border: '1px solid #ddd',
    borderRadius: 20,
    fontSize: 14,
    resize: 'none',
    outline: 'none',
    background: '#fff',
    fontFamily: 'inherit',
    lineHeight: 1.4,
  },
  button: {
    padding: '10px 20px',
    background: '#25D366',
    color: '#fff',
    border: 'none',
    borderRadius: 20,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
  },
};
