# Симулятор мініігор — бекенд

Серверна частина вебплатформи «Симулятор мініігор» — казино-подібного застосунку з
віртуальною валютою (без реальних коштів). Реалізована як набір **мікросервісів** на
Node.js, що працюють за спільним шлюзом nginx і зберігають дані в PostgreSQL.

Уся ігрова логіка та операції з балансом виконуються **на сервері**, де їх неможливо
підмінити з боку клієнта — це гарантує чесність гри.

## Архітектура

```
                        ┌──────────────────────────┐
        HTTP :80        │      nginx (шлюз)         │
  клієнт ───────────────▶  CORS, маршрутизація,     │
                        │  блокування /api/balance  │
                        └────────────┬─────────────┘
                     /accounts,/admin │ /games,/items,/auction,
                     /stats,/donations│ /drops,/clicker,/battles
                        ┌─────────────▼──────────┐  ┌──────────────────────┐
                        │   auth-service  :5001  │  │  games-service :5002 │
                        │  акаунти, JWT, адмінка,│  │  ігри, економіка,    │
                        │  статистика, донати    │  │  битви (SSE)         │
                        └─────────────┬──────────┘  └──────────┬───────────┘
                                      │        pg (SQL)        │
                                      └───────────┬───────────┘
                                        ┌─────────▼─────────┐
                                        │  PostgreSQL :5432 │
                                        │     casino_db     │
                                        └───────────────────┘
```

- **auth-service** (порт 5001) — реєстрація та вхід (нікнейм або Google), видача й перевірка
  JWT, профіль, баланс, статистика, донати (Google Pay), адміністративна панель.
- **games-service** (порт 5002) — ігрові механіки (Dice, Roulette, Mines, Plinko, кейси),
  битви Coin Flip (через Server-Sent Events), інвентар, аукціон, клікер, стрічка дропів.
- **nginx** (порт 80) — єдина точка входу: маршрутизує запити між сервісами, додає CORS і
  блокує зовнішній доступ до внутрішнього маршруту `/api/balance`.
- **PostgreSQL 15** — спільне сховище; схема ініціалізується автоматично під час старту
  сервісів (ідемпотентно, без окремого інструмента міграцій).

## Технології

- **Node.js** (ES Modules) + **Express 4**
- **PostgreSQL** через драйвер **pg**
- **jsonwebtoken** — автентифікація JWT (HS256)
- **bcryptjs** — хешування паролів
- **nginx** — реверс-проксі / шлюз API
- **Docker** + **docker-compose** — локальне середовище

## Структура репозиторію

```
dyplom_work_backend/
├── auth-service/
│   └── src/
│       ├── index.js              # точка входу, монтування роутерів
│       ├── db.js                 # пул pg + ініціалізація схеми
│       ├── middleware/auth.js    # requireAuth / requireAdmin
│       ├── routes/               # auth, admin, stats, donations
│       ├── constants/            # досягнення
│       └── utils/dto.js          # перетворення сутностей у відповіді
├── games-service/
│   └── src/
│       ├── index.js
│       ├── db.js
│       ├── itemDefs.js           # описи предметів
│       ├── middleware/auth.js
│       ├── routes/               # dice, roulette, mines, plinko, cases,
│       │                         #   battles, items, auction, clicker, drops
│       └── constants/
├── nginx/nginx.conf              # конфігурація шлюзу
├── docker-compose.yml
└── .env.example                  # шаблон змінних середовища
```

## Швидкий старт (Docker)

```bash
# 1. створити .env зі своїми значеннями
cp .env.example .env        # Windows: copy .env.example .env

# 2. підняти всі сервіси
docker compose up --build
```

Після старту доступно:

| Сервіс        | URL                       |
|---------------|---------------------------|
| API (шлюз)    | http://localhost          |
| auth-service  | http://localhost:5001     |
| games-service | http://localhost:5002     |
| PostgreSQL    | localhost:5432            |

Зупинка з повним очищенням бази (якщо змінювали пароль/схему):

```bash
docker compose down -v
```

## Локальний запуск без Docker

Потрібен запущений PostgreSQL і змінні середовища (див. нижче). Для кожного сервісу:

```bash
cd auth-service && npm install && npm start
cd games-service && npm install && npm start
```

## Змінні середовища

Скопіюйте `.env.example` у `.env` і заповніть. Значення `:-` у `docker-compose.yml` —
це **небезпечні дефолти лише для розробки**; у продакшені їх треба перевизначити.

| Змінна              | Сервіс         | Призначення                                                  |
|---------------------|----------------|-------------------------------------------------------------|
| `DATABASE_URL`      | обидва         | рядок підключення до PostgreSQL                             |
| `JWT_SECRET`        | обидва         | секрет підпису JWT (**має збігатися** в обох сервісах)      |
| `PORT`              | обидва         | порт сервісу (5001 / 5002)                                  |
| `GOOGLE_CLIENT_ID`  | auth-service   | Client ID для входу через Google (без нього вхід через Google вимкнено) |
| `SEED_DEFAULT_ADMIN`| auth-service   | `true` — створити стартового адміністратора                 |
| `ADMIN_PASSWORD`    | auth-service   | пароль стартового адміністратора                            |
| `AUTH_SERVICE_URL`  | games-service  | адреса auth-service для міжсервісних викликів                |

