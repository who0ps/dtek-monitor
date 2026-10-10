import path from "node:path"
import { fileURLToPath } from "node:url"

export const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_THREAD_ID } =
  process.env

export const SHUTDOWNS_PAGE = "https://www.dtek-kem.com.ua/ua/shutdowns"

const STATE_DIR = fileURLToPath(new URL("../artifacts/", import.meta.url))

export const EMERGENCY_OUTAGES_MESSAGE_FILE = path.join(
  STATE_DIR,
  "emergency-outages-message.json",
)
export const EMERGENCY_OUTAGES_STATE_FILE = path.join(
  STATE_DIR,
  "emergency-outages.json",
)
