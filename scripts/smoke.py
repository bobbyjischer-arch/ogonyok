"""
Интеграционный прогон режима с куратором (`wrangler dev --env curated`).

Подписывает initData тем же токеном, что лежит в .dev.vars, и проходит по всем
маршрутам: авторизация, занятия, отметки, привычки, фокус, настройки, панель
куратора, вебхук бота и отдача статики. Ничего не мокает — работает настоящий
воркер поверх настоящей локальной D1.

id пользователя и куратора совпадают с `[env.curated.vars]` в wrangler.toml —
они выдуманные, и менять их надо в обоих местах сразу.

    npm run dev:curated                 # в одном терминале
    python scripts/smoke.py [base_url]  # в другом
"""

import hashlib
import hmac
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8787"

# Прогон создаёт и удаляет записи и переписывает настройки пользователя,
# поэтому по боевому адресу он запускаться не должен.
if not any(host in BASE for host in ("127.0.0.1", "localhost", "0.0.0.0")):
    print(f"Отказ: {BASE} не локальный. Прогон меняет данные и рассчитан на wrangler dev.")
    raise SystemExit(2)


def from_dev_vars(name, fallback):
    """Подпись должна считаться тем же токеном, что видит воркер."""
    import os

    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".dev.vars")
    try:
        with open(path, encoding="utf-8") as handle:
            for row in handle:
                row = row.strip()
                if row.startswith(f"{name}="):
                    return row.split("=", 1)[1].strip()
    except OSError:
        pass
    return fallback


TOKEN = from_dev_vars("BOT_TOKEN", "123456789:LOCAL-TEST-TOKEN-NOT-REAL")
WEBHOOK_SECRET = from_dev_vars("WEBHOOK_SECRET", "localdevsecret")

USER = {"id": 10000000001, "first_name": "Тестовый", "username": "tester", "language_code": "ru"}
CURATOR = {"id": 10000000002, "first_name": "Куратор", "username": "curator"}
OUTSIDER = {"id": 999000111, "first_name": "Чужой"}

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
    """Ровно та строка, что приходит из Telegram, с честной подписью."""
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
    for key, value in (headers or {}).items():
        request.add_header(key, value)
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


