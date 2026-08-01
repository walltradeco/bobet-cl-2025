#!/usr/bin/env python3
"""Фед РАХУНКІВ: SofaScore → Edge Function ingest-scores → база.

На відміну від feed_pull.py (голи/асисти, staging + підтвердження),
ЦЕЙ скрипт пише РЕАЛЬНИЙ рахунок матчу — бали перераховуються одразу.
Рішення Богдана 31.07.2026. Запобіжник — «перший запис перемагає» на
боці RPC (файл 132): фед не чіпає рахунок, який уже стоїть.

Самодостатній: сам ходить на SofaScore через headless Playwright
(обходить 403 — перевірено 31.07.2026), сам POSTить у фед.

⚠️ ЗАВЖДИ normaltime, НІКОЛИ current. Матч із пенальті/овертаймом має
current = рахунок ПІСЛЯ пенальті (напр. 2:4), а normaltime = основний
час (0:0). Прогнози завжди на основний час — беремо normaltime.

Скрипт оперує ЛИШЕ SofaScore event_id (беруться з CSV `--map`, дефолт
sofascore_match_ids.csv). Наш match_id(uuid) резолвить RPC у базі через
sofascore_event_map — скрипт uuid узагалі не бачить. Пишемо ЛИШЕ
завершені матчі; RPC ігнорує ті, що вже мають рахунок, тож надсилати
можна повторно без шкоди.

Оточення (не в коді, не в чаті):
    export FEED_URL='https://<проєкт>.supabase.co/functions/v1/ingest-scores'
    export FEED_SECRET='<той самий, що в секреті функції>'

    python3 tools/feed_scores.py --selftest              # логіка без мережі
    python3 tools/feed_scores.py --dry-run               # зібрати, показати, НЕ слати
    python3 tools/feed_scores.py                         # зібрати й надіслати
    python3 tools/feed_scores.py --map тест.csv --since-days 3
"""
import csv
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.request

DEFAULT_MAP = os.path.join(os.path.dirname(__file__), "sofascore_match_ids.csv")
EVENT_URL = "https://api.sofascore.com/api/v1/event/{}"

# Публічний (publishable) ключ — той самий, що в app.html. Не секрет:
# Edge Functions вимагають Authorization на вході навіть коли власна
# перевірка функції — це FEED_SECRET, не JWT.
_ANON_KEY = "sb_publishable_bkXuSYswtmg4xCtecLb9cw_No0oCuSo"


def parse_score(event_json):
    """(home, away) основного часу для ЗАВЕРШЕНОГО матчу, інакше None.

    Пишемо тільки коли status.type == 'finished' і обидва normaltime є.
    Незавершений, перенесений, скасований, або без normaltime → None
    (не чіпаємо — нехай лишається порожнім, адмін внесе за потреби).
    """
    ev = event_json.get("event", event_json)
    status = (ev.get("status") or {}).get("type")
    if status != "finished":
        return None
    home = (ev.get("homeScore") or {}).get("normaltime")
    away = (ev.get("awayScore") or {}).get("normaltime")
    if home is None or away is None:
        return None
    return int(home), int(away)


def load_map(path, since_days):
    """Рядки CSV, обмежені вікном дат [сьогодні - since_days; сьогодні].

    Матчі старші за вікно майже напевно вже мають рахунок — не тягнемо
    їх щоразу. since_days=None → без обмеження (для точкового тесту).
    """
    today = dt.date.today()
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            eid = (r.get("sofascore_event_id") or "").strip()
            if not eid:
                continue
            if since_days is not None:
                try:
                    d = dt.date.fromisoformat((r.get("date") or "").strip())
                except ValueError:
                    continue
                if not (today - dt.timedelta(days=since_days) <= d <= today):
                    continue
            rows.append({"event_id": int(eid),
                         "custom_id": (r.get("sofascore_custom_id") or "").strip(),
                         "label": f"{r.get('home_team_ua','?')} – {r.get('away_team_ua','?')}"})
    return rows


# ⚠️ Реалістичний User-Agent ОБОВʼЯЗКОВИЙ. Дефолтний headless Chromium
# віддає UA з міткою "HeadlessChrome", і SofaScore на datacenter-IP
# (GitHub Actions) повертає йому JSON-заглушку без поля "event" — статус
# читався як "?", і кожен матч тихо йшов у «ще не finished». Знайдено
# 01.08.2026 з логу Actions: 3 finished-матчі, а written=0.
_BROWSER_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
               "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")


