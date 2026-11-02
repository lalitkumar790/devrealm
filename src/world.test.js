import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, hitTest } from "./world.js";

const repos = [
  { id: 1, name: "alpha", language: "JavaScript", stargazers_count: 12 },
  { id: 2, name: "beta", language: "Python", stargazers_count: 3 },
  { id: 3, name: "gamma", language: null, stargazers_count: 0 }
];

test("world generation is deterministic for the same developer", () => {
  const first = createWorld(repos, "dev-one");
  const second = createWorld(repos, "dev-one");
  assert.deepEqual(first.points.map(p => [p.x, p.y, p.color]), second.points.map(p => [p.x, p.y, p.color]));
});

test("different developers receive different procedural layouts", () => {
  const first = createWorld(repos, "dev-one");
  const second = createWorld(repos, "dev-two");
  assert.notDeepEqual(first.points.map(p => [p.x, p.y]), second.points.map(p => [p.x, p.y]));
});

test("every repository maps to exactly one world point", () => {
  const world = createWorld(repos, "dev-one");
  assert.equal(world.points.length, repos.length);
  assert.deepEqual(world.points.map(p => p.repo.id).sort(), [1, 2, 3]);
  assert.ok(world.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.size > 0));
});

test("hit testing selects a repository near its generated marker", () => {
  const world = createWorld(repos, "dev-one");
  const point = world.points[0];
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) };
  const selected = hitTest(canvas, world, { x: 0, y: 0, zoom: 1 }, 50 + point.x, 50 + point.y);
  assert.equal(selected.id, point.repo.id);
});

test("hit testing returns null when no marker is nearby", () => {
  const world = createWorld(repos, "dev-one");
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) };
  assert.equal(hitTest(canvas, world, { x: 0, y: 0, zoom: 1 }, 0, 0), null);
});

test("repository constellation links reflect shared language or topics", () => {
  const related = [
    { id: 10, name: "web-a", language: "TypeScript", topics: ["dashboard"] },
    { id: 11, name: "web-b", language: "TypeScript", topics: ["dashboard"] },
    { id: 12, name: "robotics", language: "Python", topics: ["robotics"] }
  ];
  const world = createWorld(related, "constellation-test");
  assert.ok(Array.isArray(world.links));
  assert.ok(world.links.some(link => link.kind === "language" || link.kind === "topic"));
  assert.ok(world.links.every(link => link.from >= 0 && link.to < world.points.length));
});
