# API Documentation

This document covers all HTTP API endpoints available in the rizzy-bytes helpdesk system. The front-end should use these endpoints to interact with backend services.

---

## Service Base URLs

| Service                      | Port | Host (Dev) | Host (Docker)          | URL                                                             |
| ---------------------------- | ---- | ---------- | ---------------------- | --------------------------------------------------------------- |
| **Authentication Service**   | 3001 | localhost  | authentication-service | `http://localhost:3001` or `http://authentication-service:3000` |
| **Broker Service**           | 3002 | localhost  | broker-service         | `http://localhost:3002` or `http://broker-service:3000`         |
| **Mail Service**             | 3004 | localhost  | mail-service           | `http://localhost:3004` or `http://mail-service:3000`           |
| **Flowise Proxy**            | 4000 | localhost  | flowise-proxy          | `http://localhost:4000` or `http://flowise-proxy:4000`          |
| **Front-end**                | 3000 | localhost  | front-end              | `http://localhost:3000`                                         |
| **Logger Service**           | 3005 | localhost  | logger-service         | `http://localhost:3005` or `http://logger-service:3000`         |
| **Prometheus (metrics API)** | 9090 | localhost  | prometheus             | `http://localhost:9090` or `http://prometheus:9090`             |

---

## Metrics / Observability

- Every service exposes Prometheus metrics at `/metrics` (listener worker listens on port 9464).
- Prometheus HTTP API (no CORS; call from backend/proxy):
  - Instant query: `GET /api/v1/query?query=<PROMQL>`
  - Range query: `GET /api/v1/query_range?query=<PROMQL>&start=<ts>&end=<ts>&step=<s>`
  - Example: `http://localhost:9090/api/v1/query?query=rate(flowise_proxy_http_request_duration_seconds_count[5m])`
- Front-end guidance: fetch Prometheus via your backend/proxy (or Grafana), not directly from the browser.

### Common PromQL Examples (for front-end via backend/proxy)

**Note:** Use **range queries** to fetch data for the past 15 minutes (for visualization). Range queries return time-series data points instead of single values.

#### Helper Function (JavaScript/Frontend)

```javascript
async function getPrometheusData(query) {
  const now = Math.floor(Date.now() / 1000); // Current timestamp (seconds)
  const start = now - 15 * 60; // 15 minutes ago
  const step = "30s";

  const encodedQuery = encodeURIComponent(query);
  const url = `http://localhost:9090/api/v1/query_range?query=${encodedQuery}&start=${start}&end=${now}&step=${step}`;

  const response = await fetch(url);
  const data = await response.json();
  return data.data.result;
}
```

#### CPU Avg %

- **PromQL:** `100 * (1 - avg by (instance)(rate(node_cpu_seconds_total{mode="idle"}[5m])))`
- **Range Query (15 min):**
  ```
  GET http://localhost:9090/api/v1/query_range?query=100%20*%20(1%20-%20avg%20by%20(instance)(rate(node_cpu_seconds_total%7Bmode%3D%22idle%22%7D%5B5m%5D)))&start=<now-900>&end=<now>&step=30s
  ```
- **JavaScript Example:**
  ```javascript
  const query =
    '100 * (1 - avg by (instance)(rate(node_cpu_seconds_total{mode="idle"}[5m])))';
  const cpuData = await getPrometheusData(query);
  // cpuData = [{ metric: {...}, values: [[timestamp, value], ...] }, ...]
  ```

#### GPU Utilization (if available)

- **PromQL:** `DCGM_FI_DEV_GPU_UTIL` (or `nvidia_gpu_utilization` depending on exporter)
- **Range Query (15 min):**
  ```
  GET http://localhost:9090/api/v1/query_range?query=DCGM_FI_DEV_GPU_UTIL&start=<now-900>&end=<now>&step=30s
  ```
- **JavaScript Example:**
  ```javascript
  const query = "DCGM_FI_DEV_GPU_UTIL";
  const gpuData = await getPrometheusData(query);
  ```

#### Memory Breakdown

- **Used Memory:** `node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes`
- **Cached Memory:** `node_memory_Cached_bytes`
- **Buffer Memory:** `node_memory_Buffers_bytes`
- **Range Query Examples (15 min):**
  ```
  GET http://localhost:9090/api/v1/query_range?query=node_memory_MemTotal_bytes%20-%20node_memory_MemAvailable_bytes&start=<now-900>&end=<now>&step=30s
  GET http://localhost:9090/api/v1/query_range?query=node_memory_Cached_bytes&start=<now-900>&end=<now>&step=30s
  GET http://localhost:9090/api/v1/query_range?query=node_memory_Buffers_bytes&start=<now-900>&end=<now>&step=30s
  ```
- **JavaScript Example:**
  ```javascript
  const usedMem = await getPrometheusData(
    "node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes"
  );
  const cached = await getPrometheusData("node_memory_Cached_bytes");
  const buffers = await getPrometheusData("node_memory_Buffers_bytes");
  ```

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
  "role": "guest", // optional, defaults to "guest"
  "photoProfile": "url_to_profile_pic" // optional
}
```

