# WhatsApp Shared Inbox — Project Specification

## Project Overview

Build a **multi-agent shared inbox** for WhatsApp Business API that allows multiple backoffice team members to view, manage, and respond to customer conversations in real time. All conversations (incoming and outgoing) must be stored persistently in a database.

This replaces the Meta Business Suite inbox with a custom solution that gives full data ownership and conversation storage.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Real-time | Socket.io |
| Frontend | React (Vite) |
| Hosting | Railway or Render |
| Auth | JWT (JSON Web Tokens) |

---

## Core Features

### Must Have (MVP)
- Receive incoming WhatsApp messages via Meta webhook
- Store all incoming and outgoing messages in PostgreSQL
- Real-time message display using Socket.io
- Multi-agent login (team members can log in and see the inbox)
- Reply to customers from the UI (via WhatsApp Business API)
- Conversation list with unread indicators
- Assign conversations to specific agents
- Contact management (name, phone number, notes)

### Nice to Have (Post-MVP)
- Message search
- Conversation tags/labels
- Canned responses (quick replies)
- Media file storage (images, audio, documents)
- Conversation history export
- Basic analytics (response times, volume per day)
- Agent activity log (who replied what and when)

---

## Project Structure

```
whatsapp-inbox/
├── server/
│   ├── index.js              # Express app entry point
│   ├── routes/
│   │   ├── webhook.js        # Meta webhook receiver
│   │   ├── messages.js       # Send message API
│   │   ├── conversations.js  # Conversation management
│   │   ├── contacts.js       # Contact management
│   │   └── auth.js           # Login / JWT
│   ├── middleware/
│   │   ├── auth.js           # JWT verification middleware
│   │   └── metaSignature.js  # Verify Meta webhook signature
│   ├── db/
│   │   ├── pool.js           # PostgreSQL connection pool
│   │   └── migrations/       # SQL migration files
│   ├── services/
│   │   ├── whatsapp.js       # WhatsApp API calls (send message, etc.)
│   │   └── socket.js         # Socket.io event emitters
│   └── config.js             # Environment variable config
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   └── Inbox.jsx
│   │   ├── components/
│   │   │   ├── ConversationList.jsx
│   │   │   ├── MessageThread.jsx
│   │   │   ├── MessageInput.jsx
│   │   │   └── AgentBadge.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── SocketContext.jsx
│   │   └── api/              # Axios API calls to backend
├── .env                      # Environment variables (never commit this)
├── .env.example              # Example env file (safe to commit)
└── package.json
```

---

## Database Schema

```sql
-- Agents (backoffice team members)
CREATE TABLE agents (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'agent', -- 'admin' or 'agent'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Contacts (customers)
CREATE TABLE contacts (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL, -- WhatsApp phone number with country code
  name VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Conversations
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  contact_id INTEGER REFERENCES contacts(id),
  assigned_agent_id INTEGER REFERENCES agents(id),
  status VARCHAR(20) DEFAULT 'open', -- 'open', 'resolved', 'pending'
  last_message_at TIMESTAMP,
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Messages
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id),
  whatsapp_message_id VARCHAR(255) UNIQUE, -- Meta's message ID
  direction VARCHAR(10) NOT NULL, -- 'inbound' or 'outbound'
  message_type VARCHAR(20) DEFAULT 'text', -- 'text', 'image', 'audio', 'document', 'video'
  content TEXT, -- message text
  media_url TEXT, -- URL to stored media (if applicable)
  media_mime_type VARCHAR(100),
  sent_by_agent_id INTEGER REFERENCES agents(id), -- null for inbound
  status VARCHAR(20) DEFAULT 'received', -- 'received', 'sent', 'delivered', 'read', 'failed'
  timestamp TIMESTAMP NOT NULL,
  raw_payload JSONB, -- store full Meta webhook payload for debugging
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX idx_conversations_contact ON conversations(contact_id);
```

---

## Environment Variables

```env
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/whatsapp_inbox

# Meta / WhatsApp
META_VERIFY_TOKEN=your_custom_verify_token_here
META_APP_SECRET=your_meta_app_secret
WHATSAPP_ACCESS_TOKEN=your_whatsapp_permanent_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_API_VERSION=v19.0

# Auth
JWT_SECRET=your_long_random_jwt_secret_here
JWT_EXPIRES_IN=7d

# Client (for Vite)
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
```

---

## Meta Webhook Setup

### Webhook Verification (GET)
Meta will call your endpoint with a challenge to verify ownership.

```js
// GET /webhook
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});
```

### Webhook Receiver (POST)
All incoming messages arrive here.

```js
// POST /webhook
// Always verify Meta's X-Hub-Signature-256 header before processing
```

### Signature Verification Middleware
```js
// middleware/metaSignature.js
const crypto = require('crypto');

module.exports = (req, res, buf) => {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return; // will be caught in route
  
  const expectedSignature = 'sha256=' + 
    crypto.createHmac('sha256', process.env.META_APP_SECRET)
      .update(buf)
      .digest('hex');
  
  if (signature !== expectedSignature) {
    throw new Error('Invalid Meta signature');
  }
};
```

### Incoming Message Payload Structure
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "id": "wamid.xxx",
          "from": "31612345678",
          "timestamp": "1700000000",
          "type": "text",
          "text": { "body": "Hello!" }
        }],
        "contacts": [{
          "profile": { "name": "Customer Name" },
          "wa_id": "31612345678"
        }]
      }
    }]
  }]
}
```

---

## WhatsApp API — Send Message

```js
// services/whatsapp.js
const axios = require('axios');

