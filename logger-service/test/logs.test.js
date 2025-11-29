import fs from "fs";
import os from "os";
import path from "path";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = "testsecret";
process.env.AUTH_JWT_SECRET = "testsecret";

const today = new Date().toISOString().slice(0, 10);

let tempDir;
let app;

before(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "logger-test-"));
  process.env.LOG_DIR = tempDir;
  process.env.LOG_FILE_PREFIX = "testlog";

  const sample = {
    level: "info",
    time: new Date().toISOString(),
    service: "sample-service",
    event: "sample_event",
    message: "hello world",
    context: { foo: "bar" }
  };
  const filePath = path.join(tempDir, `testlog-${today}.log`);
  fs.writeFileSync(filePath, `${JSON.stringify(sample)}\n`, "utf8");

  // eslint-disable-next-line global-require
  ({ app } = await import("../src/app.js"));
});

after(() => {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("GET /logs rejects missing token", async () => {
  const res = await request(app).get("/logs");
  assert.equal(res.status, 401);
});

test("GET /logs rejects insufficient role", async () => {
  const token = jwt.sign({ role: "student" }, process.env.JWT_SECRET);
  const res = await request(app).get("/logs").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 403);
});

test("GET /logs returns filtered logs for admin", async () => {
  const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET);
  const res = await request(app)
    .get("/logs")
    .query({ limit: 10 })
    .set("Authorization", `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.logs));
  assert.ok(res.body.count >= 1);
  assert.ok(res.body.logs.some((entry) => entry.event === "sample_event"));
});
