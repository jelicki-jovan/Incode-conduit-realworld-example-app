// Performance regression test for the Conduit API (k6).
//
// Runs in CI against the dev environment after each deploy, before the image is promoted to prod:
// a short, low, constant load of the most common requests. It answers "is the new version slower than
// the previous one?", not "how much traffic can prod handle?" (dev is deliberately small).
// Failing a threshold fails the pipeline, so the version isn't promoted.
//
//   k6 run -e BASE_URL=http://<dev ALB> -e PERF_USER_PASSWORD=<secret> perf/api.js

import http from "k6/http";
import { check, fail, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL;
const PASSWORD = __ENV.PERF_USER_PASSWORD;
// Dedicated test user; its seeded articles stay in the dev database between runs
const USER = { username: "k6-perf", email: "k6-perf@example.com" };
// Enough rows for slow queries (missing index, N+1) to show; created once, constant between runs
const SEED_ARTICLES = 100;

export const options = {
  // Low and constant on purpose: we measure the code, not the limits of the small dev environment
  vus: 5,
  duration: "1m",
  // p95 only: p99 is decided by a handful of requests in a 1-minute run, too noisy for a gate.
  thresholds: {
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
    "http_req_duration{name:articles}": ["p(95)<500"],
    "http_req_duration{name:articles-auth}": ["p(95)<500"],
    "http_req_duration{name:article}": ["p(95)<200"],
    "http_req_duration{name:tags}": ["p(95)<200"],
    "http_req_duration{name:login}": ["p(95)<300"],
  },
  summaryTrendStats: ["med", "p(95)", "p(99)", "max"],
};

const json = { "Content-Type": "application/json" };
const auth = (token) => ({ ...json, Authorization: `Token ${token}` });

function login() {
  const res = http.post(
    `${BASE_URL}/api/users/login`,
    JSON.stringify({ user: { email: USER.email, password: PASSWORD } }),
    { headers: json, tags: { name: "login" } },
  );
  check(res, { "login 200": (r) => r.status === 200 });
  return res.status === 200 ? res.json("user.token") : null;
}

// Once per run, before the load: make sure the test user and its articles exist (idempotent)
export function setup() {
  if (!BASE_URL || !PASSWORD) fail("BASE_URL and PERF_USER_PASSWORD are required");

  let token = login();
  if (!token) {
    const res = http.post(
      `${BASE_URL}/api/users`,
      JSON.stringify({ user: { ...USER, password: PASSWORD } }),
      { headers: json },
    );
    if (res.status !== 201) fail(`cannot create the test user: ${res.status} ${res.body}`);
    token = res.json("user.token");
  }

  const list = (limit) =>
    http.get(`${BASE_URL}/api/articles?author=${USER.username}&limit=${limit}`, { headers: auth(token) });
  let res = list(SEED_ARTICLES);
  for (let i = res.json("articlesCount"); i < SEED_ARTICLES; i++) {
    http.post(
      `${BASE_URL}/api/articles`,
      JSON.stringify({
        article: {
          title: `k6 perf article ${i + 1}`,
          description: "Seed data for the performance test",
          body: "Lorem ipsum dolor sit amet. ".repeat(40),
          tagList: ["k6", `tag-${i % 5}`],
        },
      }),
      { headers: auth(token) },
    );
  }
  res = list(SEED_ARTICLES);
  const slugs = res.json("articles").map((a) => a.slug);
  if (slugs.length === 0) fail("no seed articles found");
  return { token, slugs };
}

function get(path, name, token) {
  const res = http.get(`${BASE_URL}${path}`, {
    headers: token ? auth(token) : {},
    tags: { name }, // group by request type, not by URL (slugs would give one metric per article)
  });
  check(res, { [`${name} 200`]: (r) => r.status === 200 });
}

// One virtual user's loop: mostly reads, like the real usage of a blog
export default function (data) {
  get("/api/articles?limit=10", "articles");
  get("/api/tags", "tags");
  get(`/api/articles/${data.slugs[Math.floor(Math.random() * data.slugs.length)]}`, "article");
  get("/api/articles?limit=10", "articles-auth", data.token);
  if (Math.random() < 0.1) login(); // password hashing is CPU-heavy: only ~1 in 10 iterations
  sleep(1); // "think time" between page views
}
