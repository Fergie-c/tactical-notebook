"""유니폼 색으로 팀 구분."""
import cv2
import numpy as np
from sklearn.cluster import KMeans


def torso_color(frame, box):
    """박스 상체 부분의 대표 색(Lab, 잔디색 제외). 너무 작으면 None."""
    x1, y1, x2, y2 = box
    w, h = x2 - x1, y2 - y1
    if h < 20 or w < 8:
        return None
    xa, xb = int(max(x1 + 0.25 * w, 0)), int(x2 - 0.25 * w)
    ya, yb = int(max(y1 + 0.15 * h, 0)), int(y1 + 0.5 * h)
    crop = frame[ya:yb, xa:xb]
    if crop.size == 0:
        return None
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    keep = cv2.inRange(hsv, (35, 40, 40), (85, 255, 255)) == 0
    if keep.sum() < 10:
        return None
    lab = cv2.cvtColor(crop, cv2.COLOR_BGR2LAB)[keep]
    return np.median(lab, axis=0).astype(np.float64)


def lab_to_bgr(lab):
    px = np.clip(np.asarray(lab), 0, 255).astype(np.uint8).reshape(1, 1, 3)
    return [int(v) for v in cv2.cvtColor(px, cv2.COLOR_LAB2BGR)[0, 0]]


def classify_tracks(track_colors, outlier_factor=2.5):
    """track_id -> 대표색 dict 를 받아 track_id -> 0/1/-1(기타: 심판·GK 등) 반환.

    두 팀으로 K-means, 군집 중심에서 너무 먼 트랙은 -1.
    """
    ids = list(track_colors)
    if not ids:
        return {}, []
    X = np.array([track_colors[i] for i in ids])
    if len(X) < 2:
        return {ids[0]: 0}, [X[0]]
    km = KMeans(n_clusters=2, n_init=10, random_state=0).fit(X)
    d = np.linalg.norm(X - km.cluster_centers_[km.labels_], axis=1)
    thr = np.median(d) * outlier_factor + 1e-6
    labels = {tid: (int(km.labels_[i]) if d[i] <= thr else -1) for i, tid in enumerate(ids)}
    return labels, km.cluster_centers_
