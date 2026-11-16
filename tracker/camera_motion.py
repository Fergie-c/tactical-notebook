"""(실험) 움직이는 카메라 보정.

캘리브레이션 프레임을 기준으로, 프레임마다 카메라가 얼마나 움직였는지 추정해
'현재 프레임 픽셀 -> 기준 프레임 픽셀' 변환 T 를 누적한다.
최종 투영: H_현재 = H_캘리브레이션 @ T

선수 박스는 특징점에서 빼고 배경(라인, 관중석, 광고판)만 쓴다.
오래 돌리면 오차가 누적되므로 짧은 구간(수십 초) 단위로 쓰는 것이 안전하다.
"""
import cv2
import numpy as np


class CameraMotion:
    def __init__(self, max_features=2000, downscale=0.5):
        self.orb = cv2.ORB_create(max_features)
        self.bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        self.ds = downscale
        self.prev = None
        self.T = np.eye(3)
        self.failures = 0

    def _features(self, frame, boxes):
        g = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        g = cv2.resize(g, None, fx=self.ds, fy=self.ds)
        mask = np.full(g.shape, 255, np.uint8)
        for x1, y1, x2, y2 in boxes:
            cv2.rectangle(mask, (int(x1 * self.ds) - 4, int(y1 * self.ds) - 4),
                          (int(x2 * self.ds) + 4, int(y2 * self.ds) + 4), 0, -1)
        kp, des = self.orb.detectAndCompute(g, mask)
        pts = np.float32([k.pt for k in kp]) / self.ds if kp else np.zeros((0, 2), np.float32)
        return pts, des

    def update(self, frame, person_boxes):
        pts, des = self._features(frame, person_boxes)
        if self.prev is not None:
            ppts, pdes = self.prev
            ok = False
            if des is not None and pdes is not None and len(des) >= 12 and len(pdes) >= 12:
                matches = self.bf.match(des, pdes)
                if len(matches) >= 12:
                    cur = np.float32([pts[m.queryIdx] for m in matches])
                    prv = np.float32([ppts[m.trainIdx] for m in matches])
                    M, inl = cv2.findHomography(cur, prv, cv2.RANSAC, 3.0)
                    if M is not None and inl is not None and inl.sum() >= 10:
                        self.T = self.T @ M
                        ok = True
            if not ok:
                self.failures += 1  # 추정 실패 시 직전 변환 유지
        self.prev = (pts, des)
        return self.T.copy()
