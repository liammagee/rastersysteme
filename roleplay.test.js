const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");

// We test the room sync endpoints by starting serve-lan.js on a test port
// and making HTTP requests against it.

const TEST_PORT = 9876;
let server;

function request(method, path, body) {
  return new Promise(function(resolve, reject) {
    const options = {
      hostname: "localhost",
      port: TEST_PORT,
      path: path,
      method: method,
      headers: body ? { "Content-Type": "application/json" } : {},
    };
    const req = http.request(options, function(res) {
      let data = "";
      res.on("data", function(chunk) { data += chunk; });
      res.on("end", function() {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Start serve-lan on test port
before(async () => {
  // Require serve-lan internals by spawning as a child process
  const { spawn } = require("child_process");
  server = spawn("node", ["serve-lan.js", String(TEST_PORT)], {
    cwd: __dirname,
    stdio: "pipe",
  });
  // Wait for server to start
  await new Promise(function(resolve) {
    server.stdout.on("data", function(data) {
      if (data.toString().includes("Serving on LAN")) resolve();
    });
    // Fallback timeout
    setTimeout(resolve, 2000);
  });
});

after(() => {
  if (server) server.kill();
});


// ═══════════════════════════════════════════════════════
// ROOM SYNC ENDPOINTS
// ═══════════════════════════════════════════════════════

describe("roleplay room sync", () => {

  it("GET /api/workshop/roleplay/poll creates room on first poll", async () => {
    const res = await request("GET", "/api/workshop/roleplay/poll?roomId=test-auto-create&after=0");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.messages, []);
    assert.equal(res.body.lastId, 0);
  });

  it("GET /api/workshop/roleplay/poll returns 400 without roomId", async () => {
    const res = await request("GET", "/api/workshop/roleplay/poll?after=0");
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  it("POST /api/workshop/roleplay/message stores messages", async () => {
    const res = await request("POST", "/api/workshop/roleplay/message", {
      roomId: "test-msg",
      scenarioId: "eliza-hearing",
      messages: [
        { sender: "user", name: "Margaret", text: "She understood me!", color: "#A788D4" },
      ],
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.lastId, 1);
  });

  it("POST /api/workshop/roleplay/message returns 400 without roomId", async () => {
    const res = await request("POST", "/api/workshop/roleplay/message", {
      messages: [{ sender: "user", name: "Test", text: "Hello", color: "#fff" }],
    });
    assert.equal(res.status, 400);
  });

  it("POST /api/workshop/roleplay/message returns 400 without messages", async () => {
    const res = await request("POST", "/api/workshop/roleplay/message", {
      roomId: "test-bad",
    });
    assert.equal(res.status, 400);
  });

  it("poll returns messages posted to the room", async () => {
    // Post two messages
    await request("POST", "/api/workshop/roleplay/message", {
      roomId: "test-poll",
      scenarioId: "socrates-sv",
      messages: [
        { sender: "user", name: "Alex (CEO)", text: "We ship in 5 days.", color: "#E88A9A" },
        { sender: "claude", name: "Socrates", text: "What does it mean to ship?", color: "#D4A855" },
      ],
    });

    const res = await request("GET", "/api/workshop/roleplay/poll?roomId=test-poll&after=0");
    assert.equal(res.status, 200);
    assert.equal(res.body.messages.length, 2);
    assert.equal(res.body.messages[0].name, "Alex (CEO)");
    assert.equal(res.body.messages[1].name, "Socrates");
    assert.equal(res.body.lastId, 2);
  });

  it("poll with after=N returns only new messages", async () => {
    // Post another message to the same room
    await request("POST", "/api/workshop/roleplay/message", {
      roomId: "test-poll",
      messages: [
        { sender: "user", name: "Dr. Patel (Ethicist)", text: "He has a point.", color: "#5BB8A6" },
      ],
    });

    const res = await request("GET", "/api/workshop/roleplay/poll?roomId=test-poll&after=2");
    assert.equal(res.status, 200);
    assert.equal(res.body.messages.length, 1);
    assert.equal(res.body.messages[0].name, "Dr. Patel (Ethicist)");
    assert.equal(res.body.messages[0].id, 3);
    assert.equal(res.body.lastId, 3);
  });

  it("messages get auto-incrementing IDs", async () => {
    await request("POST", "/api/workshop/roleplay/message", {
      roomId: "test-ids",
      messages: [
        { sender: "user", name: "A", text: "first", color: "#fff" },
      ],
    });
    await request("POST", "/api/workshop/roleplay/message", {
      roomId: "test-ids",
      messages: [
        { sender: "user", name: "B", text: "second", color: "#fff" },
        { sender: "claude", name: "C", text: "third", color: "#fff" },
      ],
    });

    const res = await request("GET", "/api/workshop/roleplay/poll?roomId=test-ids&after=0");
    assert.equal(res.body.messages[0].id, 1);
    assert.equal(res.body.messages[1].id, 2);
    assert.equal(res.body.messages[2].id, 3);
  });

  it("streaming flag is stripped from stored messages", async () => {
    await request("POST", "/api/workshop/roleplay/message", {
      roomId: "test-streaming",
      messages: [
        { sender: "claude", name: "ELIZA", text: "Hello", color: "#E88A9A", streaming: true },
      ],
    });

    const res = await request("GET", "/api/workshop/roleplay/poll?roomId=test-streaming&after=0");
    assert.equal(res.body.messages[0].streaming, false);
  });

  it("scenarioId is set on room from POST if room was auto-created empty", async () => {
    // Auto-create with poll (no scenarioId)
    await request("GET", "/api/workshop/roleplay/poll?roomId=test-scenario-update&after=0");
    // Post with scenarioId
    await request("POST", "/api/workshop/roleplay/message", {
      roomId: "test-scenario-update",
      scenarioId: "grief-counsellor",
      messages: [{ sender: "user", name: "Alex", text: "Hi", color: "#fff" }],
    });

    const rooms = await request("GET", "/api/workshop/roleplay/rooms");
    const match = rooms.body.rooms.filter(function(r) { return r.roomId === "test-scenario-update"; })[0];
    assert.equal(match.scenarioId, "grief-counsellor");
  });

  it("GET /api/workshop/roleplay/rooms lists all rooms", async () => {
    const res = await request("GET", "/api/workshop/roleplay/rooms");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.rooms));
    assert.ok(res.body.rooms.length >= 1);
    // Each room should have required fields
    const room = res.body.rooms[0];
    assert.ok("roomId" in room);
    assert.ok("scenarioId" in room);
    assert.ok("messageCount" in room);
    assert.ok("lastId" in room);
  });

  it("CORS headers are present on responses", async () => {
    const res = await request("GET", "/api/workshop/roleplay/rooms");
    assert.equal(res.headers["access-control-allow-origin"], "*");
  });

  it("OPTIONS preflight returns 204 with CORS headers", async () => {
    const res = await request("OPTIONS", "/api/workshop/roleplay/message");
    assert.equal(res.status, 204);
  });

  it("separate rooms are independent", async () => {
    await request("POST", "/api/workshop/roleplay/message", {
      roomId: "room-a",
      messages: [{ sender: "user", name: "A", text: "in room A", color: "#fff" }],
    });
    await request("POST", "/api/workshop/roleplay/message", {
      roomId: "room-b",
      messages: [{ sender: "user", name: "B", text: "in room B", color: "#fff" }],
    });

    const a = await request("GET", "/api/workshop/roleplay/poll?roomId=room-a&after=0");
    const b = await request("GET", "/api/workshop/roleplay/poll?roomId=room-b&after=0");
    assert.equal(a.body.messages.length, 1);
    assert.equal(a.body.messages[0].text, "in room A");
    assert.equal(b.body.messages.length, 1);
    assert.equal(b.body.messages[0].text, "in room B");
  });
});


// ═══════════════════════════════════════════════════════
// SCENARIO REGISTRY (parsed from the HTML)
// ═══════════════════════════════════════════════════════

describe("scenario registry", () => {
  const fs = require("fs");
  const path = require("path");

  let scenarios;

  before(() => {
    const html = fs.readFileSync(path.join(__dirname, "pages/talking-to-machines.html"), "utf8");
    const match = html.match(/var ROLEPLAY_SCENARIOS = (\[[\s\S]*?\]);/);
    assert.ok(match, "ROLEPLAY_SCENARIOS not found in HTML");
    scenarios = eval("(" + match[1] + ")");
  });

  it("has exactly 9 scenarios (one per breakout room)", () => {
    assert.equal(scenarios.length, 9);
  });

  it("each scenario has required fields", () => {
    for (const sc of scenarios) {
      assert.ok(sc.id, "missing id");
      assert.ok(sc.title, "missing title: " + sc.id);
      assert.ok(sc.year, "missing year: " + sc.id);
      assert.ok(sc.description, "missing description: " + sc.id);
      assert.ok(sc.setting, "missing setting: " + sc.id);
      assert.ok(sc.claudeRole, "missing claudeRole: " + sc.id);
      assert.ok(sc.claudeRole.name, "missing claudeRole.name: " + sc.id);
      assert.ok(sc.claudeRole.description, "missing claudeRole.description: " + sc.id);
      assert.ok(sc.claudeRole.color, "missing claudeRole.color: " + sc.id);
      assert.ok(sc.humanRoles, "missing humanRoles: " + sc.id);
      assert.ok(sc.openingLine, "missing openingLine: " + sc.id);
    }
  });

  it("each scenario has 3-5 human roles", () => {
    for (const sc of scenarios) {
      assert.ok(sc.humanRoles.length >= 3, sc.id + " has < 3 roles: " + sc.humanRoles.length);
      assert.ok(sc.humanRoles.length <= 5, sc.id + " has > 5 roles: " + sc.humanRoles.length);
    }
  });

  it("all scenario IDs are unique", () => {
    const ids = scenarios.map(function(s) { return s.id; });
    assert.equal(new Set(ids).size, ids.length);
  });

  it("all human role IDs within a scenario are unique", () => {
    for (const sc of scenarios) {
      const ids = sc.humanRoles.map(function(r) { return r.id; });
      assert.equal(new Set(ids).size, ids.length, sc.id + " has duplicate role IDs");
    }
  });

  it("each human role has required fields", () => {
    for (const sc of scenarios) {
      for (const role of sc.humanRoles) {
        assert.ok(role.id, "missing role.id in " + sc.id);
        assert.ok(role.name, "missing role.name in " + sc.id);
        assert.ok(role.description, "missing role.description in " + sc.id);
        assert.ok(role.color, "missing role.color in " + sc.id);
      }
    }
  });

  it("each scenario has a dramatic objective", () => {
    for (const sc of scenarios) {
      assert.ok(sc.objective, "missing objective: " + sc.id);
      assert.ok(sc.objective.length > 50, "objective too short for: " + sc.id);
    }
  });

  it("each scenario has an artifact definition", () => {
    for (const sc of scenarios) {
      assert.ok(sc.artifact, "missing artifact: " + sc.id);
      assert.ok(sc.artifact.label, "missing artifact.label: " + sc.id);
      assert.ok(sc.artifact.kind, "missing artifact.kind: " + sc.id);
      assert.ok(sc.artifact.description, "missing artifact.description: " + sc.id);
      assert.ok(sc.artifact.promptTemplate, "missing artifact.promptTemplate: " + sc.id);
      assert.ok(sc.artifact.promptTemplate.length > 100, "promptTemplate too short for: " + sc.id);
    }
  });

  it("at least one scenario leans into Wittgensteinian language games", () => {
    const wittgensteinKeywords = /wittgenstein|language game|private language|beetle|form of life/i;
    const matches = scenarios.filter(function(sc) {
      return wittgensteinKeywords.test(sc.objective) ||
             wittgensteinKeywords.test(sc.claudeRole.description) ||
             (sc.artifact && wittgensteinKeywords.test(sc.artifact.promptTemplate));
    });
    assert.ok(matches.length >= 1, "no scenario explicitly leans into Wittgensteinian language games");
  });

  it("at least one scenario leans into Foucauldian parrhesia", () => {
    const parrhesiaKeywords = /parrhesia|parrhesiastic|foucault|truth-teller|inconvenient truth/i;
    const matches = scenarios.filter(function(sc) {
      return parrhesiaKeywords.test(sc.objective) ||
             parrhesiaKeywords.test(sc.claudeRole.description) ||
             (sc.artifact && parrhesiaKeywords.test(sc.artifact.promptTemplate));
    });
    assert.ok(matches.length >= 1, "no scenario explicitly leans into Foucauldian parrhesia");
  });

  it("no smart quotes in any scenario text", () => {
    const smartQuotes = /[\u201C\u201D\u2018\u2019]/;
    for (const sc of scenarios) {
      assert.ok(!smartQuotes.test(sc.description), "smart quote in description: " + sc.id);
      assert.ok(!smartQuotes.test(sc.setting), "smart quote in setting: " + sc.id);
      assert.ok(!smartQuotes.test(sc.openingLine), "smart quote in openingLine: " + sc.id);
      assert.ok(!smartQuotes.test(sc.claudeRole.description), "smart quote in claudeRole: " + sc.id);
      for (const role of sc.humanRoles) {
        assert.ok(!smartQuotes.test(role.description), "smart quote in role " + role.id + " of " + sc.id);
      }
    }
  });

  it("each scenario includes a reporter-like character", () => {
    // At least one human role per scenario should have a reporter/observer/journalist function
    const reporterKeywords = /reporter|journalist|filmmaker|observer|critic|documenting|report back|article/i;
    for (const sc of scenarios) {
      const hasReporter = sc.humanRoles.some(function(r) {
        return reporterKeywords.test(r.name) || reporterKeywords.test(r.description);
      });
      assert.ok(hasReporter, sc.id + " has no reporter-like character");
    }
  });
});
