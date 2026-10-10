import assert from "node:assert/strict"
import test, { afterEach, beforeEach, mock } from "node:test"

import {
  deleteLastNotification,
  fetchEmergencyOutagesNotice,
  generateEmergencyOutagesMessage,
  getEmergencyOutagesNotice,
  run,
  sendNotification,
} from "../src/monitor.js"

beforeEach(() => {
  mock.method(console, "log", () => {})
})

afterEach(() => {
  mock.restoreAll()
})

test("escapes a general emergency outages notice", () => {
  const message = generateEmergencyOutagesMessage(
    "Warning <all> & everyone",
    new Date("2026-10-08T09:05:00Z"),
  )

  assert.match(message, /^Warning &lt;all&gt; &amp; everyone/)
  assert.match(message, /12:05 08\.10\.2026/)
})

test("converts strong emphasis in an emergency notice to Telegram bold", () => {
  const message = generateEmergencyOutagesMessage(
    "Right bank: <strong>emergency & unsafe</strong>; <em>left bank</em>",
    new Date("2026-10-08T09:05:00Z"),
  )

  assert.match(
    message,
    /^Right bank: <b>emergency &amp; unsafe<\/b>; &lt;em&gt;left bank&lt;\/em&gt;/,
  )
})

test("extracts all paragraphs from a general emergency outages notice", async () => {
  const textNode = (text) => ({ nodeType: 3, textContent: text })
  const elementNode = (tagName, childNodes) => ({
    childNodes,
    nodeType: 1,
    tagName,
  })
  const noticeElement = elementNode("DIV", [
    textNode("\n    "),
    elementNode("P", [
      textNode("  Right bank: "),
      elementNode("STRONG", [textNode("emergency")]),
      textNode(".  "),
    ]),
    textNode("\n    "),
    elementNode("P", [
      textNode("Left bank: "),
      elementNode("STRONG", [textNode("scheduled")]),
      textNode(".  "),
    ]),
    textNode("\n  "),
  ])
  const browserPage = {
    locator: () => ({
      evaluate: async (callback) => callback(noticeElement),
      waitFor: async () => {},
    }),
  }

  assert.deepEqual(await getEmergencyOutagesNotice(browserPage), {
    segments: [
      { bold: false, text: "Right bank: " },
      { bold: true, text: "emergency" },
      { bold: false, text: ".\nLeft bank: " },
      { bold: true, text: "scheduled" },
      { bold: false, text: "." },
    ],
  })
})

test("reports an uncertain emergency notice check instead of treating it as absent", async () => {
  const browserPage = {
    locator: () => ({
      count: async () => 1,
      waitFor: async () => Promise.reject(Error("page became unavailable")),
    }),
  }

  await assert.rejects(
    getEmergencyOutagesNotice(browserPage),
    /Emergency outages notice check failed: page became unavailable/,
  )
})


test("closes the browser and returns null when there is no notice", async () => {
  let browserClosed = false
  const browserPage = {
    goto: async () => {},
    waitForSelector: async () => {},
    locator: (selector, { hasText }) => {
      assert.equal(selector, ".m-attention__text")
      assert.equal(hasText.test("Інформація для споживачів"), false)
      assert.equal(hasText.test("Застосовано екстрені відключення"), true)
      assert.equal(hasText.test("Графіки відключень не діють"), true)

      return {
        count: async () => 0,
        waitFor: async () => Promise.reject(Error("missing")),
      }
    },
  }
  const browserType = {
    launch: async () => ({
      close: async () => {
        browserClosed = true
      },
      newPage: async () => browserPage,
    }),
  }

  assert.equal(await fetchEmergencyOutagesNotice({ browserType }), null)
  assert.equal(browserClosed, true)
})

test("fails instead of reporting no notice when the real page is not loaded", async () => {
  let browserClosed = false
  let noticeChecked = false
  const browserType = {
    launch: async () => ({
      close: async () => {
        browserClosed = true
      },
      newPage: async () => ({
        goto: async () => {},
        locator: () => {
          noticeChecked = true
        },
        waitForSelector: async () => Promise.reject(Error("Timeout 30000ms")),
      }),
    }),
  }

  await assert.rejects(
    fetchEmergencyOutagesNotice({ browserType }),
    /Timeout 30000ms/,
  )
  assert.equal(noticeChecked, false)
  assert.equal(browserClosed, true)
})

test("closes the browser when the page fails to load", async () => {
  let browserClosed = false
  const browserType = {
    launch: async () => ({
      close: async () => {
        browserClosed = true
      },
      newPage: async () => ({
        goto: async () => Promise.reject(Error("net::ERR_TIMED_OUT")),
      }),
    }),
  }

  await assert.rejects(
    fetchEmergencyOutagesNotice({ browserType }),
    /net::ERR_TIMED_OUT/,
  )
  assert.equal(browserClosed, true)
})

test("deletes a Telegram notification only after a successful response", async () => {
  let cleared = false
  const deleted = await deleteLastNotification({
    clearLastMessageFn: () => {
      cleared = true
    },
    fetchFn: async () => ({ json: async () => ({ ok: true }), ok: true }),
    loadLastMessageFn: () => ({ message_id: 123 }),
    telegramBotToken: "token",
    telegramChatId: "chat",
  })

  assert.equal(deleted, true)
  assert.equal(cleared, true)
})

