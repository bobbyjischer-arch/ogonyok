"""
Прогон публичной версии («Огонёк») против локального `wrangler dev`.

Отдельный файл, а не флаг в smoke.py: у режима с куратором своя база, свои
переменные (PUBLIC_MODE=0, непустой ALLOWED_USERS) и свой токен бота, поэтому
воркер под него поднимается отдельной командой.

    npm run dev                         # в одном терминале
    python scripts/smoke_public.py      # в другом

Проверяем ровно то, чем публичная версия отличается от режима с куратором:
пускает кого угодно, но не путает людей между собой и не раздаёт панель.
"""

import hashlib
import hmac
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8787"

# Прогон заводит и удаляет привычки, поэтому по боевому адресу не запускается.
if not any(host in BASE for host in ("127.0.0.1", "localhost", "0.0.0.0")):
    print(f"Отказ: {BASE} не локальный. Прогон меняет данные и рассчитан на wrangler dev.")
    raise SystemExit(2)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def from_dev_vars(name, fallback):
    """Подпись считается тем же токеном, что видит воркер."""
    path = os.path.join(ROOT, ".dev.vars")
    try:
        with open(path, encoding="utf-8") as handle:
            for row in handle:
                row = row.strip()
                if row.startswith(f"{name}="):
                    return row.split("=", 1)[1].strip()
    except OSError:
        pass
    return fallback


def curator_from_config():
    """
    id куратора берём из wrangler.toml, а не хардкодим: в поставке он пуст
    (публичной версии куратор не нужен), и тогда проверять панель не на ком —
    её проверки просто не выполняются, о чём прогон честно печатает.
    Читаем корневой [vars], до первого [env....].
    """
    try:
        with open(os.path.join(ROOT, "wrangler.toml"), encoding="utf-8") as handle:
            for row in handle:
                row = row.strip()
                if row.startswith("[env."):
                    break
                if row.startswith("CURATOR_ID"):
                    value = row.split("=", 1)[1].strip().strip('"').strip("'")
                    return int(value) if value.isdigit() else 0
    except OSError:
        pass
    return 0


TOKEN = from_dev_vars("BOT_TOKEN", "123456789:LOCAL-TEST-TOKEN-NOT-REAL")
WEBHOOK_SECRET = from_dev_vars("WEBHOOK_SECRET", "localdevsecret")

# Оба — люди с улицы: в ALLOWED_USERS их нет и быть не может.
STRANGER = {"id": 770000001, "first_name": "Прохожий", "username": "passerby"}
OTHER = {"id": 770000002, "first_name": "Другая", "username": "another"}
CURATOR_ID = curator_from_config()
CURATOR = {"id": CURATOR_ID, "first_name": "Куратор", "username": "curator"}

passed, failed = 0, 0


