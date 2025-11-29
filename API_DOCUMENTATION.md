# API Documentation

This document covers all HTTP API endpoints available in the rizzy-bytes helpdesk system. The front-end should use these endpoints to interact with backend services.

---

## Service Base URLs

| Service | Port | Host (Dev) | Host (Docker) | URL |
|---------|------|-----------|---------------|-----|
| **Authentication Service** | 3001 | localhost | authentication-service | `http://localhost:3001` or `http://authentication-service:3000` |
| **Broker Service** | 3002 | localhost | broker-service | `http://localhost:3002` or `http://broker-service:3000` |
| **Mail Service** | 3004 | localhost | mail-service | `http://localhost:3004` or `http://mail-service:3000` |
| **Flowise Proxy** | 4000 | localhost | flowise-proxy | `http://localhost:4000` or `http://flowise-proxy:4000` |
| **Front-end** | 3000 | localhost | front-end | `http://localhost:3000` |
| **Logger Service** | 3005 | localhost | logger-service | `http://localhost:3005` or `http://logger-service:3000` |

---

## Authentication Service (`http://localhost:3001`)

### POST `/auth/login`
User login endpoint.

**Request:**
```json
{
  "identifier": "email@example.com OR username",
  "password": "user_password"
}
```

**Response (200):**
```json
{
  "message": "Login success",
  "user": {
    "email": "user@example.com",
    "role": "student"
  }
}
```

**Error Responses:**
- `404 { "message": "User not found" }` — User doesn't exist
- `400 { "message": "Invalid credentials" }` — Password mismatch
- `500 { "message": "error details" }` — Server error

**Notes:**
- `identifier` can be either email or username (usn)
- Returns user info but no token (stateless or session-based approach)
- CORS enabled for localhost:3000

---

### POST `/auth/register`
User registration endpoint.

**Request:**
```json
{
  "email": "newuser@example.com",
  "usn": "username_or_student_id",
  "password": "secure_password",
  "role": "guest",  // optional, defaults to "guest"
  "photoProfile": "url_to_profile_pic"  // optional
}
```

**Response (201):**
```json
{
  "message": "User created successfully",
}
```

**Error Responses:**
- `400 { "error": "User already exists" }` — Email or USN already registered
- `500 { "error": "error details" }` — Server error

**Notes:**
- OTP is sent via broker/mail service for verification
- Role defaults to "guest" if not specified
- Common roles: `"student"`, `"staff"`, `"admin"`,`"guest"`

---

### GET `/health`
Health check endpoint.

**Response (200):**
```json
{ "status": "ok" }
```

---

## Broker Service (`http://localhost:3002`)

The broker service publishes events to RabbitMQ for asynchronous processing (email, logs, etc.).

### POST `/publish/otp`
Publish OTP event for email sending.

**Request:**
```json
{
  "type": "SEND_OTP",
  "to": "user@example.com",
  "otp": "123456",
  "purpose": "register"  // or "login", "reset_password", etc.
}
```

**Response (200):**
```json
{ "ok": true }
```

**Notes:**
- Asynchronous: returns immediately, email sent in background
- Used during registration and password reset flows
- Listener service consumes this event and sends actual email

---

### POST `/publish/log`
Publish log event for centralized logging.

**Request:**
```json
{
  "service": "authentication-service",
  "level": "info",  // or "warn", "error", "debug"
  "event": "user_registered",
  "message": "User john@example.com logged in",
  "context": {
    "userId": "123",
    "extra": "metadata"
  }
}
```

**Response (200):**
```json
{ "ok": true }
```

**Notes:**
- Services use this to log events asynchronously; listener binds to `log.*` and forwards into logger-service
- Logger service consumes and stores logs; sampling/redaction applied automatically
- Useful for debugging and monitoring
 
---

## Logger Service (`http://localhost:3005`)

Centralized log ingestion and retrieval.

### POST `/logs`
Ingest a structured log event (HTTP path; services normally publish via broker).

**Request:**
```json
{
  "level": "info",       // fatal|error|warn|info|debug|trace
  "event": "otp_requested",
  "message": "OTP issued for login",
  "service": "authentication-service",
  "requestId": "uuid-req",
  "correlationId": "uuid-corr",
  "userId": "optional-user-id",
  "resource": "/auth/login",
  "statusCode": 200,
  "durationMs": 120,
  "tags": ["auth", "otp"],
  "context": {
    "email": "user@example.com",
    "usn": "USR123"
  }
}
```

**Response (202):**
```json
{ "received": true, "sampled": true }
```

