"""영상 한 프레임에서 피치 기준점을 클릭해 이미지 -> 피치 변환(호모그래피)을 만든다.

사용법:
    python calibrate.py 경기.mp4 --time 12.0 --out calib.json

조작:
    1) 'frame' 창에서 경기장 위 기준점(코너, 박스 모서리 등)을 클릭
    2) 'pitch' 창에서 같은 지점의 점을 클릭 (가장 가까운 기준점에 자동 스냅)
    3) 4쌍 이상이면 frame 창에 분홍색 라인이 겹쳐 보임 -> 실제 라인과 맞는지 확인
    u: 마지막 쌍 취소 / s 또는 Enter: 저장 / q 또는 Esc: 저장 없이 종료
"""
import argparse
import math

import cv2
import numpy as np

from geometry import fit_homography, project, save_calib
from pitch import DEFAULT_LENGTH, DEFAULT_WIDTH, PitchCanvas, landmarks, pitch_lines


def grab_frame(video, sec):
    cap = cv2.VideoCapture(video)
    if not cap.isOpened():
        raise SystemExit(f"영상을 열 수 없음: {video}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    idx = int(round(sec * fps))
    cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
    ok, frame = cap.read()
    cap.release()
    if not ok:
        raise SystemExit(f"{sec}초 프레임을 읽을 수 없음")
    return frame, idx, fps


def draw_overlay(img, H, L, W, scale):
    """피치 라인을 영상 위에 역투영해 그린다 (검증용)."""
    Hinv = np.linalg.inv(H)
    for line in pitch_lines(L, W):
        pts = project(Hinv, line) * scale
        if not np.all(np.isfinite(pts)):
            continue
        cv2.polylines(img, [pts.astype(np.int32)], False, (255, 0, 255), 2, cv2.LINE_AA)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--time", type=float, default=0.0, help="캘리브레이션할 프레임 시각(초)")
    ap.add_argument("--out", default="calib.json")
    ap.add_argument("--length", type=float, default=DEFAULT_LENGTH, help="경기장 길이(m)")
    ap.add_argument("--width", type=float, default=DEFAULT_WIDTH, help="경기장 폭(m)")
    ap.add_argument("--max-width", type=int, default=1280, help="frame 창 최대 가로 px")
    args = ap.parse_args()

    frame, idx, fps = grab_frame(args.video, args.time)
    L, W = args.length, args.width
    lm = landmarks(L, W)
    canvas = PitchCanvas(L, W, scale=7.0)
    disp = min(1.0, args.max_width / frame.shape[1])

    state = {"pending": None, "pairs": []}  # pairs: [(img_xy, landmark_name)]

    def on_frame(event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            state["pending"] = (x / disp, y / disp)

    def on_pitch(event, x, y, flags, param):
        if event != cv2.EVENT_LBUTTONDOWN:
            return
        if state["pending"] is None:
            print("먼저 frame 창에서 점을 클릭하세요.")
            return
        mx, my = canvas.to_m(x, y)
        name = min(lm, key=lambda k: math.hypot(lm[k][0] - mx, lm[k][1] - my))
        if math.hypot(lm[name][0] - mx, lm[name][1] - my) > 3.0:
            print("3m 안에 기준점이 없습니다. 점 위를 클릭하세요.")
            return
        state["pairs"] = [p for p in state["pairs"] if p[1] != name]
        state["pairs"].append((state["pending"], name))
        state["pending"] = None
        print(f"[{len(state['pairs'])}] {name} 추가")

    cv2.namedWindow("frame")
    cv2.namedWindow("pitch")
    cv2.setMouseCallback("frame", on_frame)
    cv2.setMouseCallback("pitch", on_pitch)

    H, err = None, None
    while True:
        f = cv2.resize(frame, None, fx=disp, fy=disp) if disp < 1 else frame.copy()
        p = canvas.base()
        for name, (x, y) in lm.items():
            cv2.circle(p, canvas.to_px(x, y), 3, (180, 180, 180), -1)

        pairs = state["pairs"]
        if len(pairs) >= 4:
            H, err = fit_homography([q[0] for q in pairs], [lm[q[1]] for q in pairs])
            if H is not None:
                draw_overlay(f, H, L, W, disp)
        for i, (ixy, name) in enumerate(pairs, 1):
            c = (int(ixy[0] * disp), int(ixy[1] * disp))
            cv2.circle(f, c, 5, (0, 0, 255), -1)
            cv2.putText(f, str(i), (c[0] + 6, c[1] - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
            pc = canvas.to_px(*lm[name])
            cv2.circle(p, pc, 5, (0, 0, 255), -1)
            cv2.putText(p, str(i), (pc[0] + 6, pc[1] - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
        if state["pending"] is not None:
            c = (int(state["pending"][0] * disp), int(state["pending"][1] * disp))
            cv2.circle(f, c, 6, (0, 255, 255), 2)
        msg = f"pairs={len(pairs)}" + (f"  err={err:.2f}m" if err is not None else "  (need 4+)")
        cv2.putText(f, msg, (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)

        cv2.imshow("frame", f)
        cv2.imshow("pitch", p)
        key = cv2.waitKey(30) & 0xFF
        if key == ord("u") and pairs:
            removed = pairs.pop()
            print(f"취소: {removed[1]}")
        elif key in (ord("s"), 13):
            if H is None:
                print("4쌍 이상 필요합니다.")
                continue
            save_calib(args.out, {
                "video": args.video,
                "frame_index": idx,
                "time_sec": idx / fps,
                "fps": fps,
                "pitch": {"length": L, "width": W},
                "H": H,
                "reproj_error_m": err,
                "points": [{"name": n, "img": list(map(float, ixy)), "pitch": list(lm[n])} for ixy, n in pairs],
            })
            preview = frame.copy()
            draw_overlay(preview, H, L, W, 1.0)
            cv2.imwrite(args.out.rsplit(".", 1)[0] + "_preview.jpg", preview)
            print(f"저장: {args.out} (평균 오차 {err:.2f} m)")
            break
        elif key in (ord("q"), 27):
            print("저장 없이 종료")
            break
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
