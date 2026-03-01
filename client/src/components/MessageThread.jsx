import { useEffect, useRef } from 'react';

export default function MessageThread({ messages, currentAgent }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return <div style={styles.empty}>No messages yet</div>;
  }

  return (
    <div style={styles.thread}>
      {messages.map((msg) => {
        const isOutbound = msg.direction === 'outbound';
        return (
          <div key={msg.id} style={{ ...styles.row, justifyContent: isOutbound ? 'flex-end' : 'flex-start' }}>
            <div style={{ ...styles.bubble, ...(isOutbound ? styles.outbound : styles.inbound) }}>
              <p style={styles.text}>{msg.content}</p>
              <div style={styles.meta}>
                {isOutbound && msg.agent_name && (
                  <span style={styles.agentName}>{msg.agent_name} · </span>
                )}
                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {isOutbound && (
                  <span style={styles.statusIcon}>
                    {msg.status === 'read' ? ' ✓✓' : msg.status === 'delivered' ? ' ✓✓' : ' ✓'}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

const styles = {
  thread: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    background: '#e5ddd5',
  },
  empty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#999',
    fontSize: 14,
    background: '#e5ddd5',
  },
  row: { display: 'flex' },
  bubble: {
    maxWidth: '70%',
    padding: '8px 12px',
    borderRadius: 8,
    boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
  },
  inbound: { background: '#fff', borderTopLeftRadius: 2 },
  outbound: { background: '#dcf8c6', borderTopRightRadius: 2 },
  text: { fontSize: 14, lineHeight: 1.45, wordBreak: 'break-word' },
  meta: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, fontSize: 11, color: '#888', gap: 2 },
  agentName: { color: '#25D366', fontWeight: 600 },
  statusIcon: { color: '#4fc3f7' },
};