## API

Базовий префікс — `/api/v1`. Маршрути з 🔒 потребують заголовок
`Authorization: Bearer <JWT>`, з 🛡 — роль адміністратора.

### auth-service

| Метод | Маршрут                                   | Опис                              |
|-------|-------------------------------------------|-----------------------------------|
| POST  | `/accounts/auth/register`                 | реєстрація за нікнеймом           |
| POST  | `/accounts/auth/login`                    | вхід за нікнеймом                 |
| POST  | `/accounts/auth/google`                   | вхід через Google                 |
| POST  | `/accounts/logout` 🔒                      | вихід                             |
| GET   | `/accounts/users/me` 🔒                    | поточний користувач               |
| GET   | `/accounts/users/me/balance` 🔒            | баланс                            |
| PATCH | `/accounts/users/me` 🔒                    | оновлення профілю (аватар тощо)   |
| GET   | `/stats/me` 🔒                             | ігрова статистика користувача     |
| GET   | `/donations/packages`                     | список пакетів поповнення         |
| POST  | `/donations/checkout` 🔒                   | оплата через Google Pay           |
| GET   | `/donations/me` 🔒                         | історія донатів користувача       |
| GET   | `/admin/dashboard` 🛡                      | зведена статистика                |
| GET   | `/admin/analytics` 🛡                      | аналітика ігор і дропів           |
| GET   | `/admin/audit` 🛡                          | журнал дій адміністраторів        |
| GET   | `/admin/donations` 🛡                      | донати та дохід                   |
| GET   | `/admin/users` 🛡                          | користувачі (пошук, фільтр, пагінація) |
| GET / PATCH / DELETE | `/admin/users/:id` 🛡           | перегляд / редагування / видалення |
| POST  | `/admin/users/:id/ban` · `/unban` 🛡       | бан / розбан                      |
| POST  | `/admin/users/:id/give-balance` 🛡         | нарахувати баланс                 |
| POST  | `/admin/users/:id/give-item` 🛡            | видати предмет                    |
| POST  | `/admin/users/:id/give-clicker-coins` 🛡   | видати коіни клікера              |
| POST  | `/admin/users/:id/give-achievement` 🛡     | видати досягнення                 |
| DELETE| `/admin/users/:id/achievement/:achId` 🛡   | зняти досягнення                  |

### games-service

| Метод | Маршрут                              | Опис                                  |
|-------|--------------------------------------|---------------------------------------|
| POST  | `/games/dice/game/play` 🔒            | кидок Dice                            |
| POST  | `/games/roulette/game/play` 🔒        | спін рулетки                          |
| POST  | `/games/mines/game/start·step·finish` 🔒 | життєвий цикл партії Mines         |
| POST  | `/games/plinko/game/play` 🔒          | кидок Plinko                          |
| GET   | `/games/cases` · `/games/cases/:id`  | каталог кейсів                        |
| POST  | `/games/cases/game/play` 🔒           | відкриття кейса                       |
| GET   | `/battles` · `/battles/:id` 🔒        | список / деталі битв Coin Flip        |
| POST  | `/battles` · `/:id/join·ready·leave` 🔒 | створення та участь у битві          |
| GET   | `/battles/:id/events`                | потік подій битви (SSE)               |
| GET   | `/items/me` 🔒                        | інвентар користувача                  |
| POST  | `/items/:itemId/sell-vendor` 🔒       | продаж предмета вендору               |
| GET   | `/auction` · POST `/auction` 🔒       | перегляд / виставлення лота           |
| POST  | `/auction/:id/buy` 🔒                 | купівля лота                          |
| GET   | `/clicker` 🔒 · POST `/click·upgrade·convert` 🔒 | клікер і конвертація валюти |
| GET   | `/drops/recent`                      | стрічка останніх дропів               |

## Безпека

- **JWT (HS256).** Токен видає auth-service після входу; обидва сервіси перевіряють його
  тим самим `JWT_SECRET`. У `middleware/auth.js` `requireAuth` додатково звіряє з БД роль,
  статус і версію токена.
- **Миттєвий бан.** Поле `token_version` у користувача дозволяє відкликати всі видані
  токени: при бані версія збільшується, і старі токени стають недійсними (`Session expired`).
- **Хешування паролів** — bcrypt.
- **Захист балансу.** Внутрішній маршрут `/api/balance` заблоковано на рівні nginx (403);
  баланс змінюється лише серверною ігровою логікою атомарними SQL-запитами/транзакціями,
  що унеможливлює від'ємний баланс і подвійні виплати.

## Деплой

Серверну частину розгорнуто на **Railway** (окремі сервіси + PostgreSQL). Реальні значення
змінних середовища задаються в налаштуваннях проєкту Railway, а не в репозиторії.
