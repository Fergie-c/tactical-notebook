"""피치 좌표계, 랜드마크, 2D 보드 캔버스.

좌표 단위: m
원점: 왼쪽 위 코너. x = 길이 방향(0~L), y = 폭 방향(0~W)
"""
import numpy as np
import cv2

DEFAULT_LENGTH = 105.0
DEFAULT_WIDTH = 68.0

PENALTY_DEPTH = 16.5
PENALTY_WIDTH = 40.32
GOAL_AREA_DEPTH = 5.5
GOAL_AREA_WIDTH = 18.32
PENALTY_SPOT = 11.0
CIRCLE_R = 9.15


def landmarks(L=DEFAULT_LENGTH, W=DEFAULT_WIDTH):
    """캘리브레이션에 쓰는 기준점. 이름 -> (x, y) m."""
    cy = W / 2
    d_off = float(np.sqrt(CIRCLE_R**2 - (PENALTY_DEPTH - PENALTY_SPOT) ** 2))
    pts = {
        "corner_TL": (0.0, 0.0),
        "corner_BL": (0.0, W),
        "corner_TR": (L, 0.0),
        "corner_BR": (L, W),
        "halfway_T": (L / 2, 0.0),
        "halfway_B": (L / 2, W),
        "center_mark": (L / 2, cy),
        "circle_T": (L / 2, cy - CIRCLE_R),
        "circle_B": (L / 2, cy + CIRCLE_R),
        "circle_L": (L / 2 - CIRCLE_R, cy),
        "circle_R": (L / 2 + CIRCLE_R, cy),
    }
    for side, x0, s in (("L", 0.0, 1.0), ("R", L, -1.0)):
        pb1, pb2 = cy - PENALTY_WIDTH / 2, cy + PENALTY_WIDTH / 2
        ga1, ga2 = cy - GOAL_AREA_WIDTH / 2, cy + GOAL_AREA_WIDTH / 2
        pts.update({
            f"{side}_box_goal_T": (x0, pb1),
            f"{side}_box_goal_B": (x0, pb2),
            f"{side}_box_front_T": (x0 + s * PENALTY_DEPTH, pb1),
            f"{side}_box_front_B": (x0 + s * PENALTY_DEPTH, pb2),
            f"{side}_6yd_goal_T": (x0, ga1),
            f"{side}_6yd_goal_B": (x0, ga2),
            f"{side}_6yd_front_T": (x0 + s * GOAL_AREA_DEPTH, ga1),
            f"{side}_6yd_front_B": (x0 + s * GOAL_AREA_DEPTH, ga2),
            f"{side}_pk_spot": (x0 + s * PENALTY_SPOT, cy),
            f"{side}_D_T": (x0 + s * PENALTY_DEPTH, cy - d_off),
            f"{side}_D_B": (x0 + s * PENALTY_DEPTH, cy + d_off),
            f"{side}_D_tip": (x0 + s * (PENALTY_SPOT + CIRCLE_R), cy),
        })
    return pts


def pitch_lines(L=DEFAULT_LENGTH, W=DEFAULT_WIDTH, n=48):
    """피치 라인을 폴리라인 목록(m)으로 반환."""
    cy = W / 2
    lines = [
        [(0, 0), (L, 0), (L, W), (0, W), (0, 0)],
        [(L / 2, 0), (L / 2, W)],
    ]
    t = np.linspace(0, 2 * np.pi, n * 2)
    lines.append(list(zip(L / 2 + CIRCLE_R * np.cos(t), cy + CIRCLE_R * np.sin(t))))
    for x0, s in ((0.0, 1.0), (L, -1.0)):
        for depth, width in ((PENALTY_DEPTH, PENALTY_WIDTH), (GOAL_AREA_DEPTH, GOAL_AREA_WIDTH)):
            y1, y2 = cy - width / 2, cy + width / 2
            lines.append([(x0, y1), (x0 + s * depth, y1), (x0 + s * depth, y2), (x0, y2)])
        half = np.arccos((PENALTY_DEPTH - PENALTY_SPOT) / CIRCLE_R)
        a = np.linspace(-half, half, n)
        cx = x0 + s * PENALTY_SPOT
        lines.append(list(zip(cx + s * CIRCLE_R * np.cos(a), cy + CIRCLE_R * np.sin(a))))
    return lines


class PitchCanvas:
    """m 좌표 <-> 픽셀 변환과 2D 보드 그리기."""

    def __init__(self, L=DEFAULT_LENGTH, W=DEFAULT_WIDTH, scale=8.0, margin=4.0):
        self.L, self.W, self.s, self.m = L, W, scale, margin
        self.w = int(round((L + 2 * margin) * scale))
        self.h = int(round((W + 2 * margin) * scale))
        self._base = None

    def to_px(self, x, y):
        return int(round((x + self.m) * self.s)), int(round((y + self.m) * self.s))

    def to_m(self, px, py):
        return px / self.s - self.m, py / self.s - self.m

    def base(self):
        if self._base is None:
            img = np.full((self.h, self.w, 3), (55, 120, 50), np.uint8)
            for line in pitch_lines(self.L, self.W):
                pts = np.array([self.to_px(x, y) for x, y in line], np.int32)
                cv2.polylines(img, [pts], False, (235, 235, 235), 1, cv2.LINE_AA)
            self._base = img
        return self._base.copy()