def main():
    user_auth = init_data(USER)
    curator_auth = init_data(CURATOR)

    print("\n[авторизация]")
    status, _ = call("/api/state")
    check("без initData -> 401", status == 401, status)

    tampered = user_auth[:-4] + "dead"
    status, _ = call("/api/state", auth=tampered)
    check("подделанный hash -> 401", status == 401, status)

    stale = init_data(USER, auth_date=int(time.time()) - 60 * 60 * 48)
    status, _ = call("/api/state", auth=stale)
    check("протухший auth_date -> 401", status == 401, status)

    status, _ = call("/api/state", auth=init_data(OUTSIDER))
    check("не из списка -> 403", status == 403, status)

    status, state = call("/api/state", auth=user_auth)
    check("валидный initData -> 200", status == 200, status)
    state = state.get("state", {}) if isinstance(state, dict) else {}
    check("профиль подхватился", state.get("user", {}).get("id") == USER["id"])
    check("роль обычная", state.get("user", {}).get("role") == "user", state.get("user"))
    check("типы занятий пришли", len(state.get("types", [])) == 9, len(state.get("types", [])))

    print("\n[занятия]")
    status, body = call("/api/activities/start", "POST", {"kind": "work"}, user_auth)
    state = body.get("state", {})
    current = state.get("current")
    check("старт -> 200", status == 200, status)
    check("занятие идёт", current is not None and current["kind"] == "work", current)

    status, body = call("/api/activities/start", "POST", {"kind": "nonsense"}, user_auth)
    check("неизвестный тип -> 400", status == 400, status)

    first_id = current["id"]
    status, body = call(f"/api/activities/{first_id}/checkin", "POST", {"text": "первая отметка"}, user_auth)
    state = body.get("state", {})
    check("отметка -> 200", status == 200, status)
    check("счётчик отметок = 1", state.get("current", {}).get("checkins") == 1, state.get("current"))

    status, _ = call(f"/api/activities/{first_id}/checkin", "POST", {"text": "   "}, user_auth)
    check("пустая отметка -> 400", status == 400, status)

    status, body = call("/api/activities/start", "POST", {"kind": "sport"}, user_auth)
    state = body.get("state", {})
    check("второе занятие закрыло первое", state.get("current", {}).get("kind") == "sport")
    previous = next((a for a in state.get("activities", []) if a["id"] == first_id), None)
    check("у первого проставлен конец", previous is not None and previous["endedAt"] is not None, previous)
    second_id = state["current"]["id"]

    status, _ = call(
        f"/api/activities/{second_id}",
        "PATCH",
        {"endedAt": "2020-01-01T00:00:00.000Z"},
        user_auth,
    )
    check("конец раньше начала -> 400", status == 400, status)

    status, body = call(f"/api/activities/{first_id}", "PATCH", {"kind": "study"}, user_auth)
    changed = next((a for a in body.get("state", {}).get("activities", []) if a["id"] == first_id), None)
    check("смена типа применилась", changed is not None and changed["kind"] == "study", changed)

    status, _ = call("/api/activities/deadbeef/stop", "POST", None, user_auth)
    check("чужое занятие -> 404", status == 404, status)

    print("\n[привычки]")
    # Проверки относительные: база между прогонами не чистится, поэтому важно
    # приращение и состояние своей записи, а не абсолютные количества.
    _, before = call("/api/state", auth=user_auth)
    habits_before = {h["id"] for h in before.get("state", {}).get("habits", [])}

    status, body = call(
        "/api/habits",
        "POST",
        {"title": "Курение", "icon": "wind", "costPerDay": 250, "unitsPerDay": 15, "unitLabel": "сигарет"},
        user_auth,
    )
    habits = body.get("state", {}).get("habits", [])
    fresh = [h for h in habits if h["id"] not in habits_before]
    check("привычка создана", status == 200 and len(fresh) == 1, f"{status} new={len(fresh)}")
    habit_id = fresh[0]["id"] if fresh else ""
    check("поля привычки сохранились", bool(fresh) and fresh[0]["costPerDay"] == 250, fresh[:1])

    status, _ = call("/api/habits", "POST", {"title": "  "}, user_auth)
    check("пустое название -> 400", status == 400, status)

    time.sleep(1.1)
    status, body = call(f"/api/habits/{habit_id}/relapse", "POST", None, user_auth)
    habit = next(
        (h for h in body.get("state", {}).get("habits", []) if h["id"] == habit_id), {}
    )
    check("срыв записан", len(habit.get("relapses", [])) == 1, habit.get("relapses"))
    check("рекорд сохранён", habit.get("bestStreakMs", 0) > 0, habit.get("bestStreakMs"))

    print("\n[полезные привычки и огоньки]")
    status, body = call(
        "/api/habits",
        "POST",
        {"title": "Зарядка", "icon": "dumbbell", "mode": "build", "daysMask": 127},
        user_auth,
    )
    st = body.get("state", {})
    today = st.get("today", "")
    build = [h for h in st.get("habits", []) if h.get("mode") == "build" and h["title"] == "Зарядка"]
    check("привычка-поддержание создана", status == 200 and len(build) >= 1, status)
    check("сервер знает местную дату", bool(today), today)
    build_id = build[-1]["id"] if build else ""
    check("маска дней сохранилась", bool(build) and build[-1]["daysMask"] == 127, build[-1:] and build[-1].get("daysMask"))

    status, body = call(f"/api/habits/{build_id}/day", "POST", {}, user_auth)
    marked = next((h for h in body.get("state", {}).get("habits", []) if h["id"] == build_id), {})
    check("день отмечен", status == 200 and today in marked.get("days", []), marked.get("days"))

    status, body = call(f"/api/habits/{build_id}/day", "POST", {}, user_auth)
    marked = next((h for h in body.get("state", {}).get("habits", []) if h["id"] == build_id), {})
    check("повторный тап снимает отметку", today not in marked.get("days", []), marked.get("days"))

    import datetime as _dt
    yesterday = (_dt.date.fromisoformat(today) - _dt.timedelta(days=1)).isoformat()
    tomorrow = (_dt.date.fromisoformat(today) + _dt.timedelta(days=1)).isoformat()
    old = (_dt.date.fromisoformat(today) - _dt.timedelta(days=90)).isoformat()

    status, body = call(f"/api/habits/{build_id}/day", "POST", {"day": yesterday}, user_auth)
    marked = next((h for h in body.get("state", {}).get("habits", []) if h["id"] == build_id), {})
    check("пропущенный день можно закрыть", yesterday in marked.get("days", []), marked.get("days"))

    status, _ = call(f"/api/habits/{build_id}/day", "POST", {"day": tomorrow}, user_auth)
    check("будущее отметить нельзя -> 400", status == 400, status)

    status, _ = call(f"/api/habits/{build_id}/day", "POST", {"day": old}, user_auth)
    check("слишком старый день -> 400", status == 400, status)

    status, _ = call(f"/api/habits/{build_id}/day", "POST", {"day": "31.12.2026"}, user_auth)
    check("кривой формат даты -> 400", status == 400, status)

    status, _ = call(f"/api/habits/{habit_id}/day", "POST", {}, user_auth)
    check("отметка дня на привычке-отказе -> 400", status == 400, status)

    status, body = call(f"/api/habits/{build_id}", "PATCH", {"daysMask": 0}, user_auth)
    patched = next((h for h in body.get("state", {}).get("habits", []) if h["id"] == build_id), {})
    check("пустая маска не сохраняется", patched.get("daysMask") == 127, patched.get("daysMask"))

    status, body = call(f"/api/habits/{build_id}", "PATCH", {"daysMask": 21}, user_auth)
    patched = next((h for h in body.get("state", {}).get("habits", []) if h["id"] == build_id), {})
    check("расписание пн/ср/пт сохранилось", patched.get("daysMask") == 21, patched.get("daysMask"))

    print("\n[фокус и настройки]")
    sessions_before = len(before.get("state", {}).get("sessions", []))
    status, body = call(
        "/api/focus", "POST", {"habitId": habit_id, "durationMs": 300000, "completed": True}, user_auth
    )
    sessions = body.get("state", {}).get("sessions", [])
    check(
        "сессия фокуса записана",
        status == 200 and len(sessions) == sessions_before + 1,
        f"{status} {sessions_before}->{len(sessions)}",
    )

    status, _ = call("/api/focus", "POST", {"habitId": "нет-такой", "durationMs": 1000}, user_auth)
    check("чужая привычка в фокусе -> 400", status == 400, status)

    status, body = call("/api/settings", "PATCH", {"language": "en", "currency": "usd"}, user_auth)
    settings = body.get("state", {}).get("user", {}).get("settings", {})
    check("язык сохранён", settings.get("language") == "en", settings)
    check("валюта нормализована", settings.get("currency") == "USD", settings)

    status, _ = call("/api/settings", "PATCH", {"currency": "рубли"}, user_auth)
    check("кривая валюта -> 400", status == 400, status)

    status, body = call("/api/settings", "PATCH", {"notifications": False}, user_auth)
    settings = body.get("state", {}).get("user", {}).get("settings", {})
    check("не куратор не глушит уведомления", settings.get("notifications") is True, settings)

    print("\n[оформление]")
    status, body = call("/api/settings", "PATCH", {"theme": "dark", "palette": "warm"}, user_auth)
    settings = body.get("state", {}).get("user", {}).get("settings", {})
    check("тёмная тема сохранилась", settings.get("theme") == "dark", settings.get("theme"))
    check("тёплая палитра сохранилась", settings.get("palette") == "warm", settings.get("palette"))

    status, body = call("/api/settings", "PATCH", {"theme": "неон", "palette": "кислотная"}, user_auth)
    settings = body.get("state", {}).get("user", {}).get("settings", {})
    check("мусор в теме падает на auto", settings.get("theme") == "auto", settings.get("theme"))
    check("мусор в палитре падает на system", settings.get("palette") == "system", settings.get("palette"))

    status, body = call("/api/settings", "PATCH", {"palette": "telegram"}, user_auth)
    settings = body.get("state", {}).get("user", {}).get("settings", {})
    check("палитра Telegram принимается", settings.get("palette") == "telegram", settings.get("palette"))
    call("/api/settings", "PATCH", {"theme": "auto", "palette": "system"}, user_auth)

    print("\n[куратор]")
    status, _ = call("/api/curator", auth=user_auth)
    check("обычному пользователю -> 403", status == 403, status)

    status, body = call("/api/curator", auth=curator_auth)
    check("куратору -> 200", status == 200, status)
    check("видит чужое занятие", len(body.get("open", [])) >= 1, body.get("open"))

    status, body = call("/api/state", auth=curator_auth)
    check("роль куратора", body.get("state", {}).get("user", {}).get("role") == "curator")

    print("\n[куратор правит чужие события]")
    status, body = call("/api/curator", auth=curator_auth)
    recent = body.get("recent", [])
    check("лента событий пришла", status == 200 and len(recent) >= 1, len(recent))
    check("в ленте видно автора", bool(recent) and "name" in recent[0].get("user", {}), recent[:1])

    foreign = next((e for e in recent if e["id"] == second_id), None)
    check("чужое занятие в ленте", foreign is not None, second_id)

    status, _ = call(f"/api/activities/{second_id}", "PATCH", {"kind": "cooking"}, curator_auth)
    check("куратор правит чужое занятие -> 200", status == 200, status)
    _, body = call("/api/curator", auth=curator_auth)
    changed = next((e for e in body.get("recent", []) if e["id"] == second_id), {})
    check("правка применилась", changed.get("kind") == "cooking", changed.get("kind"))

    status, _ = call(f"/api/activities/{second_id}/checkin", "POST", {"text": "за него"}, curator_auth)
    check("отметку за другого писать нельзя -> 403", status == 403, status)

    # Занятие принадлежит другому пользователю — обычный не должен его видеть.
    status, _ = call(f"/api/activities/{second_id}", "PATCH", {"kind": "work"}, init_data(OUTSIDER))
    check("посторонний не правит чужое -> 403", status == 403, status)

    print("\n[вебхук бота]")
    update = {
        "update_id": 1,
        "message": {
            "message_id": 10,
            "from": {"id": USER["id"], "first_name": "Веруня", "is_bot": False},
            "chat": {"id": USER["id"], "type": "private"},
            "date": int(time.time()),
            "text": "пишу отчёт, половина готова",
        },
    }
    status, _ = call("/tg/webhook", "POST", update)
    check("без секрета -> 403", status == 403, status)

    status, _ = call("/tg/webhook", "POST", update, headers={"x-telegram-bot-api-secret-token": "wrong"})
    check("чужой секрет -> 403", status == 403, status)

    status, _ = call(
        "/tg/webhook", "POST", update, headers={"x-telegram-bot-api-secret-token": WEBHOOK_SECRET}
    )
    check("верный секрет -> 200", status == 200, status)

    time.sleep(2.5)  # обработка доезжает в waitUntil уже после ответа
    _, body = call("/api/state", auth=user_auth)
    current = body.get("state", {}).get("current", {})
    check("сообщение стало отметкой", current.get("checkins") == 1, current)

    # Привычки из чата — только у публичной версии. Здесь кнопка должна
    # отлетать, а следующее сообщение остаться обычной отметкой.
    call(
        "/tg/webhook",
        "POST",
        {
            "update_id": 2,
            "callback_query": {
                "id": "2",
                "from": {"id": USER["id"], "first_name": "Веруня", "is_bot": False},
                "message": {
                    "message_id": 11,
                    "chat": {"id": USER["id"], "type": "private"},
                    "date": int(time.time()),
                },
                "data": "hab:new:build",
            },
        },
        headers={"x-telegram-bot-api-secret-token": WEBHOOK_SECRET},
    )
    time.sleep(2.0)
    sneaky = f"Привычка из чата {int(time.time())}"
    call(
        "/tg/webhook",
        "POST",
        {
            "update_id": 3,
            "message": {
                "message_id": 12,
                "from": {"id": USER["id"], "first_name": "Веруня", "is_bot": False},
                "chat": {"id": USER["id"], "type": "private"},
                "date": int(time.time()),
                "text": sneaky,
            },
        },
        headers={"x-telegram-bot-api-secret-token": WEBHOOK_SECRET},
    )
    time.sleep(2.0)
    _, body = call("/api/state", auth=user_auth)
    state = body.get("state", {})
    check(
        "кнопка привычек в закрытой версии не работает",
        sneaky not in [habit["title"] for habit in state.get("habits", [])],
        state.get("habits"),
    )
    check("а сообщение осталось отметкой", state.get("current", {}).get("checkins") == 2, state.get("current"))

    print("\n[статика и роутинг]")
    status, raw = call("/")
    check("корень отдаёт мини-апп", status == 200 and "<div id=\"root\">" in str(raw), status)
    status, raw = call("/habits")
    check("SPA-фолбэк работает", status == 200 and "<div id=\"root\">" in str(raw), status)
    status, _ = call("/api/nope", auth=user_auth)
    check("неизвестный маршрут -> 404", status == 404, status)
    status, _ = call("/setup")
    check("setup без секрета -> 403", status == 403, status)

    print("\n[уборка]")
    status, body = call(f"/api/habits/{build_id}", "DELETE", None, user_auth)
    left = [h for h in body.get("state", {}).get("habits", []) if h["id"] == build_id]
    check("привычка-поддержание удалена", status == 200 and not left, status)
    status, body = call(f"/api/habits/{habit_id}", "DELETE", None, user_auth)
    left = [h for h in body.get("state", {}).get("habits", []) if h["id"] == habit_id]
    check("привычка удалена вместе с историей", status == 200 and not left, status)
    status, body = call(f"/api/activities/{second_id}", "DELETE", None, user_auth)
    left = [a for a in body.get("state", {}).get("activities", []) if a["id"] == second_id]
    check("занятие удалено", status == 200 and not left, status)

    print(f"\nИтого: {passed} ок, {failed} провалов")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
