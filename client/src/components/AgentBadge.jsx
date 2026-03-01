export default function AgentBadge({ name, size = 32 }) {
  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div style={{ ...styles.badge, width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </div>
  );
}

const styles = {
  badge: {
    borderRadius: '50%',
    background: '#25D366',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    flexShrink: 0,
  },
};