test("keeps Telegram state when deletion fails", async () => {
  let cleared = false
  const deleted = await deleteLastNotification({
    clearLastMessageFn: () => {
      cleared = true
    },
    fetchFn: async () => ({
      json: async () => ({ ok: false, description: "failed" }),
      ok: false,
    }),
    loadLastMessageFn: () => ({ message_id: 123 }),
    telegramBotToken: "token",
    telegramChatId: "chat",
  })

  assert.equal(deleted, false)
  assert.equal(cleared, false)
})

test("sends a new notification and saves its message", async () => {
  const requests = []
  const saved = []
  const result = { date: 1, message_id: 7 }
  const sent = await sendNotification("text", {
    fetchFn: async (url, options) => {
      requests.push([url, JSON.parse(options.body)])
      return { json: async () => ({ ok: true, result }), ok: true }
    },
    loadLastMessageFn: () => ({}),
    saveLastMessageFn: (message) => saved.push(message),
    telegramBotToken: "token",
    telegramChatId: "chat",
  })

  assert.equal(sent, true)
  assert.match(requests[0][0], /\/sendMessage$/)
  assert.equal(requests[0][1].message_id, undefined)
  assert.deepEqual(saved, [result])
})

test("edits the previous notification instead of sending a new one", async () => {
  const requests = []
  const sent = await sendNotification("update", {
    fetchFn: async (url, options) => {
      requests.push([url, JSON.parse(options.body)])
      return {
        json: async () => ({ ok: true, result: { message_id: 123 } }),
        ok: true,
      }
    },
    loadLastMessageFn: () => ({ message_id: 123 }),
    saveLastMessageFn: () => {},
    telegramBotToken: "token",
    telegramChatId: "chat",
  })

  assert.equal(sent, true)
  assert.match(requests[0][0], /\/editMessageText$/)
  assert.equal(requests[0][1].message_id, 123)
})

test("keeps the previous notification when an update fails", async () => {
  let saved = false
  const sent = await sendNotification("message", {
    fetchFn: async () => ({
      json: async () => ({ ok: false, description: "failed" }),
      ok: false,
    }),
    loadLastMessageFn: () => ({ message_id: 123 }),
    saveLastMessageFn: () => {
      saved = true
    },
    telegramBotToken: "token",
    telegramChatId: "chat",
  })

  assert.equal(sent, false)
  assert.equal(saved, false)
})

test("keeps an unchanged emergency notification", async () => {
  let saved = false
  const sent = await sendNotification("same message", {
    fetchFn: async () => ({
      json: async () => ({
        ok: false,
        description: "Bad Request: message is not modified",
      }),
      ok: false,
    }),
    loadLastMessageFn: () => ({ message_id: 123 }),
    saveLastMessageFn: () => {
      saved = true
    },
    telegramBotToken: "token",
    telegramChatId: "chat",
  })

  assert.equal(sent, true)
  assert.equal(saved, false)
})

test("rejects sending without Telegram credentials", async () => {
  await assert.rejects(
    sendNotification("text", { telegramBotToken: "", telegramChatId: "chat" }),
    /Missing telegram bot token/,
  )
  await assert.rejects(
    sendNotification("text", { telegramBotToken: "token", telegramChatId: "" }),
    /Missing telegram chat id/,
  )
})

function createRunDeps({ notice, wasActive }) {
  const calls = { deleted: 0, sent: [], states: [] }
  return {
    calls,
    deps: {
      deleteLastNotificationFn: async () => {
        calls.deleted += 1
        return calls.deleteResult ?? true
      },
      fetchNoticeFn: async () => notice,
      generateEmergencyOutagesMessageFn: () => "generated",
      loadEmergencyOutagesStateFn: () => wasActive,
      saveEmergencyOutagesStateFn: (active) => calls.states.push(active),
      sendNotificationFn: async (message) => calls.sent.push(message),
    },
  }
}

test("run sends a notification when an emergency notice appears", async () => {
  const { calls, deps } = createRunDeps({
    notice: { segments: [{ text: "x", bold: false }] },
    wasActive: false,
  })
  await run(deps)

  assert.deepEqual(calls.sent, ["generated"])
  assert.deepEqual(calls.states, [true])
  assert.equal(calls.deleted, 0)
})

test("run deletes the notification and resets state when the notice is gone", async () => {
  const { calls, deps } = createRunDeps({ notice: null, wasActive: true })
  await run(deps)

  assert.equal(calls.deleted, 1)
  assert.deepEqual(calls.states, [false])
  assert.deepEqual(calls.sent, [])
})

test("run keeps the active state when deletion fails", async () => {
  const { calls, deps } = createRunDeps({ notice: null, wasActive: true })
  calls.deleteResult = false
  await run(deps)

  assert.deepEqual(calls.states, [])
})

test("run does nothing when there was and is no notice", async () => {
  const { calls, deps } = createRunDeps({ notice: null, wasActive: false })
  await run(deps)

  assert.equal(calls.deleted, 0)
  assert.deepEqual(calls.states, [])
  assert.deepEqual(calls.sent, [])
})
