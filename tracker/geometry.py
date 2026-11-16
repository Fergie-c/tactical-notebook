"""호모그래피 투영과 캘리브레이션 파일 입출력."""
import json
import numpy as np
import cv2


def project(H, pts):
    """이미지 픽셀 점들 -> 피치 좌표(m). pts: (N, 2)"""
    pts = np.asarray(pts, dtype=np.float64).reshape(-1, 1, 2)
    if len(pts) == 0:
        return np.zeros((0, 2))
    return cv2.perspectiveTransform(pts, np.asarray(H, dtype=np.float64)).reshape(-1, 2)


def fit_homography(img_pts, pitch_pts):
    """4점 이상으로 이미지 -> 피치 호모그래피 추정. (H, 평균 재투영 오차 m) 반환."""
    img_pts = np.asarray(img_pts, np.float64)
    pitch_pts = np.asarray(pitch_pts, np.float64)
    if len(img_pts) < 4:
        return None, None
    method = cv2.RANSAC if len(img_pts) >= 6 else 0
    H, _ = cv2.findHomography(img_pts, pitch_pts, method, 1.5)
    if H is None:
        return None, None
    err = float(np.mean(np.linalg.norm(project(H, img_pts) - pitch_pts, axis=1)))
    return H, err


def save_calib(path, data):
    out = dict(data)
    out["H"] = np.asarray(out["H"]).tolist()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)


def load_calib(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    data["H"] = np.asarray(data["H"], dtype=np.float64)
    return data
