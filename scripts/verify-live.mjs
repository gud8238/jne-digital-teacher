import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const accounts = process.env.VERIFY_ACCOUNTS_FILE
  ? JSON.parse(readFileSync(process.env.VERIFY_ACCOUNTS_FILE, "utf8"))
  : [
      { neisNumber: "0000000001", name: "테스트교원01", earnedCount: 3 },
      { neisNumber: "0000000002", name: "테스트교원02", earnedCount: 0 },
    ];
assert.ok(Array.isArray(accounts) && accounts.length >= 2);
const target = process.argv[2] || "http://localhost:8888";
const gas = target === "--gas";
let cookie = "";
async function call(action, params = {}) {
  let response;
  if (gas) {
    const url = new URL(process.env.GAS_WEB_APP_URL);
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        key: process.env.GAS_SHARED_SECRET,
        ...params,
      }),
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
    });
  } else {
    const post = action === "login" || action === "logout";
    response = await fetch(new URL("/api/" + action, target), {
      method: post ? "POST" : "GET",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      ...(action === "login" ? { body: JSON.stringify(params) } : {}),
      signal: AbortSignal.timeout(30000),
    });
    const set = response.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
  }
  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(
      `Non-JSON response for ${action} (HTTP ${response.status})`,
    );
  }
  return result;
}
const badges = await call("badges");
assert.equal(badges.ok, true, JSON.stringify(badges.error));
assert.equal(badges.data.length, 7);
const failed = await call("login", {
  neisNumber: accounts[0].neisNumber,
  name: "틀린이름",
});
assert.equal(failed.ok, false);
for (const account of accounts) {
  const login = await call("login", {
    neisNumber: account.neisNumber,
    name: account.name,
  });
  assert.equal(login.ok, true, JSON.stringify(login.error));
  const token = login.data.token;
  const me = await call("me", gas ? { token } : {});
  assert.equal(me.ok, true, JSON.stringify(me.error));
  assert.equal(
    me.data.collections.filter((r) => r.status === "획득").length,
    account.earnedCount,
  );
  assert.equal("neisNumber" in me.data.teacher, false);
  assert.equal(Number.isSafeInteger(me.data.sessionExpiresAt), true);
  assert.ok(me.data.sessionExpiresAt > Date.now());
  assert.ok(me.data.sessionExpiresAt <= Date.now() + 14400000);
  assert.equal((await call("logout", gas ? { token } : {})).ok, true);
  assert.equal((await call("me", gas ? { token } : {})).ok, false);
}
if (!gas) {
  cookie = "";
  assert.equal((await call("logout")).ok, true);
}
console.log(
  `${gas ? "GAS" : "Web API"} live verification passed: 7 badges, invalid login, ${accounts.length} isolated accounts, logout rejection.`,
);
