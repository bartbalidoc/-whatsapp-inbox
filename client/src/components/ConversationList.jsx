import AgentBadge from './AgentBadge';

export default function ConversationList({ conversations, selectedId, onSelect }) {
  if (conversations.length === 0) {
    return <div style={styles.empty}>No conversations yet</div>;
  }

  return (
    <div style={styles.list}>
      {conversations.map((conv) => (
        <div
          key={conv.id}
          style={{
            ...styles.item,
            background: conv.id === selectedId ? '#e9fbe9' : '#fff',
            borderLeft: conv.id === selectedId ? '3px solid #25D366' : '3px solid transparent',
          }}
          onClick={() => onSelect(conv)}
        >
          <AgentBadge name={conv.contact_name || conv.phone_number} size={42} />
          <div style={styles.info}>
            <div style={styles.row}>
              <span style={styles.name}>{conv.contact_name || conv.phone_number}</span>
              {conv.unread_count > 0 && (
                <span style={styles.badge}>{conv.unread_count}</span>
              )}
            </div>
            <div style={styles.phone}>{conv.phone_number}</div>
            <div style={styles.status}>{conv.status}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  list: { overflowY: 'auto', flex: 1 },
  empty: { padding: 24, color: '#999', textAlign: 'center', fontSize: 14 },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid #f0f0f0',
    transition: 'background 0.15s',
  },
  info: { flex: 1, minWidth: 0 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  phone: { fontSize: 12, color: '#888', marginTop: 2 },
  status: { fontSize: 11, color: '#aaa', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  badge: {
    background: '#25D366',
    color: '#fff',
    borderRadius: 10,
    padding: '1px 7px',
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
  },
};
