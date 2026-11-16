"""영상 -> 선수 탐지·추적·팀 구분 -> 피치 좌표(m) -> tracks.json + 확인용 영상.

사용법:
    python track.py 경기.mp4 --calib calib.json --start 0 --end 60 --out-dir out
    (카메라가 움직이면 --camera-motion 추가. 이때 시작점은 캘리브레이션 프레임으로 고정됨)

출력 (out-dir):
    tracks.json   프레임별 선수 위치(m), 팀, 공 위치
    tracked.mp4   원본 + 박스·ID + 우하단 미니맵
    minimap.mp4   2D 보드 화면만
"""
import argparse
import json
import os
from collections import defaultdict

import cv2
import numpy as np

from camera_motion import CameraMotion
from geometry import load_calib, project
from pitch import PitchCanvas
from teams import classify_tracks, lab_to_bgr, torso_color

PERSON, BALL = 0, 32  # COCO 클래스: person, sports ball
TEAM_NAMES = {0: "A", 1: "B", -1: "other"}
FALLBACK_COLORS = {"A": (40, 40, 230), "B": (230, 120, 30), "other": (0, 220, 255)}


def parse_args():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--calib", required=True)
    ap.add_argument("--out-dir", default="out")
    ap.add_argument("--model", default="yolo11n.pt", help="정확도 우선이면 yolo11s.pt / yolo11m.pt")
    ap.add_argument("--start", type=float, default=0.0, help="시작(초)")
    ap.add_argument("--end", type=float, default=None, help="끝(초)")
    ap.add_argument("--stride", type=int, default=1, help="n 프레임마다 처리 (속도↑, 추적 안정성↓)")
    ap.add_argument("--imgsz", type=int, default=1280, help="멀리 있는 선수가 작으면 크게")
    ap.add_argument("--person-conf", type=float, default=0.3)
    ap.add_argument("--min-conf", type=float, default=0.1, help="공 탐지용 최저 신뢰도")
    ap.add_argument("--tracker", default="bytetrack.yaml")
    ap.add_argument("--device", default=None, help="cpu / 0(GPU) / mps(맥)")
    ap.add_argument("--margin", type=float, default=2.0, help="피치 밖 허용 범위(m). 밖은 관중·벤치로 보고 제외")
    ap.add_argument("--min-track-len", type=int, default=10, help="이보다 짧은 트랙은 노이즈로 제거")
    ap.add_argument("--smooth", type=int, default=5, help="위치 이동평균 창 크기(홀수, 1=끔)")
    ap.add_argument("--camera-motion", action="store_true", help="(실험) 움직이는 카메라 보정")
    ap.add_argument("--no-video", action="store_true", help="확인용 영상 생략")
    return ap.parse_args()


def iter_frames(video, start_idx, end_idx, stride):
    cap = cv2.VideoCapture(video)
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_idx)
    idx = start_idx
    while end_idx is None or idx <= end_idx:
        ok, frame = cap.read()
        if not ok:
            break
        if (idx - start_idx) % stride == 0:
            yield idx, frame
        idx += 1
    cap.release()


def smooth_tracks(records, window):
    if window <= 1:
        return
    series = defaultdict(list)  # tid -> [(rec_i, player_dict)]
    for i, rec in enumerate(records):
        for p in rec["players"]:
            series[p["id"]].append((i, p))
    half = window // 2
    for items in series.values():
        xy = np.array([[p["x"], p["y"]] for _, p in items])
        for k, (_, p) in enumerate(items):
            seg = xy[max(0, k - half): k + half + 1]
            p["x"], p["y"] = float(seg[:, 0].mean()), float(seg[:, 1].mean())


