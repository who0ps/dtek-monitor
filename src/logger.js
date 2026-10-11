const LOG_TIME_ZONE = "Europe/Kyiv"

export function getLogTimestamp(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: LOG_TIME_ZONE,
    year: "numeric",
  }).formatToParts(now)
  const value = (type) => parts.find((part) => part.type === type)?.value

  return `${value("year")}-${value("month")}-${value("day")} ${value(
    "hour",
  )}:${value("minute")}:${value("second")} ${LOG_TIME_ZONE}`
}

function write(method, values) {
  console[method](`[${getLogTimestamp()}]`, ...values)
}

// Routine progress messages; printed only when LOG_LEVEL=debug.
export function debug(...values) {
  if (process.env.LOG_LEVEL?.trim().toLowerCase() !== "debug") return
  write("log", values)
}

export function log(...values) {
  write("log", values)
}

export function warn(...values) {
  write("warn", values)
}

export function logError(...values) {
  write("error", values)
}
