import { pathToFileURL } from "node:url"

import { chromium } from "playwright"

import {
  CHROMIUM_EXECUTABLE_PATH,
  EMERGENCY_OUTAGES_MESSAGE_FILE,
  SHUTDOWNS_PAGE,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
  TELEGRAM_THREAD_ID,
} from "./constants.js"

import {
  clearLastMessage,
  escapeHtml,
  getEmergencyOutagesAction,
  getCurrentTime,
  loadEmergencyOutagesState,
  loadLastMessage,
  saveEmergencyOutagesState,
  saveLastMessage,
} from "./helpers.js"
import { log, logError } from "./logger.js"

export async function getEmergencyOutagesNotice(browserPage) {
  log("🌀 Checking emergency outages notice...")

  const notice = browserPage.locator(".m-attention__text", {
    hasText: /екстрені|не діють/i,
  })

  try {
    await notice.waitFor({ state: "visible", timeout: 3000 })
    log("🚨 Emergency outages notice detected!")
    return await notice.evaluate((element) => {
      const segments = []

      const appendText = (text, bold) => {
        if (!text) return

        const previousSegment = segments.at(-1)
        if (previousSegment?.bold === bold) {
          previousSegment.text += text
          return
        }

        segments.push({ text, bold })
      }

      const appendLineBreak = () => {
        let lastSegment = segments.at(-1)
        if (!lastSegment) return

        lastSegment.text = lastSegment.text.trimEnd()
        if (!lastSegment.text) {
          segments.pop()
          lastSegment = segments.at(-1)
        }

        if (!lastSegment || lastSegment.text.endsWith("\n")) return
        appendText("\n", false)
      }

      const collectSegments = (node, bold = false) => {
        if (node.nodeType === 3) {
          let text = (node.textContent ?? "").replace(/\s+/g, " ")
          if (segments.at(-1)?.text.endsWith("\n")) {
            text = text.trimStart()
          }
          appendText(text, bold)
          return
        }

        if (node.nodeType !== 1) return
        if (node.tagName === "BR") {
          appendLineBreak()
          return
        }

        const isBold = bold || node.tagName === "STRONG"
        for (const childNode of node.childNodes) {
          collectSegments(childNode, isBold)
        }

        if (node.tagName === "P") appendLineBreak()
      }

      collectSegments(element)

      if (segments.length > 0) {
        segments[0].text = segments[0].text.trimStart()
        segments.at(-1).text = segments.at(-1).text.trimEnd()
      }

      return {
        segments: segments.filter(({ text }) => text !== ""),
      }
    })
  } catch (error) {
    try {
      if ((await notice.count()) === 0) {
        log("🟢 Emergency outages notice is not found.")
        return null
      }
    } catch (countError) {
      throw Error(
        `❌ Emergency outages notice check failed: ${countError.message}`,
      )
    }

    throw Error(
      `❌ Emergency outages notice check failed: ${error.message}`,
    )
  }
}

export async function fetchEmergencyOutagesNotice({
  browserType = chromium,
  executablePath = CHROMIUM_EXECUTABLE_PATH,
} = {}) {
  log("🌀 Getting emergency outages notice...")

  const browser = await browserType.launch({
    headless: true,
    executablePath: executablePath || undefined,
  })

  try {
    const browserPage = await browser.newPage()

    await browserPage.goto(SHUTDOWNS_PAGE, { waitUntil: "load" })

    // Sanity check: the genuine DTEK page contains this meta tag. If it is
    // missing (WAF challenge, error page), fail instead of reporting "no notice".
    await browserPage.waitForSelector('meta[name="csrf-token"]', {
      state: "attached",
    })

    const notice = await getEmergencyOutagesNotice(browserPage)

    log("✅ Getting emergency outages notice finished.")
    return notice
  } catch (error) {
    throw Error(`❌ Getting emergency outages notice failed: ${error.message}`)
  } finally {
    await browser.close()
  }
}

export function generateEmergencyOutagesMessage(notice, now = new Date()) {
  log("🌀 Generating emergency outages message...")

  const formattedNotice = Array.isArray(notice?.segments)
    ? notice.segments
        .map(({ text, bold }) => {
          const escapedText = escapeHtml(text)
          return bold ? `<b>${escapedText}</b>` : escapedText
        })
        .join("")
    : String(notice ?? "")
        .split(/(<\/?strong(?:\s[^<>]*)?>)/gi)
        .map((part) => {
          if (/^<strong(?:\s[^<>]*)?>$/i.test(part)) return "<b>"
          if (/^<\/strong>$/i.test(part)) return "</b>"
          return escapeHtml(part)
        })
        .join("")

  return [
    formattedNotice,
    "",
    `🔄 <i>Отримано від DTEK в ${getCurrentTime(now)}</i>`,
  ].join("\n")
}