def draw_minimap(canvas, rec, colors):
    img = canvas.base()
    for p in rec["players"]:
        c = canvas.to_px(p["x"], p["y"])
        cv2.circle(img, c, 7, colors[p["team"]], -1, cv2.LINE_AA)
        cv2.circle(img, c, 7, (255, 255, 255), 1, cv2.LINE_AA)
        cv2.putText(img, str(p["id"]), (c[0] + 8, c[1] - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
    if rec["ball"]:
        cv2.circle(img, canvas.to_px(rec["ball"]["x"], rec["ball"]["y"]), 4, (255, 255, 255), -1)
    return img


def main():
    args = parse_args()
    from ultralytics import YOLO  # 무거운 import 는 인자 확인 뒤에

    os.makedirs(args.out_dir, exist_ok=True)
    calib = load_calib(args.calib)
    H0 = calib["H"]
    L, W = calib["pitch"]["length"], calib["pitch"]["width"]

    cap = cv2.VideoCapture(args.video)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    vw, vh = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()

    start_idx = int(round(args.start * fps))
    end_idx = int(round(args.end * fps)) if args.end is not None else None
    cam = None
    if args.camera_motion:
        cam = CameraMotion()
        if start_idx != calib["frame_index"]:
            print(f"--camera-motion: 시작점을 캘리브레이션 프레임({calib['time_sec']:.2f}s)으로 맞춤")
            start_idx = calib["frame_index"]

    model = YOLO(args.model)
    records = []
    colors = defaultdict(list)
    track_len = defaultdict(int)

    # 1차: 탐지·추적·투영
    for n, (idx, frame) in enumerate(iter_frames(args.video, start_idx, end_idx, args.stride)):
        res = model.track(frame, persist=True, tracker=args.tracker, classes=[PERSON, BALL],
                          conf=args.min_conf, imgsz=args.imgsz, device=args.device, verbose=False)[0]
        b = res.boxes
        xyxy = b.xyxy.cpu().numpy() if len(b) else np.zeros((0, 4))
        cls = b.cls.cpu().numpy().astype(int) if len(b) else np.zeros(0, int)
        conf = b.conf.cpu().numpy() if len(b) else np.zeros(0)
        ids = b.id.cpu().numpy().astype(int) if (len(b) and b.id is not None) else np.full(len(xyxy), -1)

        persons = np.where((cls == PERSON) & (conf >= args.person_conf) & (ids >= 0))[0]
        H = H0 @ cam.update(frame, xyxy[cls == PERSON]) if cam else H0

        rec = {"frame": int(idx), "t": round(idx / fps, 3), "players": [], "ball": None}
        if len(persons):
            feet = np.stack([(xyxy[persons, 0] + xyxy[persons, 2]) / 2, xyxy[persons, 3]], axis=1)
            for i, (x, y) in zip(persons, project(H, feet)):
                if not (-args.margin <= x <= L + args.margin and -args.margin <= y <= W + args.margin):
                    continue
                tid = int(ids[i])
                track_len[tid] += 1
                rec["players"].append({"id": tid, "x": float(x), "y": float(y),
                                       "box": [round(float(v), 1) for v in xyxy[i]]})
                if len(colors[tid]) < 30:
                    c = torso_color(frame, xyxy[i])
                    if c is not None:
                        colors[tid].append(c)
        balls = np.where(cls == BALL)[0]
        if len(balls):
            j = balls[np.argmax(conf[balls])]
            bx, by = project(H, [[(xyxy[j, 0] + xyxy[j, 2]) / 2, xyxy[j, 3]]])[0]
            if -args.margin <= bx <= L + args.margin and -args.margin <= by <= W + args.margin:
                rec["ball"] = {"x": float(bx), "y": float(by), "box": [round(float(v), 1) for v in xyxy[j]]}
        records.append(rec)
        if n % 50 == 0:
            print(f"{idx / fps:7.1f}s  선수 {len(rec['players'])}명")

    # 짧은 트랙 제거
    for rec in records:
        rec["players"] = [p for p in rec["players"] if track_len[p["id"]] >= args.min_track_len]

    # 2차: 팀 구분
    track_colors = {tid: np.median(np.array(c), axis=0) for tid, c in colors.items()
                    if len(c) >= 3 and track_len[tid] >= args.min_track_len}
    labels, centers = classify_tracks(track_colors)
    team_colors = dict(FALLBACK_COLORS)
    for k, center in enumerate(centers):
        team_colors[TEAM_NAMES[k]] = tuple(lab_to_bgr(center))
    for rec in records:
        for p in rec["players"]:
            p["team"] = TEAM_NAMES[labels.get(p["id"], -1)]

    smooth_tracks(records, args.smooth)
    for rec in records:
        for p in rec["players"]:
            p["x"], p["y"] = round(p["x"], 2), round(p["y"], 2)

    out = {
        "meta": {"video": args.video, "fps": fps, "stride": args.stride, "camera_motion": bool(cam),
                 "camera_motion_failures": cam.failures if cam else 0,
                 "pitch": {"length": L, "width": W},
                 "coords": "m, 원점=왼쪽 위 코너, x=길이 방향, y=폭 방향"},
        "teams": {k: {"color_bgr": list(v)} for k, v in team_colors.items()},
        "frames": records,
    }
    json_path = os.path.join(args.out_dir, "tracks.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    print(f"저장: {json_path}  ({len(records)} 프레임, 트랙 {len(track_colors)}개)")
    if cam and cam.failures:
        print(f"주의: 카메라 움직임 추정 실패 {cam.failures}회 — 해당 구간 좌표 신뢰도 낮음")

    if args.no_video:
        return

    # 3차: 확인용 영상
    canvas = PitchCanvas(L, W, scale=8.0)
    out_fps = fps / args.stride
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    w_tr = cv2.VideoWriter(os.path.join(args.out_dir, "tracked.mp4"), fourcc, out_fps, (vw, vh))
    w_mm = cv2.VideoWriter(os.path.join(args.out_dir, "minimap.mp4"), fourcc, out_fps, (canvas.w, canvas.h))
    by_frame = {r["frame"]: r for r in records}
    for idx, frame in iter_frames(args.video, start_idx, end_idx, args.stride):
        rec = by_frame.get(idx)
        if rec is None:
            continue
        for p in rec["players"]:
            x1, y1, x2, y2 = map(int, p["box"])
            c = team_colors[p["team"]]
            label = f"{p['team']}{p['id']}"
            text_c = (0, 0, 0) if sum(c) > 380 else (255, 255, 255)  # 어두운 유니폼은 흰 글씨
            cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 255, 255), 4)
            cv2.rectangle(frame, (x1, y1), (x2, y2), c, 2)
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(frame, (x1, y1 - th - 8), (x1 + tw + 6, y1), c, -1)
            cv2.putText(frame, label, (x1 + 3, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, text_c, 1, cv2.LINE_AA)
        if rec["ball"]:
            x1, y1, x2, y2 = map(int, rec["ball"]["box"])
            cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 255, 255), 2)
        mm = draw_minimap(canvas, rec, team_colors)
        w_mm.write(mm)
        mw = int(vw * 0.35)
        small = cv2.resize(mm, (mw, int(mw * canvas.h / canvas.w)))
        frame[vh - small.shape[0] - 10: vh - 10, vw - mw - 10: vw - 10] = small
        w_tr.write(frame)
    w_tr.release()
    w_mm.release()
    print(f"영상 저장: {args.out_dir}/tracked.mp4, minimap.mp4")


if __name__ == "__main__":
    main()
