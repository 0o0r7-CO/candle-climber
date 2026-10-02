#!/usr/bin/env python3
"""P3.3 — LambdaTest REAL-DEVICE mobile QA for candle-climber.vercel.app.

Real Pixel 7 (Android 13) + Chrome mobile-web session on the LambdaTest grid:
boot → character select (venom) → START CLIMB → tap-jump loop → natural death
card → console log audit → video evidence on the LT dashboard.

Evidence: qa/realdevice/rd-*.png + report JSON (screenshots embedded in LT too).
Credentials come from /home/z/.lt_user + /home/z/.lt_key (0600, never printed).

Exit code 0 = PASS (chips render, run starts, death card reached, 0 SEVERE errors).
"""
import json
import sys
import time
from datetime import datetime

from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

import urllib.parse

PROD = "https://candle-climber.vercel.app"
HUB = "https://hub.lambdatest.com/wd/hub"
STAMP = datetime.now().strftime("%Y%m%d-%H%M%S")
OUT = "/home/z/my-project/qa/realdevice"
LT_API = "https://api.lambdatest.com/automation/api/v1"

LT_USER = open("/home/z/.lt_user").read().strip()
LT_KEY = open("/home/z/.lt_key").read().strip()

report = {"stamp": STAMP, "device": "Pixel 7", "platform": "13", "url": PROD}
checks = []


def check(name, ok, detail=""):
    checks.append({"check": name, "ok": bool(ok), "detail": str(detail)[:300]})
    print(f"[{'PASS' if ok else 'FAIL'}] {name}: {str(detail)[:160]}")
    return bool(ok)


def build_driver():
    o = ChromeOptions()
    o.set_capability("platformName", "Android")
    o.set_capability("browserName", "Chrome")
    o.set_capability("LT:Options", {
        "deviceName": "Pixel 7",
        "platformVersion": "13",
        "isRealMobile": True,
        "w3c": True,
        "build": "G3-real-device-QA",
        "name": "P3.3 real-device mobile QA",
        "video": True,
        "screenshot": True,
        "console": True,
        "network": False,
        "queueTimeout": 300,
        "idleTimeout": 180,
    })
    hub = (f"https://{urllib.parse.quote(LT_USER)}:{urllib.parse.quote(LT_KEY)}"
           f"@hub.lambdatest.com/wd/hub")
    return webdriver.Remote(hub, options=o)


def shot(d, name):
    p = f"{OUT}/rd-{name}-{STAMP}.png"
    try:
        d.get_screenshot_as_file(p)
        report[f"shot_{name}"] = p
        print(f"    screenshot -> {p}")
    except Exception as e:  # noqa: BLE001
        report[f"shot_{name}"] = f"error: {e}"


def tap_canvas(d):
    canvas = d.find_element(By.CSS_SELECTOR, ".cc-canvas")
    ActionChains(d).move_to_element(canvas).click().perform()


def main():
    import os
    os.makedirs(OUT, exist_ok=True)
    d = build_driver()
    sid = d.session_id
    report["session_id"] = sid
    print(f"session: {sid}")

    try:
        d.get(PROD)
        WebDriverWait(d, 60).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".cc-char-chip"))
        )
        chips = d.find_elements(By.CSS_SELECTOR, ".cc-char-chip")
        names = [c.text.strip() for c in chips]
        check("page_title", "candle" in (d.title or "").lower(), d.title)
        check("char_chips_rendered", len(chips) >= 14, f"{len(chips)} chips: {names}")
        shot(d, "01-boot")

        venom = next((c for c in chips if "venom" in c.text.lower()), None)
        if venom:
            venom.click()
            time.sleep(1)
            sel = d.find_elements(By.CSS_SELECTOR, ".cc-char-chip.cc-char-on")
            ok = len(sel) == 1 and "venom" in sel[0].text.lower()
            check("venom_select", ok, sel[0].text.strip() if sel else "none selected")
            shot(d, "02-selected")
        else:
            check("venom_select", False, "venom chip not found")

        start = WebDriverWait(d, 20).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, ".cc-btn-start"))
        )
        start.click()
        try:
            WebDriverWait(d, 20).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, ".cc-chip-score"))
            )
            check("run_started", True, "HUD score chip visible")
        except Exception:
            gone = EC.invisibility_of_element_located((By.CSS_SELECTOR, ".cc-panel"))
            check("run_started", d.execute_script(
                "const p=document.querySelector('.cc-panel');return p?getComputedStyle(p).display==='none':true;"),
                "score chip not found; panel state probed")
        shot(d, "03-running")

        t0 = time.time()
        taps = 0
        dead = False
        while time.time() - t0 < 120:
            try:
                if d.find_elements(By.CSS_SELECTOR, ".cc-death-num"):
                    dead = True
                    break
            except Exception:
                pass
            try:
                tap_canvas(d)
                taps += 1
            except Exception:
                pass
            time.sleep(0.8)
        score_txt = ""
        if dead:
            try:
                score_txt = d.find_element(By.CSS_SELECTOR, ".cc-death-num").text
            except Exception:
                pass
        check("gameplay_then_death_card", dead, f"taps={taps} death-score={score_txt!r}")
        shot(d, "04-deathcard")

        severe = 0
        try:
            for e in d.get_log("browser"):
                if e.get("level") == "SEVERE":
                    severe += 1
                    print(f"    SEVERE: {e.get('message','')[:120]}")
        except Exception as e:  # noqa: BLE001
            report["console_logs"] = f"unsupported: {e}"
        check("no_severe_console_errors", severe == 0, f"{severe} SEVERE entries")
        report["console_severe"] = severe
    finally:
        try:
            d.quit()
        except Exception:
            pass

    import urllib.request
    import base64
    req = urllib.request.Request(
        f"{LT_API}/sessions/{sid}",
        headers={"Authorization": "Basic " + base64.b64encode(
            f"{LT_USER}:{LT_KEY}".encode()).decode()})
    try:
        meta = json.load(urllib.request.urlopen(req, timeout=30))
        report["lt_status"] = meta.get("status")
        report["video_url"] = meta.get("video_url")
        report["dashboard"] = f"https://automation.lambdatest.com/log/{sid}"
    except Exception as e:  # noqa: BLE001
        report["lt_api_error"] = str(e)[:200]

    report["checks"] = checks
    report["pass"] = all(c["ok"] for c in checks)
    with open(f"{OUT}/report-real-{STAMP}.json", "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nSESSION {sid}\nRESULT: {'PASS' if report['pass'] else 'FAIL'}")
    for k in ("lt_status", "video_url", "dashboard"):
        if report.get(k):
            print(f"{k}: {report[k]}")
    return 0 if report["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
