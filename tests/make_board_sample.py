"""samples/board_sample.json 만들기 (가짜 데이터).

실제 경기 영상 없이 트래커 → 보드 연동을 시험하려고, 4-3-3 대 4-4-2가 8초 동안 움직이는
가짜 tracks.json을 만든 뒤 진짜 tracker/export_board.py로 board.json을 뽑는다.
트래커 ID가 중간에 바뀌는 상황(선수 겹침)도 일부러 넣었다.

    python tests/make_board_sample.py
"""
import json
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
L, W, FPS, SECS = 105.0, 68.0, 10, 8

# (시작 x, y), (끝 x, y) — A는 오른쪽으로 공격하는 4-3-3 빌드업, B는 4-4-2 중간 블록
A = [((6, 34), (10, 34)), ((24, 58), (40, 62)), ((16, 44), (22, 50)), ((16, 24), (20, 18)), ((24, 10), (36, 7)),
     ((28, 34), (20, 34)), ((38, 46), (52, 45)), ((38, 22), (44, 26)), ((54, 60), (64, 63)), ((58, 34), (66, 38)), ((54, 8), (58, 12))]
B = [((99, 34), (99, 36)), ((66, 10), (67, 15)), ((68, 27), (69, 30)), ((68, 41), (68, 44)), ((66, 58), (65, 57)),
     ((50, 9), (50, 14)), ((52, 28), (52, 29)), ((52, 40), (50, 41)), ((50, 59), (46, 57)), ((30, 42), (32, 45)), ((31, 26), (33, 31))]

frames = []
for f in range(SECS * FPS + 1):
    p = f / (SECS * FPS)
    players = []
    for team, rows, base in (("A", A, 1), ("B", B, 101)):
        for i, ((x0, y0), (x1, y1)) in enumerate(rows):
            tid = base + i
            if team == "A" and i in (6, 9) and p > 0.55:   # 겹침 뒤 ID가 새로 붙는 상황
                tid += 50
            players.append({"id": tid, "team": team, "x": round(x0 + (x1 - x0) * p, 2), "y": round(y0 + (y1 - y0) * p, 2)})
    players.append({"id": 900, "team": "other", "x": 45.0, "y": 30.0})   # 심판
    bx, by = 8 + 34 * p, 36 + 25 * p
    frames.append({"frame": f, "t": round(f / FPS, 3), "players": players, "ball": {"x": round(bx, 2), "y": round(by, 2)} if f % 3 else None})

tracks = {"meta": {"video": "synthetic", "fps": FPS, "stride": 1, "camera_motion": False, "pitch": {"length": L, "width": W}},
          "teams": {"A": {"color_bgr": [60, 60, 210]}, "B": {"color_bgr": [214, 111, 47]}, "other": {"color_bgr": [40, 40, 40]}},
          "frames": frames}

with tempfile.TemporaryDirectory() as tmp:
    tp = pathlib.Path(tmp) / "tracks.json"
    tp.write_text(json.dumps(tracks), encoding="utf-8")
    out = ROOT / "samples" / "board_sample.json"
    subprocess.run([sys.executable, str(ROOT / "tracker" / "export_board.py"), str(tp), "--times", "0.2,2.8,5.2,7.9", "--out", str(out)], check=True)
    d = json.loads(out.read_text(encoding="utf-8"))
    d["meta"]["source"] = "synthetic (tests/make_board_sample.py)"
    out.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