**Notes:**
- Avoids sensitive keys (password/token/otp/secret/cookie/etc. are stripped).
- Typically invoked via `broker-service /publish/log` to go through RabbitMQ.
- Uses sampling; errors/warns always kept, info/debug sampled via `LOG_SAMPLE_RATE`.

### GET `/logs`
Fetch recent log entries from the current (date-based) log file. Requires JWT with role `admin` or `staff`.

**Headers:**
- `Authorization: Bearer <jwt>` (same secret as authentication-service `JWT_SECRET`)

**Query Params (optional):**
- `date=YYYY-MM-DD` (default: today)
- `limit=200` (max 1000)
- `service=authenticaton-service` (filter by service)
- `level=error` (filter by level)
- `event=otp_requested` (filter by event name)
- `q=search text` (search in message/context)

**Response (200):**
```json
{
  "logs": [
    {
      "level": "info",
      "time": "2025-11-29T09:45:41.930Z",
      "service": "authentication-service",
      "event": "otp_requested",
      "message": "OTP issued for login",
      "requestId": "uuid-req",
      "correlationId": "uuid-corr",
      "resource": "/auth/login",
      "statusCode": 200,
      "durationMs": 120,
      "context": { "email": "user@example.com", "usn": "USR123" }
    }
  ],
  "count": 1
}
```

**Auth & Roles:**
- Uses JWT verification (`AUTH_JWT_SECRET`/`JWT_SECRET`); requires `role` claim to be `admin` or `staff`.
  
**Notes:**
- Logs are stored as JSON lines in `logs/logger-YYYY-MM-DD.log` with retention control.
- Pretty console output is enabled by default; disable with `LOG_PRETTY=false`.

---

### GET `/health`
Health check endpoint.

**Response (200):**
```json
{ "status": "ok" }
```

---

## Mail Service (`http://localhost:3004`)

Handles email sending (integrates with MailHog in dev).

### POST `/send`
Send an email.

**Request:**
```json
{
  "to": "recipient@example.com",
  "subject": "Welcome to Helpdesk",
  "text": "Plain text version (optional)",
  "html": "<h1>Welcome!</h1><p>HTML email body</p>"
}
```

**Response (200):**
```json
{ "sent": true }
```

**Error Responses:**
- `500 { "error": "error details" }` — SMTP error

**Notes:**
- In development, emails are sent to MailHog (viewable at `http://localhost:8025`)
- Can use either `text` or `html` (or both)
- Used by listener service when processing OTP events

---

### GET `/health`
Health check endpoint.

**Response (200):**
```json
{ "status": "ok" }
```

---

## Flowise Proxy (`http://localhost:4000`)

Proxy for Flowise AI chatbot with knowledge base and chat history management.

### POST `/api/v1/prediction/:flowId`
Send a prediction request to a Flowise flow (single message).

**Request:**
```json
{
  "question": "What are office hours?",
  "sessionId": "uuid-or-session-id",  // optional, generates if not provided
  "userId": "user-id"  // optional, for tracking
}
```

**Response (200):**
```json
{
  "message": "AI response text here",
  "sessionId": "uuid-of-session",
  "sourceDocuments": [
    {
      "id": "doc1",
      "name": "office_hours.pdf",
      "relevance": 0.95
    }
  ]
}
```

**Notes:**
- Multi-round conversations: reuse the same `sessionId` for follow-ups
- `sessionId` is auto-generated and returned; use it for next message in same session
- `sourceDocuments` lists knowledge base documents used for the answer
- Stored in MongoDB for chat history

---

### POST `/api/v1/prediction/:flowId/stream`
Stream a prediction response (for real-time chat UI updates).

**Request:**
```json
{
  "question": "What are office hours?",
  "sessionId": "uuid-or-session-id",
  "stream": true
}
```

**Response (200):**
Uses Server-Sent Events (SSE) stream. Headers:
```
Content-Type: text/event-stream
```

Streamed data format:
```
data: {"token": "The"}
data: {"token": " office"}
data: {"token": " is"}
...
data: "[DONE]"
```

**Notes:**
- Use `eventSource` or axios with `responseType: "stream"` in frontend
- Real-time token streaming for better UX
- Same session persistence as non-streaming endpoint

---

### GET `/api/chat/history/:flowId`
List all chat sessions for a flow.

**Response (200):**
```json
{
  "flowId": "2d844a72-3dc8-4475-8134-9f034015741f",
  "sessions": [
    {
      "sessionId": "uuid-1",
      "createdAt": "2025-11-21T10:30:00Z",
      "updatedAt": "2025-11-21T10:45:00Z",
      "messageCount": 4
    },
    {
      "sessionId": "uuid-2",
      "createdAt": "2025-11-21T09:00:00Z",
      "updatedAt": "2025-11-21T09:15:00Z",
      "messageCount": 2
    }
  ]
}
```

