import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import ConversationList from '../components/ConversationList';
import MessageThread from '../components/MessageThread';
import MessageInput from '../components/MessageInput';
import AgentBadge from '../components/AgentBadge';
import { getConversations, getMessages, sendMessage, updateConversation } from '../api/conversations';

export default function Inbox() {
  const { agent, logout } = useAuth();
  const { socket } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);

  // Load conversation list
  useEffect(() => {
    getConversations().then(setConversations).catch(console.error);
  }, []);

  // Load messages when a conversation is selected
  useEffect(() => {
    if (!selectedConv) return;
    getMessages(selectedConv.id).then(setMessages).catch(console.error);

    // Reset unread count
    if (selectedConv.unread_count > 0) {
      updateConversation(selectedConv.id, {}).catch(() => {});
      setConversations((prev) =>
        prev.map((c) => (c.id === selectedConv.id ? { ...c, unread_count: 0 } : c))
      );
    }
  }, [selectedConv?.id]);

  // Real-time: new inbound message
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = ({ conversationId, message }) => {
      // Add to thread if this conversation is open
      if (selectedConv?.id === conversationId) {
        setMessages((prev) => [...prev, message]);
      }
      // Update conversation list
      setConversations((prev) => {
        const exists = prev.find((c) => c.id === conversationId);
        if (exists) {
          return prev
            .map((c) =>
              c.id === conversationId
                ? { ...c, last_message_at: message.timestamp, unread_count: selectedConv?.id === conversationId ? 0 : c.unread_count + 1 }
                : c
            )
            .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
        }
        // New conversation — reload list
        getConversations().then(setConversations);
        return prev;
      });
    };

    const handleStatusUpdate = ({ messageId, status }) => {
      setMessages((prev) =>
        prev.map((m) => (m.whatsapp_message_id === messageId ? { ...m, status } : m))
      );
    };

    socket.on('new_message', handleNewMessage);
    socket.on('message_status', handleStatusUpdate);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('message_status', handleStatusUpdate);
    };
  }, [socket, selectedConv?.id]);

  // Join socket room when conversation selected
  useEffect(() => {
    if (!socket || !selectedConv) return;
    socket.emit('join_conversation', { conversationId: selectedConv.id });
  }, [socket, selectedConv?.id]);

  const handleSelectConv = (conv) => {
    setSelectedConv(conv);
    setMessages([]);
  };

  const handleSend = async (text) => {
    setSending(true);
    try {
      const message = await sendMessage(selectedConv.id, text);
      setMessages((prev) => [...prev, message]);
      setConversations((prev) =>
        prev
          .map((c) => (c.id === selectedConv.id ? { ...c, last_message_at: message.timestamp } : c))
          .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at))
      );
    } catch (err) {
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (status) => {
    try {
      const updated = await updateConversation(selectedConv.id, { status });
      setSelectedConv((prev) => ({ ...prev, status: updated.status }));
      setConversations((prev) =>
        prev.map((c) => (c.id === selectedConv.id ? { ...c, status: updated.status } : c))
      );
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  return (
    <div style={styles.layout}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <AgentBadge name={agent?.name} size={36} />
          <span style={styles.agentName}>{agent?.name}</span>
          <button style={styles.logoutBtn} onClick={logout}>Out</button>
        </div>
        <div style={styles.sidebarTitle}>Conversations</div>
        <ConversationList
          conversations={conversations}
          selectedId={selectedConv?.id}
          onSelect={handleSelectConv}
        />
      </div>

      {/* Main panel */}
      <div style={styles.main}>
        {selectedConv ? (
          <>
            <div style={styles.chatHeader}>
              <AgentBadge name={selectedConv.contact_name || selectedConv.phone_number} size={38} />
              <div style={styles.chatHeaderInfo}>
                <div style={styles.chatHeaderName}>{selectedConv.contact_name || selectedConv.phone_number}</div>
                <div style={styles.chatHeaderPhone}>{selectedConv.phone_number}</div>
              </div>
              <select
                style={styles.statusSelect}
                value={selectedConv.status}
                onChange={(e) => handleStatusChange(e.target.value)}
              >
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <MessageThread messages={messages} currentAgent={agent} />
            <MessageInput onSend={handleSend} disabled={sending} />
          </>
        ) : (
          <div style={styles.noSelection}>
            <div style={styles.noSelectionIcon}>💬</div>
            <p>Select a conversation to start</p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  layout: { display: 'flex', height: '100vh', overflow: 'hidden' },
  sidebar: { width: 320, borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column', background: '#fff' },
  sidebarHeader: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #eee' },
  agentName: { flex: 1, fontWeight: 600, fontSize: 14 },
  logoutBtn: { background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, color: '#666' },
  sidebarTitle: { padding: '10px 16px 6px', fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  chatHeader: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', background: '#fff', borderBottom: '1px solid #eee' },
  chatHeaderInfo: { flex: 1 },
  chatHeaderName: { fontWeight: 700, fontSize: 15 },
  chatHeaderPhone: { fontSize: 12, color: '#888' },
  statusSelect: { padding: '5px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, cursor: 'pointer' },
  noSelection: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#aaa', gap: 12 },
  noSelectionIcon: { fontSize: 48 },
};
