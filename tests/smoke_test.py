"""
Tactical Notebook 스모크 테스트 (Playwright, Python)

[처음 한 번 설치]  크롬이 설치되어 있으면 아래 한 줄이면 됨 (2026-10-15 사용자 Windows PC에서 확인)
    pip install playwright

[실행]  프로젝트 폴더에서
    python tests/smoke_test.py

하는 일: 앱을 열어 주요 동작(선수 호출·이동, 새 장면, 그리기, 재생, PNG/JSON 내보내기, CSV 불러오기)을
차례로 해 보고, 페이지 오류가 있으면 실패로 끝낸다. 스크린샷과 내려받은 파일은 tests/out/ 에 남는다.
"""
import asyncio
import pathlib
import sys

from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP = (ROOT / "index.html").as_uri()
CSV = ROOT / "samples" / "squad_sample.csv"
OUT = ROOT / "tests" / "out"


async def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel="chrome")   # PC에 설치된 크롬 사용 (크로뮴 따로 안 받음)
        page = await browser.new_page(viewport={"width": 1440, "height": 900}, accept_downloads=True)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        await page.goto(APP)
        await page.evaluate("localStorage.clear()")          # 매번 처음 상태(빈 장면 1개)로 시작
        await page.reload()
        await page.wait_for_timeout(500)
        box = await page.locator("#board").bounding_box()

        # 1) 새 장면 → 홈 7번 호출 → 클릭 이동
        await page.keyboard.press("KeyN")
        await page.keyboard.press("KeyH")
        await page.keyboard.press("Digit7")
        await page.keyboard.press("Enter")
        await page.mouse.click(box["x"] + box["width"] * 0.75, box["y"] + box["height"] * 0.3)

        # 2) 패스 화살표 그리기
        await page.keyboard.press("KeyP")
        await page.mouse.move(box["x"] + 300, box["y"] + 300)
        await page.mouse.down()
        await page.mouse.move(box["x"] + 500, box["y"] + 260, steps=5)
        await page.mouse.up()
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(400)

        saved = await page.evaluate("JSON.parse(localStorage.getItem('tactical-notebook.v1'))")
        assert len(saved["scenes"]) == 2, "새 장면이 저장되지 않음"
        assert len(saved["scenes"][1]["shapes"]) >= 1, "화살표가 저장되지 않음"

        # 3) 재생
        await page.keyboard.press("BracketLeft")
        await page.keyboard.press("Space")
        await page.wait_for_timeout(1200)
        await page.screenshot(path=str(OUT / "play.png"))
        await page.keyboard.press("Escape")

        # 4) PNG / JSON 내보내기
        for item in ("#expPng", "#expJson"):
            async with page.expect_download() as dl:
                await page.click("#btnExport")
                await page.click(item)
            d = await dl.value
            await d.save_as(str(OUT / d.suggested_filename))

        # 5) CSV 불러오기 (원정팀)
        await page.click("#tabRoster")
        await page.click("#rtAway")
        await page.set_input_files("#csvIn", str(CSV))
        await page.wait_for_timeout(400)
        saved = await page.evaluate("JSON.parse(localStorage.getItem('tactical-notebook.v1'))")
        assert len(saved["teams"]["away"]["roster"]) == 15, "CSV 명단 인원이 다름"

        await page.screenshot(path=str(OUT / "final.png"))
        await browser.close()

    if errors:
        print("실패:", *errors, sep="\n  ")
        return 1
    print("통과 — 결과물:", OUT)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
