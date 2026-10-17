import assert from "node:assert/strict";
const target = process.argv[2] || "http://localhost:8888";
const gas = target === "--gas";
let cookie = "";
async function call(action, params = {}) {
  let response;
  if (gas) {
    const url = new URL(process.env.GAS_WEB_APP_URL);
    url.search = new URLSearchParams({
      action,
      key: process.env.GAS_SHARED_SECRET,
      ...params,
    }).toString();
    response = await fetch(url, {
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
  neisNumber: "0000000001",
  name: "틀린이름",
});
assert.equal(failed.ok, false);
for (const [suffix, count] of [
  ["1", 3],
  ["2", 0],
]) {
  const login = await call("login", {
    neisNumber: "000000000" + suffix,
    name: "테스트교원0" + suffix,
  });
  assert.equal(login.ok, true, JSON.stringify(login.error));
  const token = login.data.token;
  const me = await call("me", gas ? { token } : {});
  assert.equal(me.ok, true, JSON.stringify(me.error));
  assert.equal(
    me.data.collections.filter((r) => r.status === "획득").length,
    count,
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
  `${gas ? "GAS" : "Web API"} live verification passed: 7 badges, invalid login, 2 isolated accounts, logout rejection.`,
);