export async function deleteLastNotification({
  clearLastMessageFn = clearLastMessage,
  fetchFn = globalThis.fetch,
  lastMessageFile = EMERGENCY_OUTAGES_MESSAGE_FILE,
  loadLastMessageFn = loadLastMessage,
  telegramBotToken = TELEGRAM_BOT_TOKEN,
  telegramChatId = TELEGRAM_CHAT_ID,
} = {}) {
  const lastMessage = loadLastMessageFn(lastMessageFile) || {}

  if (!lastMessage.message_id) {
    log("🟢 Notification is not found.")
    return true
  }

  if (!telegramBotToken)
    throw Error("❌ Missing telegram bot token or chat id.")
  if (!telegramChatId) throw Error("❌ Missing telegram chat id.")

  log("🗑️ Deleting notification...")

  try {
    const response = await fetchFn(
      `https://api.telegram.org/bot${telegramBotToken}/deleteMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChatId,
          message_id: lastMessage.message_id,
        }),
      },
    )

    const data = await response.json()
    if (!response.ok || !data.ok) {
      throw Error(data.description || "Telegram API request failed.")
    }

    clearLastMessageFn(lastMessageFile)
    log("🟢 Notification deleted.")
    return true
  } catch (error) {
    log("🔴 Notification not deleted.", error.message)
    return false
  }
}

export async function sendNotification(
  message,
  {
    fetchFn = globalThis.fetch,
    lastMessageFile = EMERGENCY_OUTAGES_MESSAGE_FILE,
    loadLastMessageFn = loadLastMessage,
    saveLastMessageFn = saveLastMessage,
    telegramBotToken = TELEGRAM_BOT_TOKEN,
    telegram_thread_id = TELEGRAM_THREAD_ID,
    telegramChatId = TELEGRAM_CHAT_ID,
  } = {},
) {
  if (!telegramBotToken)
    throw Error("❌ Missing telegram bot token or chat id.")
  if (!telegramChatId) throw Error("❌ Missing telegram chat id.")

  log("🌀 Sending notification...")

  const lastMessage = loadLastMessageFn(lastMessageFile) || {}
  try {
    const response = await fetchFn(
      `https://api.telegram.org/bot${telegramBotToken}/${
        lastMessage.message_id ? "editMessageText" : "sendMessage"
      }`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChatId,
          message_thread_id: telegram_thread_id,
          text: message,
          parse_mode: "HTML",
          message_id: lastMessage.message_id ?? undefined,
          disable_notification: true,
        }),
      },
    )

    const data = await response.json()
    if (!response.ok || !data.ok) {
      if (
        lastMessage.message_id &&
        data.description?.toLowerCase().includes("message is not modified")
      ) {
        log("🟢 Notification is already up to date.")
        return true
      }

      throw Error(data.description || "Telegram API request failed.")
    }

    saveLastMessageFn(data.result, lastMessageFile)

    log("🟢 Notification sent.")
    return true
  } catch (error) {
    log("🔴 Notification not sent.", error.message)
    return false
  }
}

export async function run({
  deleteLastNotificationFn = deleteLastNotification,
  fetchNoticeFn = fetchEmergencyOutagesNotice,
  generateEmergencyOutagesMessageFn = generateEmergencyOutagesMessage,
  loadEmergencyOutagesStateFn = loadEmergencyOutagesState,
  saveEmergencyOutagesStateFn = saveEmergencyOutagesState,
  sendNotificationFn = sendNotification,
} = {}) {
  const notice = await fetchNoticeFn()
  const wereActive = loadEmergencyOutagesStateFn()
  const action = getEmergencyOutagesAction(notice, wereActive)

  if (action === "send") {
    saveEmergencyOutagesStateFn(true)
    await sendNotificationFn(generateEmergencyOutagesMessageFn(notice))
  }

  if (action === "delete") {
    const deleted = await deleteLastNotificationFn()
    if (deleted) saveEmergencyOutagesStateFn(false)
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run().catch((error) => {
    logError(error.message)
    process.exitCode = 1
  })
}
