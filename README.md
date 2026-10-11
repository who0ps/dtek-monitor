# DTEK Monitor

Моніторить сторінку відключень ДТЕК Київські електромережі
(https://www.dtek-kem.com.ua/ua/shutdowns) і сповіщає в Telegram, коли на ній
з'являється загальне повідомлення про екстрені відключення або про те, що
графіки відключень не діють. Коли повідомлення зникає, сповіщення в Telegram
видаляється.

Графіки погодинних відключень та перевірка за адресою не підтримуються.

## Вимоги

- Linux-сервер з Node.js >= 22.15.1 (версія вказана в `.nvmrc`)
- Chromium для Playwright
- Telegram-бот (токен від @BotFather) і ID чату

## Встановлення на сервері

Приклад для користувача `ubuntu` (змініть `User=` у
`deploy/dtek-monitor.service`, якщо використовуєте іншого).

```bash
sudo git clone https://github.com/who0ps/dtek-monitor /opt/dtek-monitor
sudo chown -R ubuntu:ubuntu /opt/dtek-monitor
cd /opt/dtek-monitor

npm ci --omit=dev
cp .env.example .env
nano .env
```

Версія `playwright` у `package.json` зафіксована (1.63.0) і має збігатися з
версією, якою встановлено Chromium (`~/.cache/ms-playwright/chromium-<ревізія>`
для того самого користувача; ревізія 1243 для 1.63.0). Якщо Chromium уже
встановлено (наприклад, Python-версією Playwright тієї ж версії), додатково
нічого встановлювати не треба. Інакше виконайте `npx playwright install chromium`
від імені користувача, під яким працює сервіс. Якщо Playwright не підтримує вашу
платформу, вкажіть шлях до власного Chromium у `CHROMIUM_EXECUTABLE_PATH`.

Змінні в `.env`:

| Змінна | Опис |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Токен бота |
| `TELEGRAM_CHAT_ID` | ID чату або каналу |
| `TELEGRAM_THREAD_ID` | Необов'язково: ID теми в групі з темами |
| `LOG_LEVEL` | Необов'язково: `debug` вмикає детальні логи кожної перевірки. За замовчуванням пишуться лише події (видалення сповіщення) та помилки |
| `CHROMIUM_EXECUTABLE_PATH` | Необов'язково: шлях до вже встановленого Chromium/Chrome (наприклад, `/usr/bin/chromium`). Потрібен, якщо `playwright install chromium` не підтримує вашу платформу; тоді цей крок встановлення можна пропустити |

## Запуск за розкладом (systemd)

```bash
sudo cp deploy/dtek-monitor.service deploy/dtek-monitor.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now dtek-monitor.timer
```

Скрипт робить одну перевірку, а таймер запускає наступну через 7 хвилин після
завершення попередньої. Якщо `node` встановлено не в `/usr/bin/node`, змініть
`ExecStart` у `dtek-monitor.service` (шлях покаже `which node`).

Корисні команди:

```bash
systemctl list-timers dtek-monitor.timer
sudo systemctl start dtek-monitor.service   # разова перевірка зараз
journalctl -u dtek-monitor.service -n 50
```

## Ручний запуск і тести

```bash
npm start   # одна перевірка (читає .env)
npm test
```

Стан зберігається в `artifacts/` (не потрапляє в git): `emergency-outages.json`
і `emergency-outages-message.json`. Не запускайте кілька копій монітора з одним
каталогом стану одночасно.

## Ліцензія

MIT
