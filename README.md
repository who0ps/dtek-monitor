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

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin dtek
sudo git clone https://github.com/who0ps/dtek-monitor /opt/dtek-monitor
sudo chown -R dtek:dtek /opt/dtek-monitor
cd /opt/dtek-monitor

# залежності та браузер (від імені користувача dtek)
sudo -u dtek npm ci --omit=dev
sudo -u dtek npx playwright install chromium
# системні бібліотеки для Chromium (потребує root)
sudo npx playwright install-deps chromium

# налаштування
sudo -u dtek cp .env.example .env
sudo -u dtek nano .env
```

Playwright зберігає браузери в `~/.cache/ms-playwright` користувача, від якого
виконано `playwright install`. Якщо Chromium уже встановлено (наприклад, через
Python-версію Playwright) для того ж користувача, Node-версія використає його
лише за збігу ревізії браузера; інакше завантажить свою копію поруч. Щоб
використовувати вже наявного користувача, змініть `User=` у
`dtek-monitor.service` і виконайте встановлення від його імені.

Змінні в `.env`:

| Змінна | Опис |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Токен бота |
| `TELEGRAM_CHAT_ID` | ID чату або каналу |
| `TELEGRAM_THREAD_ID` | Необов'язково: ID теми в групі з темами |
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