**Query Parameters:**
- `summary=true` — Return only summary (no messages)
- `includeMessages=true` — Include full message history (default: true)

---

### GET `/api/chat/history/:flowId/:sessionId`
Get full chat history for a specific session.

**Response (200):**
```json
{
  "flowId": "2d844a72-3dc8-4475-8134-9f034015741f",
  "sessionId": "uuid-session-id",
  "messages": [
    {
      "role": "user",
      "content": "What are office hours?",
      "timestamp": "2025-11-21T10:30:00Z"
    },
    {
      "role": "assistant",
      "content": "The office hours are...",
      "sourceDocuments": [{"id": "doc1", "name": "hours.pdf"}],
      "timestamp": "2025-11-21T10:30:05Z"
    },
    {
      "role": "user",
      "content": "What about weekends?",
      "timestamp": "2025-11-21T10:31:00Z"
    },
    {
      "role": "assistant",
      "content": "On weekends...",
      "timestamp": "2025-11-21T10:31:10Z"
    }
  ]
}
```

**Error Responses:**
- `404 { "error": "Chat session not found" }` — Session doesn't exist

---

### GET `/api/kb` or `/api/kb/store/:storeId`
Get knowledge base documents (manifest).

**Response (200):**
```json
{
  "storeId": "d21759a2-d263-414e-b5a4-f2e5819d516e",
  "documents": [
    {
      "docId": "loader-1",
      "filename": "office_hours.pdf",
      "size": 245632,
      "uploadedAt": "2025-11-20T15:30:00Z",
      "metadata": {
        "department": "HR",
        "category": "policies"
      }
    },
    {
      "docId": "loader-2",
      "filename": "faq.pdf",
      "size": 512000,
      "uploadedAt": "2025-11-19T10:00:00Z"
    }
  ],
  "store": {
    "id": "d21759a2-d263-414e-b5a4-f2e5819d516e",
    "name": "Helpdesk KB"
  }
}
```

---

### GET `/api/kb/:storeId/loaders` or `/api/kb/loaders`
List documents in knowledge base (same as manifest).

---

### GET `/api/kb/:storeId/loaders/:loaderId/chunks`
Get chunks (text segments) from a document.

**Query Parameters:**
- `page=1` or `pageNo=1` — Page number (default: 1)

**Response (200):**
```json
{
  "loaderId": "loader-1",
  "page": 1,
  "chunks": [
    {
      "id": "chunk-1",
      "content": "Office hours are Monday to Friday 9 AM to 5 PM...",
      "page": 1
    },
    {
      "id": "chunk-2",
      "content": "Closed on public holidays...",
      "page": 1
    }
  ],
  "totalPages": 5
}
```

---

### POST `/api/kb/:storeId/loaders` or `/api/kb/loaders`
Upload a document to knowledge base.

**Request:**
- **Content-Type:** `multipart/form-data`
- **Fields:**
  - `file` (required) — PDF, DOCX, TXT, etc.
  - `metadata` (optional) — JSON string with custom metadata
  - `replaceExisting` (optional) — "true" to replace if docId exists

**Example (using FormData):**
```javascript
const formData = new FormData();
formData.append('file', file);  // File object
formData.append('metadata', JSON.stringify({
  department: 'HR',
  category: 'policies'
}));
```

**Response (200):**
```json
{
  "docId": "loader-new-1",
  "filename": "office_hours.pdf",
  "storeId": "d21759a2-d263-414e-b5a4-f2e5819d516e",
  "size": 245632,
  "uploadedAt": "2025-11-21T14:00:00Z"
}
```

---

### DELETE `/api/kb/:storeId/loaders/:loaderId` or `/api/kb/loaders/:loaderId`
Delete a document from knowledge base.

**Response (200):**
```json
{
  "docId": "loader-1",
  "deleted": true,
  "storeId": "d21759a2-d263-414e-b5a4-f2e5819d516e"
}
```

---

### POST `/api/kb/:storeId/loaders/:loaderId/process` or `/api/kb/loaders/:loaderId/process`
Reprocess a document (update metadata, re-split chunks, etc.).

**Request:**
- **Content-Type:** `multipart/form-data`
- **Fields:**
  - `file` (optional) — New file to replace
  - `metadata` (optional) — Updated metadata
  - `replaceExisting` (optional) — "true" to replace content

**Response (200):**
```json
{
  "docId": "loader-1",
  "processedAt": "2025-11-21T14:10:00Z",
  "status": "success"
}
```

