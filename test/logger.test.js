import assert from "node:assert/strict"
import test, { afterEach, mock } from "node:test"

import { debug, getLogTimestamp, log, logError, warn } from "../src/logger.js"

afterEach(() => {
  mock.restoreAll()
  delete process.env.LOG_LEVEL
})

test("formats log timestamps in the Kyiv time zone", () => {
  assert.equal(
    getLogTimestamp(new Date("2026-10-08T09:05:07Z")),
    "2026-10-08 12:05:07 Europe/Kyiv",
  )
})

test("prefixes informational, warning, and error logs with timestamps", () => {
  const calls = []
  mock.method(console, "log", (...values) => calls.push(["log", ...values]))
  mock.method(console, "warn", (...values) => calls.push(["warn", ...values]))
  mock.method(console, "error", (...values) => calls.push(["error", ...values]))

  log("info")
  warn("warning")
  logError("failure")

  assert.deepEqual(
    calls.map(([method, timestamp, message]) => [
      method,
      /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} Europe\/Kyiv\]$/.test(
        timestamp,
      ),
      message,
    ]),
    [
      ["log", true, "info"],
      ["warn", true, "warning"],
      ["error", true, "failure"],
    ],
  )
})

test("prints debug logs only when LOG_LEVEL is debug", () => {
  const calls = []
  mock.method(console, "log", (...values) => calls.push(values))

  debug("hidden")
  process.env.LOG_LEVEL = "info"
  debug("still hidden")
  assert.equal(calls.length, 0)

  process.env.LOG_LEVEL = "DEBUG"
  debug("shown")
  assert.equal(calls.length, 1)
  assert.equal(calls[0].at(-1), "shown")
})