def fetch_event(page, custom_id):
    """(event, raw) з ВЕБ-сторінки матчу SofaScore за customId.

    ⚠️ Прямий api.sofascore.com з datacenter-IP GitHub Actions дає
    403 Forbidden (перевірено 01.08.2026, і напряму, і через веб-контекст
    fetch). Але сама ВЕБ-сторінка матчу віддається з тим самим рахунком
    у server-rendered __NEXT_DATA__ (props.pageProps.event) — Cloudflare
    її пускає там, де ріже API. Тому беремо рахунок звідти, без API.

    URL за customId: slug у шляху не важить — SofaScore редіректить за
    customId (перевірено: /x/<customId> → правильна сторінка)."""
    page.goto(f"https://www.sofascore.com/x/{custom_id}",
              wait_until="domcontentloaded", timeout=30000)
    raw = page.evaluate(
        "() => { const s = document.getElementById('__NEXT_DATA__');"
        "        return s ? s.textContent : null; }")
    if not raw:
        # немає __NEXT_DATA__ → або Cloudflare-заглушка, або 404; для
        # діагностики повертаємо початок body
        return None, (page.content() or "")[:200]
    ev = json.loads(raw).get("props", {}).get("pageProps", {}).get("event")
    return ev, raw[:160]


def collect(rows, verbose=True):
    """Обходить матчі headless-браузером, збирає payload завершених."""
    from playwright.sync_api import sync_playwright
    matches = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent=_BROWSER_UA, locale="en-US")
        for i, r in enumerate(rows):
            if not r.get("custom_id"):
                if verbose:
                    print(f"  … {r['label']}: немає customId у CSV — пропуск")
                continue
            if i:
                time.sleep(1.5)   # ввічливість до SofaScore при великому вікні
            try:
                ev, raw = fetch_event(page, r["custom_id"])
            except Exception as e:  # мережа/парсинг одного матчу не валить решту
                if verbose:
                    print(f"  ⚠️  {r['label']} (customId {r['custom_id']}): {e}")
                continue
            score = parse_score(ev) if ev else None
            if score is None:
                if verbose:
                    st = ((ev or {}).get("status") or {}).get("type", "?")
                    note = f"  … {r['label']}: ще не finished ({st}) — пропуск"
                    if ev is None:
                        note += f" | нема __NEXT_DATA__, body={raw!r}"
                    print(note)
                continue
            if verbose:
                print(f"  ✅ {r['label']}: {score[0]}:{score[1]} (normaltime)")
            matches.append({"event_id": r["event_id"],
                            "home": score[0], "away": score[1]})
        browser.close()
    return {"matches": matches}


def post(payload):
    url = os.environ.get("FEED_URL")
    secret = os.environ.get("FEED_SECRET")
    if not url or not secret:
        sys.exit("Немає FEED_URL / FEED_SECRET в оточенні")
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "x-feed-secret": secret,
                 "apikey": _ANON_KEY, "Authorization": f"Bearer {_ANON_KEY}"},
        method="POST")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            print(r.status, r.read().decode())
    except urllib.error.HTTPError as e:
        print(e.code, e.read().decode())


def _selftest():
    # 1) матч із пенальті: current 2:4, normaltime 0:0 → беремо 0:0
    pens = {"event": {"status": {"type": "finished", "code": 120},
            "homeScore": {"current": 2, "normaltime": 0, "penalties": 2},
            "awayScore": {"current": 4, "normaltime": 0, "penalties": 4}}}
    assert parse_score(pens) == (0, 0), parse_score(pens)
    # 2) звичайний завершений: normaltime == current
    norm = {"event": {"status": {"type": "finished", "code": 100},
            "homeScore": {"current": 2, "normaltime": 2},
            "awayScore": {"current": 0, "normaltime": 0}}}
    assert parse_score(norm) == (2, 0), parse_score(norm)
    # 3) не завершений → None
    ns = {"event": {"status": {"type": "notstarted"},
                    "homeScore": {}, "awayScore": {}}}
    assert parse_score(ns) is None
    # 4) перенесений (finished-подібний статус, але не finished) → None
    pp = {"event": {"status": {"type": "postponed"},
                    "homeScore": {}, "awayScore": {}}}
    assert parse_score(pp) is None
    # 5) finished, але без normaltime → None (не пишемо навмання)
    weird = {"event": {"status": {"type": "finished"},
             "homeScore": {"current": 1}, "awayScore": {"current": 0}}}
    assert parse_score(weird) is None
    print("feed_scores selftest OK (пенальті→normaltime, не-finished→None)")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        _selftest()
        sys.exit()
    mp = DEFAULT_MAP
    if "--map" in sys.argv:
        mp = sys.argv[sys.argv.index("--map") + 1]
    since = 7
    if "--since-days" in sys.argv:
        v = sys.argv[sys.argv.index("--since-days") + 1]
        since = None if v.lower() in ("all", "none") else int(v)
    rows = load_map(mp, since)
    print(f"Матчів у вікні: {len(rows)} (map={os.path.basename(mp)}, since_days={since})")
    payload = collect(rows)
    print(f"Готово до запису: {len(payload['matches'])}")
    if "--dry-run" in sys.argv:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        post(payload)