---

### POST `/api/kb/:storeId/upsert` or `/api/kb/upsert`
Upsert (insert or update) documents via JSON.

**Request:**
```json
{
  "docId": "manual-doc-1",
  "text": "Office policy content here...",
  "metadata": {
    "source": "manual",
    "department": "HR"
  }
}
```

**Response (200):**
```json
{
  "docId": "manual-doc-1",
  "status": "upserted",
  "chunksCount": 3
}
```

---

### POST `/api/kb/:storeId/refresh` or `/api/kb/refresh`
Refresh/rebuild the knowledge base (reprocess all documents).

**Request:** (empty body or {})

**Response (200):**
```json
{
  "status": "refresh_started",
  "totalDocuments": 5
}
```

**Notes:**
- Async operation, returns immediately
- Check document list later to see updated status

---

### GET `/health`
Health check endpoint.

**Response (200):**
```json
{ "status": "ok" }
```

---

## Frontend Integration Examples

### Login Flow
```javascript
// 1. Login
const loginResponse = await fetch('http://localhost:3001/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    identifier: 'user@example.com',
    password: 'password'
  })
});

const { user, message } = await loginResponse.json();
if (!loginResponse.ok) {
  alert(message);  // "User not found" or "Invalid credentials"
} else {
  // Store user info or session
  sessionStorage.setItem('user', JSON.stringify(user));
}
```

### Chat with Knowledge Base
```javascript
// 2. Send a question to the chatbot
const chatResponse = await fetch('http://localhost:4000/api/v1/prediction/2d844a72-3dc8-4475-8134-9f034015741f', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: 'What are office hours?',
    sessionId: currentSessionId || undefined  // Reuse for multi-round
  })
});

const { message, sessionId, sourceDocuments } = await chatResponse.json();

// 3. Store sessionId for next turn
currentSessionId = sessionId;

// 4. Display answer and source documents
displayAnswer(message);
displaySources(sourceDocuments);
```

### Upload Document to KB
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('metadata', JSON.stringify({
  department: 'IT',
  category: 'guides'
}));

const uploadResponse = await fetch('http://localhost:4000/api/kb/loaders', {
  method: 'POST',
  body: formData
});

const { docId, filename } = await uploadResponse.json();
console.log(`Uploaded: ${filename} (${docId})`);
```

### Stream Chat Response
```javascript
const response = await fetch('http://localhost:4000/api/v1/prediction/2d844a72-3dc8-4475-8134-9f034015741f/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: 'Explain our policies',
    sessionId: currentSessionId,
    stream: true
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let fullText = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const json = JSON.parse(line.slice(6));
      fullText += json.token || json.text || '';
      updateChatDisplay(fullText);  // Live update UI
    }
  }
}
```

---

## Error Handling

All services follow a consistent error format:

**Error Response (4xx/5xx):**
```json
{
  "message": "Descriptive error message",
  "error": "error details (optional)"
}
```

**Common Status Codes:**
- `200` — Success
- `201` — Created (registration, upload)
- `400` — Bad request (invalid input)
- `401` — Unauthorized (missing auth)
- `404` — Not found (user, session, document)
- `500` — Server error

---

## CORS & Authentication

- **CORS:** All services allow `http://localhost:3000` and `http://127.0.0.1:3000`
- **Authentication:** Currently stateless (login returns user info, no token management in backend yet)
- **Sessions:** Chat sessions use `sessionId` UUID for multi-round conversations

---

## Environment Variables (Frontend)

```bash
# .env.local
NEXT_PUBLIC_AUTH_API_URL=http://localhost:3001
NEXT_PUBLIC_FLOWISE_PROXY_URL=http://localhost:4000
NEXT_PUBLIC_BROKER_URL=http://localhost:3002
NEXT_PUBLIC_MAIL_URL=http://localhost:3004
```

---

## Flow IDs (Flowise)

- **Main Helpdesk Flow:** `2d844a72-3dc8-4475-8134-9f034015741f`

(Add more as you create flows in Flowise UI)

---

## Testing Endpoints

Use Postman, cURL, or VS Code REST Client:

```
### Login
POST http://localhost:3001/auth/login
Content-Type: application/json

{
  "identifier": "test@example.com",
  "password": "password"
}

### Chat
POST http://localhost:4000/api/v1/prediction/2d844a72-3dc8-4475-8134-9f034015741f
Content-Type: application/json

{
  "question": "What are office hours?"
}

### Chat History
GET http://localhost:4000/api/chat/history/2d844a72-3dc8-4475-8134-9f034015741f
```