**Response (201):**

```json
{
  "message": "User created successfully"
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
  "purpose": "register" // or "login", "reset_password", etc.
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
  "level": "info", // or "warn", "error", "debug"
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
  "level": "info", // fatal|error|warn|info|debug|trace
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
- Logs are also persisted to MongoDB when `MONGO_URI` is configured (defaults to `mongodb://mongo:27017`).
- Pretty console output is enabled by default; disable with `LOG_PRETTY=false`.

---

### GET `/logs/export`

Export recent logs as CSV (human-friendly). Requires JWT with role `admin` or `staff`.

**Headers:**

- `Authorization: Bearer <jwt>`

**Query Params (optional):**

- `date=YYYY-MM-DD` (default: today)
- `limit=500` (max 1000)
- `service`, `level`, `event`, `q` (same filters as `/logs`)

**Response (200):**

- `text/csv` with columns: `time, level, service, event, message, resource, statusCode, durationMs, requestId, correlationId, userId, tags, ip, context`

**Notes:**

- Reads from MongoDB when available, otherwise falls back to local log files.
- Sets `Content-Disposition` for easier download.

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

**Authentication:** Required - Bearer token (JWT) via `Authorization` header

**Request:**

```json
{
  "question": "What are office hours?",
  "sessionId": "uuid-or-session-id", // optional, generates if not provided
  "userId": "user-id" // optional, for tracking
  // any additional fields are passed through to Flowise
}
```

**Response (200):**

