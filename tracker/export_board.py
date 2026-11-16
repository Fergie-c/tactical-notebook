"""tracks.json -> 전술 보드용 장면(scene) JSON.

사용법:
    python export_board.py out/tracks.json --every 2 --out board.json
    python export_board.py out/tracks.json --times 12.5,18,25 --out board.json

- 장면마다 팀별로 slot(A1, A2 ...)을 붙인다. 앞 장면과 가장 가까운 선수끼리 같은 slot이 되도록
  매칭(헝가리안)하므로, 트래커 ID가 중간에 바뀌어도 보드 애니메이션이 튀지 않는다.
- 좌표는 m(x, y)와 0~1 정규화(nx, ny)를 같이 넣는다. 보드 앱 좌표계에 맞게 골라 쓰면 된다.
"""
import argparse
import json

import numpy as np
from scipy.optimize import linear_sum_assignment


def pick_frames(frames, times):
    ts = np.array([f["t"] for f in frames])
    return [frames[int(np.argmin(np.abs(ts - t)))] for t in times]


def assign_slots(scenes, team, max_jump):
    """team 선수들에게 장면 간 일관된 slot 번호를 붙인다."""
    prev = {}  # slot -> (x, y)
    next_slot = 1
    for sc in scenes:
        players = [p for p in sc["players"] if p["team"] == team]
        if not players:
            continue
        cur = np.array([[p["x"], p["y"]] for p in players])
        assigned = {}
        if prev:
            slots = list(prev)
            P = np.array([prev[s] for s in slots])
            cost = np.linalg.norm(P[:, None, :] - cur[None, :, :], axis=2)
            r, c = linear_sum_assignment(cost)
            for i, j in zip(r, c):
                if cost[i, j] <= max_jump:
                    assigned[j] = slots[i]
        order = sorted(range(len(players)), key=lambda j: (players[j]["x"], players[j]["y"]))
        for j in order:
            if j not in assigned:
                assigned[j] = next_slot
                next_slot += 1
        prev = {}
        for j, p in enumerate(players):
            p["slot"] = f"{team}{assigned[j]}"
            prev[assigned[j]] = (p["x"], p["y"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("tracks")
    ap.add_argument("--out", default="board.json")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--every", type=float, default=2.0, help="n초 간격으로 장면 추출")
    g.add_argument("--times", type=str, help="쉼표로 구분한 시각(초) 목록")
    ap.add_argument("--rotate", action="store_true", help="피치 180도 회전 (공격 방향 맞추기)")
    ap.add_argument("--swap-teams", action="store_true", help="A/B 팀 라벨 교체")
    ap.add_argument("--include-other", action="store_true", help="심판·GK 등 'other' 포함")
    ap.add_argument("--max-jump", type=float, default=12.0, help="장면 간 같은 선수로 볼 최대 이동(m)")
    args = ap.parse_args()

    with open(args.tracks, encoding="utf-8") as f:
        data = json.load(f)
    frames = data["frames"]
    if not frames:
        raise SystemExit("프레임 없음")
    L, W = data["meta"]["pitch"]["length"], data["meta"]["pitch"]["width"]

    if args.times:
        times = [float(t) for t in args.times.split(",")]
    else:
        times = list(np.arange(frames[0]["t"], frames[-1]["t"] + 1e-6, args.every))

    def tf(x, y):
        return (L - x, W - y) if args.rotate else (x, y)

    swap = {"A": "B", "B": "A", "other": "other"}
    scenes = []
    for t, fr in zip(times, pick_frames(frames, times)):
        players = []
        for p in fr["players"]:
            team = swap[p["team"]] if args.swap_teams else p["team"]
            if team == "other" and not args.include_other:
                continue
            x, y = tf(p["x"], p["y"])
            players.append({"team": team, "track_id": p["id"], "x": round(x, 2), "y": round(y, 2),
                            "nx": round(min(max(x / L, 0), 1), 4), "ny": round(min(max(y / W, 0), 1), 4)})
        ball = None
        if fr["ball"]:
            bx, by = tf(fr["ball"]["x"], fr["ball"]["y"])
            ball = {"x": round(bx, 2), "y": round(by, 2), "nx": round(bx / L, 4), "ny": round(by / W, 4)}
        scenes.append({"time": round(fr["t"], 2), "label": f"{int(fr['t'] // 60):02d}:{fr['t'] % 60:04.1f}",
                       "players": players, "ball": ball})

    for team in ("A", "B", "other"):
        assign_slots(scenes, team, args.max_jump)

    teams = data["teams"]
    if args.swap_teams:
        teams = {swap[k]: v for k, v in teams.items()}
    out = {"meta": {"source": args.tracks, "pitch": {"length": L, "width": W},
                    "coords": "x,y=m(원점 왼쪽 위), nx,ny=0~1"},
           "teams": teams, "scenes": scenes}
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"저장: {args.out} ({len(scenes)} 장면)")


if __name__ == "__main__":
    main()