const sendTextMessage = async (toPhoneNumber, messageText) => {
  const url = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  
  const response = await axios.post(url, {
    messaging_product: 'whatsapp',
    to: toPhoneNumber,
    type: 'text',
    text: { body: messageText }
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.data; // contains message id
};
```

---

## Real-time Architecture (Socket.io)

### Events emitted from server to clients
| Event | Payload | Description |
|---|---|---|
| `new_message` | `{ conversationId, message }` | New inbound message received |
| `message_sent` | `{ conversationId, message }` | Outbound message confirmed sent |
| `conversation_updated` | `{ conversation }` | Status or assignment changed |
| `message_status` | `{ messageId, status }` | Delivery/read receipt |

### Events emitted from client to server
| Event | Payload | Description |
|---|---|---|
| `join_conversation` | `{ conversationId }` | Agent opens a conversation |
| `typing` | `{ conversationId, agentName }` | Agent is typing |

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Agent login, returns JWT |
| GET | `/api/auth/me` | Get current agent info |

### Conversations
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/conversations` | List all conversations (paginated) |
| GET | `/api/conversations/:id` | Get single conversation with messages |
| PATCH | `/api/conversations/:id` | Update status or assigned agent |

### Messages
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/conversations/:id/messages` | Get messages for a conversation |
| POST | `/api/conversations/:id/messages` | Send a message to customer |

### Contacts
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/contacts` | List all contacts |
| GET | `/api/contacts/:id` | Get single contact |
| PATCH | `/api/contacts/:id` | Update contact name/notes |

### Webhook (Meta)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/webhook` | Meta webhook verification |
| POST | `/webhook` | Receive incoming messages |

---

## Security Checklist

- [ ] Always verify Meta webhook signature on every POST to `/webhook`
- [ ] Use JWT for all API routes (except `/webhook` and `/api/auth/login`)
- [ ] Store passwords with bcrypt (minimum 12 rounds)
- [ ] Use HTTPS in production (required by Meta for webhooks)
- [ ] Sanitize all user inputs before database queries (use parameterized queries)
- [ ] Never log or expose `WHATSAPP_ACCESS_TOKEN` or `META_APP_SECRET`
- [ ] Rate limit the login endpoint to prevent brute force
- [ ] Store `.env` in `.gitignore` — never commit secrets

---

## Media Handling

Meta only hosts media files for **30 days**. To keep them permanently:

1. When a media message arrives (image, audio, document), extract the `media_id` from the webhook payload
2. Use the Media API to get a temporary download URL: `GET /{media_id}`
3. Download the file to your own storage (local filesystem, AWS S3, Cloudflare R2, etc.)
4. Store your own URL in the `messages.media_url` column

```js
// Fetch media URL from Meta
const getMediaUrl = async (mediaId) => {
  const response = await axios.get(
    `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${mediaId}`,
    { headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` } }
  );
  return response.data.url; // temporary URL, valid for a short time
};
```

---

## WhatsApp Business API — Important Rules

- You can only send free-form messages within a **24-hour customer service window** after the customer's last message. After 24 hours, you must use approved **Message Templates**.
- Message Templates must be pre-approved by Meta before use.
- Each WhatsApp Business Account (WABA) has messaging limits that scale with usage and quality rating.
- Store the `wamid` (WhatsApp message ID) returned when sending messages — use it to track delivery status via webhook status updates.

---

## Deployment Checklist

- [ ] PostgreSQL database provisioned and migrations run
- [ ] Environment variables set in hosting platform
- [ ] HTTPS enabled (required for Meta webhooks)
- [ ] Webhook URL registered in Meta App Dashboard: `https://yourdomain.com/webhook`
- [ ] Webhook subscribed to: `messages`, `message_deliveries`, `message_reads`
- [ ] WhatsApp phone number connected and API access token generated
- [ ] At least one admin agent account created in the database

---

## Development Order (Recommended)

1. **Setup** — Initialize Node.js project, install dependencies, connect PostgreSQL, run migrations
2. **Webhook** — Build and test the Meta webhook receiver (use Meta's webhook tester in the dashboard)
3. **Message storage** — Parse incoming webhook payloads and save to DB
4. **Send messages** — Build the outbound message API and test end-to-end
5. **Auth** — Add JWT login for agents
6. **REST API** — Build conversation and message list endpoints
7. **React frontend** — Build the UI (conversation list + message thread + reply box)
8. **Socket.io** — Add real-time updates so new messages appear instantly
9. **Polish** — Unread counts, agent assignment, conversation status
10. **Deploy** — Deploy to Railway/Render, configure webhook URL in Meta dashboard

---

## Key Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.0",
    "pg": "^8.11.0",
    "socket.io": "^4.6.0",
    "axios": "^1.5.0",
    "bcrypt": "^5.1.0",
    "jsonwebtoken": "^9.0.0",
    "dotenv": "^16.0.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
```

---

## Notes for Claude Code

- Always use parameterized queries (`$1, $2`) with the `pg` library — never string interpolate SQL
- Keep the webhook route lean — receive, verify, and hand off to a processing function immediately; return 200 OK to Meta as fast as possible to avoid retries
- Socket.io should be initialized once and exported as a singleton — import it in routes to emit events
- The React frontend should have a persistent Socket.io connection managed via a Context provider
- When in doubt about Meta API behavior, refer to: https://developers.facebook.com/docs/whatsapp/cloud-api