def check(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  ok   {name}")
    else:
        failed += 1
        print(f"  FAIL {name} {detail}")


def init_data(user, auth_date=None):
    fields = {
        "auth_date": str(auth_date or int(time.time())),
        "query_id": "AAF-test",
        "user": json.dumps(user, separators=(",", ":"), ensure_ascii=False),
    }
    check_string = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", TOKEN.encode(), hashlib.sha256).digest()
    fields["hash"] = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
    return urllib.parse.urlencode(fields)


def call(path, method="GET", body=None, auth=None, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(BASE + path, data=data, method=method)
    request.add_header("content-type", "application/json")
    if auth:
        request.add_header("authorization", f"tma {auth}")
    for name, value in (headers or {}).items():
        request.add_header(name, value)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read().decode()
            try:
                return response.status, json.loads(raw)
            except json.JSONDecodeError:
                return response.status, raw
    except urllib.error.HTTPError as error:
        raw = error.read().decode()
        try:
            return error.code, json.loads(raw)
        except json.JSONDecodeError:
            return error.code, raw


def titles(state):
    return [habit["title"] for habit in state.get("habits", [])]


UPDATE_ID = [1000]


def to_bot(user, text=None, data=None):
    """
    Гоняем бота через настоящий вебхук: другого входа у него нет. Ответы в
    Telegram не уходят (токен локальный и ненастоящий), но всё, что бот пишет
    в базу, делается до отправки — и это как раз то, что проверяем.
    """
    UPDATE_ID[0] += 1
    message = {
        "message_id": UPDATE_ID[0],
        "from": {**user, "is_bot": False},
        "chat": {"id": user["id"], "type": "private"},
        "date": int(time.time()),
    }
    if data is None:
        update = {"update_id": UPDATE_ID[0], "message": {**message, "text": text}}
    else:
        update = {
            "update_id": UPDATE_ID[0],
            "callback_query": {
                "id": str(UPDATE_ID[0]),
                "from": {**user, "is_bot": False},
                "message": message,
                "data": data,
            },
        }
    status, _ = call(
        "/tg/webhook",
        "POST",
        update,
        headers={"x-telegram-bot-api-secret-token": WEBHOOK_SECRET},
    )
    # Работа идёт в waitUntil уже после ответа 200 — ждём, иначе гонка.
    time.sleep(2.0)
    return status


def habit_by_title(state, title):
    return next((h for h in state.get("habits", []) if h["title"] == title), None)


def main():
    stranger = init_data(STRANGER)
    other = init_data(OTHER)

    print("\n[открыто всем]")
    status, body = call("/api/state", auth=stranger)
    check("посторонний пускается -> 200", status == 200, status)
    state = body.get("state", {}) if isinstance(body, dict) else {}
    check("флаг публичной версии", state.get("isPublic") is True, state.get("isPublic"))
    check("название пришло", bool(state.get("appName")), state.get("appName"))
    check("роль обычная", state.get("user", {}).get("role") == "user", state.get("user"))

    status, _ = call("/api/state", auth=other)
    check("и второй посторонний тоже -> 200", status == 200, status)

    print("\n[свои привычки]")
    mine = f"Проверка {int(time.time())}"
    status, body = call(
        "/api/habits",
        "POST",
        {"title": mine, "icon": "dumbbell", "mode": "build", "daysMask": 127},
        stranger,
    )
    state = body.get("state", {}) if isinstance(body, dict) else {}
    check("посторонний завёл привычку", status == 200 and mine in titles(state), status)

    habit = next((h for h in state.get("habits", []) if h["title"] == mine), None)
    today = state.get("today")
    status, body = call(f"/api/habits/{habit['id']}/day", "POST", {"day": today}, stranger)
    state = body.get("state", {}) if isinstance(body, dict) else {}
    marked = next((h for h in state.get("habits", []) if h["id"] == habit["id"]), {})
    check("отметил день", status == 200 and today in marked.get("days", []), marked.get("days"))

    print("\n[чужого не видно]")
    _, body = call("/api/state", auth=other)
    check("данные не протекают между людьми", mine not in titles(body.get("state", {})))

    status, _ = call(f"/api/habits/{habit['id']}", "DELETE", None, other)
    check("чужую привычку не удалить -> 404", status == 404, status)

    print("\n[куратор]")
    status, _ = call("/api/curator", auth=stranger)
    check("панель куратора чужому закрыта -> 403", status == 403, status)

    if CURATOR_ID:
        curator = init_data(CURATOR)
        status, body = call("/api/curator", auth=curator)
        check("куратор панель видит -> 200", status == 200, status)
        check("в панели есть лента", isinstance(body.get("recent"), list), type(body).__name__)
    else:
        print("  --   CURATOR_ID в wrangler.toml пуст: панель проверять не на ком")

    print("\n[подпись]")
    status, _ = call("/api/state")
    check("без initData -> 401", status == 401, status)
    status, _ = call("/api/state", auth=stranger[:-4] + "dead")
    check("подделанный hash -> 401", status == 401, status)
    stale = init_data(STRANGER, auth_date=int(time.time()) - 60 * 60 * 48)
    status, _ = call("/api/state", auth=stale)
    check("протухший auth_date -> 401", status == 401, status)

    print("\n[привычка из чата]")
    built = f"Зарядка {int(time.time())}"
    check("режим выбран кнопкой -> 200", to_bot(STRANGER, data="hab:new:build") == 200)
    check("название ушло сообщением -> 200", to_bot(STRANGER, text=built) == 200)

    _, body = call("/api/state", auth=stranger)
    state = body.get("state", {})
    chat_habit = habit_by_title(state, built)
    check("привычка завелась из переписки", chat_habit is not None, titles(state))
    check("режим — полезная", (chat_habit or {}).get("mode") == "build", chat_habit)
    check(
        "иконка настоящая, не выдуманная",
        (chat_habit or {}).get("icon") == "target",
        (chat_habit or {}).get("icon"),
    )

    if chat_habit:
        check("день отмечен кнопкой", to_bot(STRANGER, data=f"hab:mark:{chat_habit['id']}") == 200)
        _, body = call("/api/state", auth=stranger)
        state = body.get("state", {})
        marked = habit_by_title(state, built) or {}
        check("отметка видна в приложении", state.get("today") in marked.get("days", []), marked)

        to_bot(STRANGER, data=f"hab:mark:{chat_habit['id']}")
        _, body = call("/api/state", auth=stranger)
        again = habit_by_title(body.get("state", {}), built) or {}
        check("повторный тап снимает отметку", again.get("days") == [], again.get("days"))

    quit_title = f"Сахар {int(time.time())}"
    to_bot(OTHER, data="hab:new:quit")
    to_bot(OTHER, text=quit_title)
    _, body = call("/api/state", auth=other)
    quit_habit = habit_by_title(body.get("state", {}), quit_title)
    check("вредная привычка тоже заводится", (quit_habit or {}).get("mode") == "quit", quit_habit)

    if quit_habit:
        started = quit_habit["startedAt"]
        to_bot(OTHER, data=f"hab:slipped:{quit_habit['id']}")
        _, body = call("/api/state", auth=other)
        after = habit_by_title(body.get("state", {}), quit_title) or {}
        check("срыв обнуляет счётчик", after.get("startedAt", "") > started, after.get("startedAt"))

        check(
            "чужую привычку кнопкой не тронуть",
            to_bot(STRANGER, data=f"hab:slipped:{quit_habit['id']}") == 200,
        )
        _, body = call("/api/state", auth=other)
        intact = habit_by_title(body.get("state", {}), quit_title) or {}
        check(
            "и она осталась как была",
            intact.get("startedAt") == after.get("startedAt"),
            intact.get("startedAt"),
        )

    print("\n[уборка]")
    status, body = call(f"/api/habits/{habit['id']}", "DELETE", None, stranger)
    check("привычка удалена", status == 200 and mine not in titles(body.get("state", {})), status)

    if chat_habit:
        status, body = call(f"/api/habits/{chat_habit['id']}", "DELETE", None, stranger)
        check("завёденная из чата убрана", status == 200 and built not in titles(body.get("state", {})), status)
    if quit_habit:
        status, body = call(f"/api/habits/{quit_habit['id']}", "DELETE", None, other)
        check("вредная убрана", status == 200 and quit_title not in titles(body.get("state", {})), status)

    print(f"\nИтого: {passed} ок, {failed} провалов")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