```json
{
  "text": "AI response text here",
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

**Error Responses:**

- `401 { "error": "Missing Bearer token" }` — No authentication provided
- `429 { "error": "Too many concurrent predictions, please retry shortly" }` — Concurrency limit reached (default: 4)
- `400 { "error": "question is required" }` — Missing question field
- `500 { "error": "Unable to complete prediction" }` — Server error

**Headers:**

- `Authorization: Bearer <jwt>` (required)
- `Accept: text/event-stream` (optional, switches to streaming mode)

**Notes:**

- Multi-round conversations: reuse the same `sessionId` for follow-ups
- `sessionId` is auto-generated if not provided; use returned `sessionId` for next message in same session
- `sourceDocuments` lists knowledge base documents used for the answer
- Chat interactions are persisted to MongoDB
- Additional request fields (beyond `question`, `sessionId`, `userId`) are passed to Flowise
- Metrics collected: request duration, CPU usage, token estimates, GPU utilization

---

### POST `/api/v1/prediction/:flowId/stream`

Stream a prediction response (for real-time chat UI updates).

**Authentication:** Required - Bearer token (JWT) via `Authorization` header

**Request:**

```json
{
  "question": "What are office hours?",
  "sessionId": "uuid-or-session-id", // optional
  "userId": "user-id", // optional
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
event: done
data: "done"
```

**Headers:**

- `Authorization: Bearer <jwt>` (required)
- `Content-Type: text/event-stream` (response)

**Notes:**

- Use `EventSource` or fetch with `{ mode: 'no-cors', responseType: 'stream' }` in frontend
- Real-time token streaming for better UX
- Same session persistence as non-streaming endpoint
- Chat interactions persisted to MongoDB
- Metrics collected during streaming
- Stream automatically ends with `event: done` marker

---

### GET `/api/chat/history/:flowId`

List all chat sessions for a flow.

**Authentication:** Required - Bearer token (JWT) via `Authorization` header

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

**Headers:**

- `Authorization: Bearer <jwt>` (required)

**Error Responses:**

- `401 { "error": "Missing Bearer token" }` — No authentication
- `400 { "error": "flowId is required" }` — Missing flow ID
- `500 { "error": "Unable to load chat history" }` — Server error

---

### GET `/api/chat/history/:flowId/:sessionId`

Get full chat history for a specific session.

**Authentication:** Required - Bearer token (JWT) via `Authorization` header

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
      "sourceDocuments": [{ "id": "doc1", "name": "hours.pdf" }],
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

**Headers:**

- `Authorization: Bearer <jwt>` (required)

**Error Responses:**

- `401 { "error": "Missing Bearer token" }` — No authentication
- `400 { "error": "flowId and sessionId are required" }` — Missing parameters
- `404 { "error": "Chat session not found" }` — Session doesn't exist
- `500 { "error": "Unable to load chat session" }` — Server error

---

### GET `/api/kb` or `/api/kb/store/:storeId`
Get knowledge base documents with metadata.

**Authentication:** Required - Bearer token with `staff` or `admin` role

**Response (200):**

```json
{
  "storeId": "d21759a2-d263-414e-b5a4-f2e5819d516e",
  "documents": [
    {
      "storeId": "d21759a2-d263-414e-b5a4-f2e5819d516e",
      "loaderId": "loader-1",
      "kbId": "kb-entry-uuid",
      "name": "Office Hours Policy",
      "description": "Company office hours and schedule",
      "filename": "office_hours.pdf",
      "size": 245632,
      "uploadedAt": "2025-11-20T15:30:00Z",
      "metadata": {
        "department": "HR",
        "category": "policies"
      }
    }
  ],
  "store": {
    "id": "d21759a2-d263-414e-b5a4-f2e5819d516e",
    "name": "Helpdesk KB"
  }
}
```

**Headers:**

- `Authorization: Bearer <jwt>` (required, role must be `staff` or `admin`)

**Error Responses:**

- `401 { "error": "Missing Bearer token" }` — No authentication
- `403 { "error": "Forbidden" }` — Insufficient role permissions
- `500 { "error": "Unable to read document list" }` — Server error

---

### GET `/api/kb/:storeId/loaders` or `/api/kb/loaders`

List documents in knowledge base.

**Authentication:** Required - Bearer token with `staff` or `admin` role

**Response (200):**

```json
[
  {
    "storeId": "d21759a2-d263-414e-b5a4-f2e5819d516e",
    "loaderId": "loader-1",
    "kbId": "kb-entry-uuid",
    "name": "Office Hours Policy",
    "description": "Company office hours and schedule",
    "filename": "office_hours.pdf",
    "size": 245632,
    "uploadedAt": "2025-11-20T15:30:00Z",
    "metadata": {
      "department": "HR",
      "category": "policies"
    }
  }
]
```

**Headers:**

- `Authorization: Bearer <jwt>` (required, role must be `staff` or `admin`)

---

### GET `/api/kb/entries` or `/api/kb/:storeId/entries`
Get normalized knowledge base entries with full metadata from MongoDB KB store.

**Authentication:** Required - Bearer token with `staff` or `admin` role

**Response (200):**
```json
[
  {
    "storeId": "d21759a2-d263-414e-b5a4-f2e5819d516e",
    "loaderId": "loader-1",
    "kbId": "kb-entry-uuid",
    "name": "Office Hours Policy",
    "description": "Company office hours and schedule",
    "filename": "office_hours.pdf",
    "size": 245632,
    "uploadedAt": "2025-11-20T15:30:00Z",
    "createdAt": "2025-11-20T15:30:00Z",
    "updatedAt": "2025-11-20T15:30:00Z",
    "metadata": {
      "department": "HR",
      "category": "policies",
      "version": "1.0"
    }
  }
]
```

**Headers:**

- `Authorization: Bearer <jwt>` (required, role must be `staff` or `admin`)

**Notes:**
- Returns normalized entries directly from MongoDB KB store
- Includes full metadata for each entry (name, description, creation/update timestamps)
- `/api/kb/entries` uses default store ID
- `/api/kb/:storeId/entries` uses explicit store ID in URL

---

### GET `/api/kb/:storeId/loaders/:loaderId` or `/api/kb/loaders/:loaderId`
Get a single document with full details.

**Authentication:** Required - Bearer token with `staff` or `admin` role

**Response (200):**
```json
{
  "storeId": "d21759a2-d263-414e-b5a4-f2e5819d516e",
  "loaderId": "loader-1",
  "kbId": "kb-entry-uuid",
  "name": "Office Hours Policy",
  "description": "Company office hours and schedule",
  "filename": "office_hours.pdf",
  "size": 245632,
  "uploadedAt": "2025-11-20T15:30:00Z",
  "metadata": {
    "department": "HR",
    "category": "policies"
  },
  "createdAt": "2025-11-20T15:30:00Z",
  "updatedAt": "2025-11-20T15:30:00Z"
}
```

**Headers:**

- `Authorization: Bearer <jwt>` (required, role must be `staff` or `admin`)

**Error Responses:**
- `400 { "error": "loaderId is required" }` — Missing loader ID
- `404 { "error": "Unable to read knowledge base entry" }` — Loader not found

---

### GET `/api/kb/:storeId/loaders/:loaderId/chunks` or `/api/kb/loaders/:loaderId/chunks`
Get chunks (text segments) from a document.

**Authentication:** Required - Bearer token with `staff` or `admin` role

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

**Headers:**

- `Authorization: Bearer <jwt>` (required, role must be `staff` or `admin`)

**Error Responses:**
- `400 { "error": "loaderId is required" }` — Missing loader ID
- `502 { "error": "Flowise returned an unexpected HTML payload when requesting chunks" }` — Flowise error

---

### PUT `/api/kb/:storeId/loaders/:loaderId/chunks/:chunkId` or `/api/kb/loaders/:loaderId/chunks/:chunkId`
Update content of a specific chunk.

**Authentication:** Required - Bearer token with `staff` or `admin` role

**Request:**
```json
{
  "content": "Updated chunk content here...",
  "metadata": {
    "reviewed": true,
    "reviewer": "admin@example.com"
  }
}
```

**Response (200):**
```json
{
  "chunkId": "chunk-1",
  "loaderId": "loader-1",
  "updated": true,
  "updatedAt": "2025-11-21T14:15:00Z"
}
```

**Headers:**

- `Authorization: Bearer <jwt>` (required, role must be `staff` or `admin`)

**Error Responses:**
- `400 { "error": "loaderId and chunkId are required" }` — Missing parameters
- `400 { "error": "content is required" }` — Missing content field

---

### POST `/api/kb/:storeId/loaders` or `/api/kb/loaders`
Upload a document to knowledge base and automatically process it (extract text, split into chunks, embed).

**Authentication:** Required - Bearer token with `staff` or `admin` role

**Request:**

- **Content-Type:** `multipart/form-data`
- **Fields:**
  - `file` (required) — PDF, DOCX, CSV, TXT, XLS, XLSX, DOC (Allowed: .pdf, .doc, .docx, .csv, .xls, .xlsx)
  - `name` (required) — Display name for the document
  - `description` (required) — Brief description of document content
  - `metadata` (optional) — JSON string with additional custom metadata
  - `sourceUrl` (optional) — Source URL of the document
  - `replaceExisting` (optional) — "true" to replace existing document with same ID

**Example (using FormData):**

```javascript
const formData = new FormData();
formData.append('file', file);  // File object
formData.append('name', 'Office Hours Policy');
formData.append('description', 'Company office hours and business schedule');
formData.append('metadata', JSON.stringify({
  department: 'HR',
  category: 'policies',
  version: '1.0'
}));
formData.append('sourceUrl', 'https://example.com/policies/hours');
```

**Response (200 - Sync Mode):**

```json
{
  "docId": "loader-new-1",
  "loaderId": "loader-new-1",
  "kbId": "kb-entry-uuid",
  "filename": "office_hours.pdf",
  "storeId": "d21759a2-d263-414e-b5a4-f2e5819d516e",
  "size": 245632,
  "uploadedAt": "2025-11-21T14:00:00Z"
}
```

**Response (202 - Async Mode):**

```json
{
  "jobId": "job-uuid",
  "status": "queued"
}
```

**Headers:**

- `Authorization: Bearer <jwt>` (required, role must be `staff` or `admin`)
- `Content-Type: multipart/form-data`

**Error Responses:**
- `400 { "error": "file field is required" }` — No file provided
- `400 { "error": "name is required" }` — Missing document name
- `400 { "error": "description is required" }` — Missing description
- `400 { "error": "Unsupported file type. Allowed types: PDF, DOC, DOCX, CSV, XLS, XLSX" }` — Invalid file type
- `500 { "error": "Unable to upsert document" }` — Processing error
- `500 { "error": "Unable to enqueue KB ingestion" }` — Job queue error

**Notes:**
- If `ASYNC_KB=true` (environment variable), returns 202 with jobId and queues processing
- If `ASYNC_KB=false`, processes synchronously and returns 200 with document details
- Query job status with `GET /api/jobs/:jobId`
- File is automatically sanitized and stored in upload directory

---

### DELETE `/api/kb/:storeId/loaders/:loaderId` or `/api/kb/loaders/:loaderId`

Delete a document from knowledge base.

**Authentication:** Required - Bearer token with `staff` or `admin` role

**Response (200):**

```json
{
  "docId": "loader-1",
  "loaderId": "loader-1",
  "deleted": true,
  "storeId": "d21759a2-d263-414e-b5a4-f2e5819d516e"
}
```

**Headers:**

- `Authorization: Bearer <jwt>` (required, role must be `staff` or `admin`)

**Error Responses:**
- `400 { "error": "loaderId is required" }` — Missing loader ID
- `500 { "error": "Unable to delete document" }` — Deletion error

---

### PUT `/api/kb/:storeId/loaders/:loaderId` or `/api/kb/loaders/:loaderId`
Update or reprocess a document (update metadata, replace file, re-split chunks).

**Authentication:** Required - Bearer token with `staff` or `admin` role

**Request:**

- **Content-Type:** `multipart/form-data`
- **Fields:**
  - `file` (optional) — New file to replace document
  - `name` (optional) — Update document name
  - `description` (optional) — Update description
  - `metadata` (optional) — JSON string with updated metadata
  - `replaceExisting` (optional) — "false" to append chunks instead of replacing (default: true)

**Example (using FormData):**
```javascript
const formData = new FormData();
formData.append('file', updatedFile);  // Optional
formData.append('name', 'Updated Office Hours');
formData.append('description', 'Updated office schedule and policies');
formData.append('metadata', JSON.stringify({
  version: '1.1',
  lastReviewed: new Date().toISOString()
}));
```

**Response (200 - Sync Mode):**

```json
{
  "docId": "loader-1",
  "loaderId": "loader-1",
  "kbId": "kb-entry-uuid",
  "processedAt": "2025-11-21T14:10:00Z",
  "status": "success",
  "storeId": "d21759a2-d263-414e-b5a4-f2e5819d516e"
}
```

**Response (202 - Async Mode):**

```json
{
  "jobId": "job-uuid",
  "status": "queued"
}
```

**Headers:**

- `Authorization: Bearer <jwt>` (required, role must be `staff` or `admin`)

**Error Responses:**
- `400 { "error": "loaderId is required" }` — Missing loader ID
- `400 { "error": "name is required" }` — Name cannot be empty
- `400 { "error": "description is required" }` — Description cannot be empty
- `500 { "error": "Unable to process document" }` — Processing error

---

### POST `/api/kb/:storeId/loaders/:loaderId/process` or `/api/kb/loaders/:loaderId/process`
Reprocess a document (same as PUT, alternative endpoint).

**Authentication:** Required - Bearer token with `staff` or `admin` role

**Request:** Same as PUT endpoint (multipart/form-data with file, name, description, metadata)

**Response (200 - Sync Mode):** Same as PUT endpoint

**Response (202 - Async Mode):** Same as PUT endpoint

**Headers:**

- `Authorization: Bearer <jwt>` (required, role must be `staff` or `admin`)

---

### POST `/api/kb/:storeId/upsert` or `/api/kb/upsert`
Upsert (insert or update) documents via JSON (raw text content, not files).

**Authentication:** Required - Bearer token with `staff` or `admin` role

**Request:**

```json
{
  "docId": "manual-doc-1",
  "text": "Office policy content here. Detailed text content that will be split into chunks...",
  "name": "Office Policies",
  "description": "Company office policies document",
  "filename": "policies.pdf",
  "metadata": {
    "source": "manual",
    "department": "HR",
    "version": "1.0"
  }
}
```

**Response (200 - Sync Mode):**

```json
{
  "docId": "manual-doc-1",
  "status": "upserted",
  "chunksCount": 3,
  "storeId": "d21759a2-d263-414e-b5a4-f2e5819d516e"
}
```

**Response (202 - Async Mode):**

```json
{
  "jobId": "job-uuid",
  "status": "queued"
}
```

**Headers:**

- `Authorization: Bearer <jwt>` (required, role must be `staff` or `admin`)

**Error Responses:**
- `400 { "error": "Request body is required" }` — Empty request body
- `500 { "error": "Unable to upsert document" }` — Processing error

**Notes:**
- If `ASYNC_KB=true`, returns 202 with jobId
- Directly upserts text content without file upload
- Text is automatically split into chunks and embedded
- Query job status with `GET /api/jobs/:jobId`

---

### POST `/api/kb/:storeId/refresh` or `/api/kb/refresh`
Refresh/rebuild the knowledge base vector store (reindex all documents).

**Authentication:** Required - Bearer token with `staff` or `admin` role

**Request:** (empty body or {})

**Response (200 - Sync Mode):**

```json
{
  "status": "refresh_completed",
  "totalDocuments": 5,
  "storeId": "d21759a2-d263-414e-b5a4-f2e5819d516e"
}
```

**Response (202 - Async Mode):**

```json
{
  "jobId": "job-uuid",
  "status": "queued"
}
```

**Headers:**

- `Authorization: Bearer <jwt>` (required, role must be `staff` or `admin`)

**Error Responses:**
- `500 { "error": "Unable to refresh document store" }` — Refresh error

**Notes:**
- If `ASYNC_KB=true`, returns 202 with jobId and queues refresh job
- If `ASYNC_KB=false`, processes synchronously and returns 200
- Rebuilds vector embeddings for all documents in the store
- Query job status with `GET /api/jobs/:jobId`

---

### GET `/api/jobs/:jobId`

Get the status of an async KB operation job.

**Authentication:** Required - Bearer token (JWT) via `Authorization` header

**Response (200):**

```json
{
  "jobId": "job-uuid",
  "status": "processing",
  "type": "kb.ingest",
  "storeId": "d21759a2-d263-414e-b5a4-f2e5819d516e",
  "result": {
    "docId": "loader-123"
  },
  "error": null,
  "createdAt": "2025-11-21T14:00:00Z",
  "updatedAt": "2025-11-21T14:05:00Z"
}
```

**Headers:**

- `Authorization: Bearer <jwt>` (required)

**Job Status Values:**

- `queued` — Job is waiting to be processed
- `processing` — Job is currently being processed
- `succeeded` — Job completed successfully with result
- `failed` — Job failed with error message

**Error Responses:**

- `401 { "error": "Missing Bearer token" }` — No authentication
- `404 { "error": "Job not found" }` — Job ID doesn't exist

**Notes:**

- Used to track async KB operations (ingest, reprocess, upsert, refresh)
- Poll this endpoint to check operation completion
- Successful jobs include result data in response
- Failed jobs include error message

---

### GET `/health`

Health check endpoint.

**Response (200):**

```json
{ "status": "ok" }
```

**Notes:**

- No authentication required
- Returns 200 if service is running

---

### GET `/metrics`

Prometheus metrics endpoint for monitoring.

**Response (200):**

Plain text Prometheus metrics format containing:

- HTTP request metrics (count, duration, status codes)
- Prediction metrics (tokens, cost, duration, GPU utilization)
- Custom application metrics

**Notes:**

- No authentication required
- Format: `# HELP` and `# TYPE` headers followed by metric data
- Used by Prometheus scraper (`http://localhost:9090`)
- Includes latency buckets and quantiles

---

## Frontend Integration Examples

### Login Flow

```javascript
// 1. Login
const loginResponse = await fetch("http://localhost:3001/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    identifier: "user@example.com",
    password: "password",
  }),
});

const { user, message } = await loginResponse.json();
if (!loginResponse.ok) {
  alert(message); // "User not found" or "Invalid credentials"
} else {
  // Store user info or session
  sessionStorage.setItem("user", JSON.stringify(user));
}
```

### Chat with Knowledge Base

```javascript
// 2. Send a question to the chatbot
const chatResponse = await fetch(
  "http://localhost:4000/api/v1/prediction/2d844a72-3dc8-4475-8134-9f034015741f",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: "What are office hours?",
      sessionId: currentSessionId || undefined, // Reuse for multi-round
    }),
  }
);

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
const file = fileInput.files[0];
formData.append('file', file);
formData.append('name', 'IT Guidelines');
formData.append('description', 'IT department policies and guidelines for employees');
formData.append('metadata', JSON.stringify({
  department: 'IT',
  category: 'guides',
  version: '2.1'
}));

const uploadResponse = await fetch('http://localhost:4000/api/kb/loaders', {
  method: 'POST',
  body: formData
});

if (!uploadResponse.ok) {
  const error = await uploadResponse.json();
  console.error('Upload failed:', error.error);
} else {
  const { docId, loaderId, filename } = await uploadResponse.json();
  console.log(`Uploaded: ${filename} (${loaderId})`);
}
```

### Update Document in KB
```javascript
const formData = new FormData();
formData.append('name', 'Updated IT Guidelines');
formData.append('description', 'Updated policies and procedures');
formData.append('metadata', JSON.stringify({
  version: '2.2',
  lastUpdated: new Date().toISOString()
}));

const updateResponse = await fetch('http://localhost:4000/api/kb/loaders/loader-1', {
  method: 'PUT',
  body: formData
});

const result = await updateResponse.json();
console.log(`Updated: ${result.loaderId}`);
```

### Get Document Details
```javascript
const loaderResponse = await fetch('http://localhost:4000/api/kb/loaders/loader-1');
const document = await loaderResponse.json();

console.log(`Name: ${document.name}`);
console.log(`Description: ${document.description}`);
console.log(`Uploaded: ${document.uploadedAt}`);
console.log(`Size: ${document.size} bytes`);
```

### Get and Update Chunk Content
```javascript
// Get chunks from document
const chunksResponse = await fetch('http://localhost:4000/api/kb/loaders/loader-1/chunks?page=1');
const { chunks } = await chunksResponse.json();

// Update a specific chunk
const chunkUpdate = await fetch('http://localhost:4000/api/kb/loaders/loader-1/chunks/chunk-1', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: 'Corrected or updated chunk text...',
    metadata: {
      reviewed: true,
      reviewer: 'admin@company.com'
    }
  })
});

const updateResult = await chunkUpdate.json();
console.log('Chunk updated at:', updateResult.updatedAt);
```

### Stream Chat Response

```javascript
const response = await fetch(
  "http://localhost:4000/api/v1/prediction/2d844a72-3dc8-4475-8134-9f034015741f/stream",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: "Explain our policies",
      sessionId: currentSessionId,
      stream: true,
    }),
  }
);

const reader = response.body.getReader();
const decoder = new TextDecoder();
let fullText = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split("\n");

  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const json = JSON.parse(line.slice(6));
      fullText += json.token || json.text || "";
      updateChatDisplay(fullText); // Live update UI
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

### CORS

- **Allowed Origins:** `http://localhost:3000`, `http://127.0.0.1:3000`
- **Allowed Methods:** GET, POST, PUT, DELETE, OPTIONS
- **Allowed Headers:** Content-Type, Authorization, and others

### Authentication (Flowise Proxy)

- **Type:** JWT (JSON Web Token) Bearer authentication
- **Location:** `Authorization: Bearer <jwt>` header (required for most endpoints)
- **Secret:** Uses `AUTH_JWT_SECRET` or `JWT_SECRET` environment variable
- **Token Format:** JWT with `role` claim (e.g., `student`, `staff`, `admin`, `guest`)

### Role-Based Access Control

**Chat Endpoints** (prediction, chat history):
- Required: Valid JWT token (any role)
- Returns: Authenticated user's chat data

**Knowledge Base Endpoints** (documents, chunks, uploads):
- Required: JWT token with `staff` or `admin` role
- Returns: 403 Forbidden if user role is insufficient

### Sessions

- **Chat Sessions:** Use `sessionId` UUID for multi-round conversations
- **Persistence:** Sessions stored in MongoDB
- **Auto-generation:** `sessionId` generated if not provided in request

---

## Environment Variables

### Frontend (.env.local)

```bash
NEXT_PUBLIC_AUTH_API_URL=http://localhost:3001
NEXT_PUBLIC_FLOWISE_PROXY_URL=http://localhost:4000
NEXT_PUBLIC_BROKER_URL=http://localhost:3002
NEXT_PUBLIC_MAIL_URL=http://localhost:3004
```

### Flowise Proxy Service (.env)

```bash
# Authentication
AUTH_JWT_SECRET=your-jwt-secret-key
JWT_SECRET=your-jwt-secret-key

# Flowise Configuration
FLOWISE_URL=http://flowise:3000
FLOWISE_API_KEY=optional-api-key
FLOWISE_LOADER_NAME=fileLoader
FLOWISE_SPLITTER_NAME=recursiveCharacterTextSplitter
FLOWISE_VECTOR_STORE_NAME=pineconeUpsert
FLOWISE_EMBEDDING_NAME=openaiEmbedding

# Knowledge Base
DOCUMENT_STORE_ID=d21759a2-d263-414e-b5a4-f2e5819d516e
UPLOAD_DIR=/uploads
ASYNC_KB=true  # Enable async KB processing

# Database
MONGO_URI=mongodb://mongo:27017/helpdesk
MONGO_DB_NAME=helpdesk

# Server
PORT=4000
READ_TIMEOUT_MS=60000
MAX_CONCURRENT_PREDICTIONS=4

# Metrics
COST_PER_1K_TOKENS_USD=0.002
```

---

## Async Knowledge Base Processing

When `ASYNC_KB=true`, knowledge base operations (upload, reprocess, upsert, refresh) are queued for async processing via RabbitMQ instead of blocking the HTTP request.

### Workflow

1. **Client Request** → POST `/api/kb/loaders` (upload file)
2. **Proxy Response** → Returns 202 with `jobId`
3. **Job Queued** → Event sent to RabbitMQ `kb.ingest` queue
4. **Broker Listener** → Picks up job from queue
5. **Internal Processing** → Calls `POST /internal/jobs/kb/ingest` on proxy
6. **Completion** → Job status updated to `succeeded` or `failed`
7. **Client Polling** → Calls `GET /api/jobs/:jobId` to track progress

### Job Types

- `kb.ingest` — File upload and vector embedding
- `kb.reprocess` — Re-split and re-embed existing document
- `kb.upsert` — Insert/update via JSON (raw text)
- `kb.refresh` — Rebuild entire vector store

### Internal Endpoints (Worker Only)

These endpoints are for internal job processing via RabbitMQ and require `WORKER_TOKEN` authentication.

**POST `/internal/jobs/kb/ingest`**
**POST `/internal/jobs/kb/reprocess`**
**POST `/internal/jobs/kb/upsert`**
**POST `/internal/jobs/kb/refresh`**
**POST `/internal/jobs/status`**

**Headers:**
- `Authorization: Bearer <WORKER_TOKEN>`

---

- **Main Helpdesk Flow:** `2d844a72-3dc8-4475-8134-9f034015741f`

(Add more as you create flows in Flowise UI)

---

## Key Implementation Differences

### Chat Prediction Responses

**Field Changes:**
- `message` → `text` (response text field renamed)
- Added `sessionId` to all responses (auto-generated if not provided)
- `sourceDocuments` still present for source attribution

### Metrics Collection

All prediction requests automatically collect:

- **Duration**: Request processing time in seconds
- **CPU Usage**: CPU time consumed during request
- **Token Estimate**: Approximate tokens in response
- **Cost Estimation**: Estimated USD cost based on token count
- **GPU Utilization**: Sampled GPU usage if available

Metrics are exposed via `GET /metrics` endpoint in Prometheus format.

### Concurrency Control

- Maximum concurrent predictions: `MAX_CONCURRENT_PREDICTIONS` (default: 4)
- Excess requests receive: `429 { "error": "Too many concurrent predictions, please retry shortly" }`
- Helps prevent resource exhaustion under high load

### File Upload Changes

- Files stored on disk in `UPLOAD_DIR` with timestamp+name
- Metadata automatically enriched with: `originalFileName`, `name`, `description`
- Unsupported file types rejected with error
- Multipart form-data validation includes MIME type checking

### Authentication Throughout

- **Chat endpoints** require valid JWT (any role)
- **KB endpoints** require JWT with `staff` or `admin` role
- **Health/Metrics endpoints** require no authentication
- **Internal endpoints** require `WORKER_TOKEN` authentication

---

## Troubleshooting

### 401 Unauthorized
- Verify `Authorization: Bearer <token>` header is present
- Check JWT is valid and not expired
- Verify `AUTH_JWT_SECRET` or `JWT_SECRET` env var is set

### 403 Forbidden
- KB endpoints require `staff` or `admin` role in JWT
- Check user role claim in token payload

### 429 Too Many Requests
- Concurrent prediction limit reached
- Wait a moment and retry
- Increase `MAX_CONCURRENT_PREDICTIONS` if needed

### 502 Bad Gateway (chunks endpoint)
- Flowise returned HTML instead of JSON
- Check Flowise service is running and healthy
- Verify document/loader IDs are valid

### Async Jobs Stuck in "queued"
- Verify `ASYNC_KB=true` and RabbitMQ connection
- Check broker-service is running and connected
- Verify listener-service is consuming KB queue events

---

## Testing Endpoints (Quick Reference)

Use Postman, cURL, or VS Code REST Client:

```
### Health Check
GET http://localhost:4000/health

### Get Metrics
GET http://localhost:4000/metrics

### Chat with Knowledge Base (requires valid JWT token)
POST http://localhost:4000/api/v1/prediction/2d844a72-3dc8-4475-8134-9f034015741f
Authorization: Bearer your-jwt-token
Content-Type: application/json

{
  "question": "What are office hours?"
}

### Stream Chat Response
POST http://localhost:4000/api/v1/prediction/2d844a72-3dc8-4475-8134-9f034015741f/stream
Authorization: Bearer your-jwt-token
Content-Type: application/json

{
  "question": "Explain our policies",
  "stream": true
}

### List Knowledge Base Documents (requires staff/admin role)
GET http://localhost:4000/api/kb
Authorization: Bearer your-staff-jwt-token

### Upload Document (requires staff/admin role)
POST http://localhost:4000/api/kb/loaders
Authorization: Bearer your-staff-jwt-token
Content-Type: multipart/form-data

(Form fields: file, name, description, metadata)

### Check Job Status
GET http://localhost:4000/api/jobs/job-uuid
Authorization: Bearer your-jwt-token
```
