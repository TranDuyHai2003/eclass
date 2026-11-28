#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bộ render nhạc nền + stinger cho Thế giới Toán 3D — OFFLINE, numpy / scipy, không sample, không soundfont.
Mọi giai điệu là sáng tác mới (chỉ học nguyên tắc: hợp xướng không lời, organ, hộp nhạc, harpsichord, điệu thức,
cadence plagal) — xem docs/ai-reviews/audio/PLAN.md, RESEARCH_CODEX.md.

Chạy (từ gốc repo):
  python scripts/audio-render.py                 # render tất cả, mã hoá Opus + AAC, ghi manifest TS, bản nghe thử
  python scripts/audio-render.py siren hubDay    # chỉ vài bản (manifest vẫn ghi đủ nếu đã có JSON tạm của bản khác)
  python scripts/audio-render.py --no-encode     # chỉ WAV

Đầu ra:
  blender-src/audio-src/wav/*.wav            (trung gian, gitignore)
  blender-src/audio-src/meta/*.json          (siêu dữ liệu từng bản — để ghi manifest khi render lẻ)
  blender-src/audio-src/preview/*_demo.ogg   (bản nghe thử ~1 phút: mô phỏng bộ ghép câu lúc chạy)
  public/world/audio/<id>_<stem>.ogg|.m4a    (Opus 32 kbps / AAC 48 kbps)
  lib/world/musicTracks.ts                   (manifest sinh tự động)
"""
import json
import math
import os
import subprocess
import sys
import time

import numpy as np
from scipy import signal as ss
from scipy.ndimage import maximum_filter1d

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "blender-src", "audio-src")
WAV_DIR = os.path.join(SRC, "wav")
META_DIR = os.path.join(SRC, "meta")
DEMO_DIR = os.path.join(SRC, "preview")
PUB_DIR = os.path.join(ROOT, "public", "world", "audio")
TS_OUT = os.path.join(ROOT, "lib", "world", "musicTracks.ts")
OPUS_KBPS = 32
AAC_KBPS = 48
TARGET_LUFS = -20.0

# ───────────────────────────── cao độ ─────────────────────────────

_PC = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def m(s):
    """'C#4' → 61"""
    p = _PC[s[0]]
    i = 1
    while i < len(s) and s[i] in "#b":
        p += 1 if s[i] == "#" else -1
        i += 1
    return 12 * (int(s[i:]) + 1) + p


def hz(x):
    return 440.0 * 2 ** ((x - 69) / 12)


def ch(s):
    """'D3 A3 F#4 A4' → [50, 57, 66, 69] (thứ tự B-T-A-S)"""
    return [m(x) for x in s.split()]


def mel(s, beats_per_bar):
    """'F#5:2 A5:1 | E5:1.5 r:.5 ...' → [(beat, len, midi|None)]; kiểm tra tổng phách mỗi ô nhịp"""
    out = []
    b = 0.0
    for bar in s.split("|"):
        tot = 0.0
        for tok in bar.split():
            n, d = tok.split(":")
            d = float(d)
            out.append((b, d, None if n == "r" else m(n)))
            b += d
            tot += d
        assert abs(tot - beats_per_bar) < 1e-6, f"ô nhịp sai số phách ({tot} ≠ {beats_per_bar}): {bar}"
    return out


# ───────────────────────────── tiện ích tín hiệu ─────────────────────────────


def env_ar(n, att, hold, rel):
    """tấn công cos nâng → giữ → nhả cos (đơn vị giây), dài n mẫu"""
    e = np.zeros(n)
    a = max(1, int(att * SR))
    h = max(0, int(hold * SR))
    r = max(1, int(rel * SR))
    ia = min(a, n)
    e[:ia] = 0.5 - 0.5 * np.cos(np.pi * np.arange(ia) / a)
    ih = min(a + h, n)
    e[ia:ih] = 1.0
    ir = min(a + h + r, n)
    if ir > ih:
        lvl = e[ih - 1] if ih > 0 else 1.0
        e[ih:ir] = lvl * (0.5 + 0.5 * np.cos(np.pi * np.arange(ir - ih) / r))
    return e


def drift(n, rate, rng, amount):
    """nhiễu trơn (nội suy cos) tốc độ ~rate Hz, biên độ ~amount"""
    k = max(3, int(n / SR * rate) + 3)
    pts = rng.standard_normal(k)
    x = np.linspace(0, k - 1.0001, n)
    i = x.astype(int)
    f = x - i
    w = 0.5 - 0.5 * np.cos(np.pi * f)
    return (pts[i] * (1 - w) + pts[i + 1] * w) * amount


def pan(sig, p):
    """mono → stereo, pan công suất không đổi p ∈ [−1, 1]"""
    a = (np.clip(p, -1, 1) + 1) * np.pi / 4
    return np.stack([sig * np.cos(a), sig * np.sin(a)], axis=1)


def bandnoise(n, lo, hi, rng):
    sos = ss.butter(2, [lo / (SR / 2), min(hi, SR / 2 - 100) / (SR / 2)], btype="band", output="sos")
    return ss.sosfilt(sos, rng.standard_normal(n))


def lowpass(x, f, order=2):
    sos = ss.butter(order, f / (SR / 2), output="sos")
    return ss.sosfilt(sos, x, axis=0)


def highpass(x, f, order=2):
    sos = ss.butter(order, f / (SR / 2), btype="high", output="sos")
    return ss.sosfilt(sos, x, axis=0)


def additive(f0, n, amps, rng, cents=None, amps_end=None):
    """Cộng hoạ âm k·f(t) (k = 1…K) với biên độ amps (tĩnh) hoặc nội suy tới amps_end (đổi nguyên âm)."""
    f = np.full(n, f0) if cents is None else f0 * 2 ** (cents / 1200)
    ph = 2 * np.pi * np.cumsum(f) / SR
    out = np.zeros(n)
    w = np.linspace(0, 1, n) if amps_end is not None else None
    for k in range(1, len(amps) + 1):
        a0 = amps[k - 1]
        a1 = amps_end[k - 1] if amps_end is not None else a0
        if max(a0, a1) < 2e-4:
            continue
        s = np.sin(k * ph + rng.uniform(0, 2 * np.pi))
        out += s * (a0 if w is None else a0 + (a1 - a0) * w)
    return out


def unit(a):
    return a / max(1e-9, float(np.sqrt(np.sum(a * a))))


# ───────────────────────────── hợp xướng formant ─────────────────────────────

# (F Hz, băng thông Hz, dB) — bảng formant Csound (S/A/T/B × a/o/u/e); F4–F5 bổ sung
FORM = {
    "S": {
        "a": [(800, 80, 0), (1150, 90, -6), (2900, 120, -32), (3900, 130, -20), (4950, 140, -50)],
        "o": [(450, 40, 0), (800, 80, -11), (2830, 100, -22), (3800, 130, -22), (4950, 135, -50)],
        "u": [(325, 50, 0), (700, 60, -16), (2700, 170, -35), (3800, 180, -40), (4950, 200, -60)],
        "e": [(350, 60, 0), (2000, 100, -20), (2800, 120, -15), (3600, 150, -40), (4950, 200, -56)],
    },
    "A": {
        "a": [(800, 80, 0), (1150, 90, -4), (2800, 120, -20), (3500, 130, -36), (4950, 140, -60)],
        "o": [(450, 70, 0), (800, 80, -9), (2830, 100, -16), (3500, 130, -28), (4950, 135, -55)],
        "u": [(325, 50, 0), (700, 60, -12), (2530, 170, -30), (3500, 180, -40), (4950, 200, -64)],
        "e": [(400, 60, 0), (1600, 80, -24), (2700, 120, -30), (3300, 150, -35), (4950, 200, -60)],
    },
    "T": {
        "a": [(650, 80, 0), (1080, 90, -6), (2650, 120, -7), (2900, 130, -8), (3250, 140, -22)],
        "o": [(400, 70, 0), (800, 80, -10), (2600, 100, -12), (2800, 130, -12), (3000, 135, -26)],
        "u": [(350, 40, 0), (600, 60, -20), (2700, 100, -17), (2900, 120, -14), (3300, 120, -26)],
        "e": [(400, 70, 0), (1700, 80, -14), (2600, 100, -12), (3200, 120, -14), (3580, 120, -20)],
    },
    "B": {
        "a": [(600, 60, 0), (1040, 70, -7), (2250, 110, -9), (2450, 120, -9), (2750, 130, -20)],
        "o": [(400, 40, 0), (750, 80, -11), (2400, 100, -21), (2600, 120, -20), (2900, 120, -40)],
        "u": [(350, 40, 0), (600, 80, -20), (2400, 100, -32), (2675, 120, -28), (2950, 120, -36)],
        "e": [(400, 40, 0), (1620, 80, -12), (2400, 100, -9), (2800, 120, -12), (3100, 120, -18)],
    },
}
PART_PAN = {"S": -0.32, "A": 0.3, "T": -0.18, "B": 0.16}


def part_of(midi):
    return "B" if midi < 53 else "T" if midi < 60 else "A" if midi < 67 else "S"


def formant_amps(f0, part, vowel, fmax):
    K = max(1, int(fmax / (f0 * 1.01)))
    k = np.arange(1, K + 1)
    fs = f0 * k
    s = np.full(K, 0.02)
    for i, (F, BW, g) in enumerate(FORM[part][vowel]):
        if part == "S" and i == 0:
            F = max(F, 1.02 * f0)
        # hát (không phải nói): băng thông rộng hơn bảng ~1,7× → bớt "huýt", đều nốt
        s += 10 ** (g / 20) / np.sqrt(1 + (2 * (fs - F) / (BW * 1.7)) ** 2)
    return unit(k ** -1.2 * s)


def choir(midi, dur, rng, vel=0.5, vowels=("u", "o"), singers=3, att=0.35, rel=0.8, vib=9.0, breath=1.0, pan0=None, part=None):
    """Một bè hợp xướng (3 ca sĩ lệch −5 / 0 / +5 cent, vào lệch 0–35 ms, vibrato 4,7–5,8 Hz trễ 0,25–0,5 s, trôi 0,6 Hz)"""
    part = part or part_of(midi)
    f0 = hz(midi)
    fmax = 7000 if part in "SA" else 5200
    A0 = formant_amps(f0, part, vowels[0], fmax)
    A1 = formant_amps(f0, part, vowels[-1], fmax)
    n = int((dur + rel) * SR)
    out = np.zeros((n, 2))
    p0 = PART_PAN[part] if pan0 is None else pan0
    for s in range(singers):
        det = (-5, 0, 5, -2.5, 2.5)[s % 5] + rng.normal(0, 1.2)
        i0 = int(rng.uniform(0, 0.035) * SR)
        ns = n - i0
        t = np.arange(ns) / SR
        vd = rng.uniform(0.25, 0.5)
        vibenv = np.clip((t - vd) / 0.3, 0, 1)
        cents = det + vib * vibenv * np.sin(2 * np.pi * rng.uniform(4.7, 5.8) * t + rng.uniform(0, 6.28)) + drift(ns, 0.6, rng, 2.0)
        sig = additive(f0, ns, A0, rng, cents, A1)
        e = env_ar(ns, att * rng.uniform(0.85, 1.2), max(0.0, dur - i0 / SR - att), rel)
        e *= 10 ** (drift(ns, 0.4, rng, 0.5) / 20)
        out[i0:] += pan(sig * e * vel * 0.2 / math.sqrt(singers), p0 + rng.uniform(-0.3, 0.3))
    if breath > 0:
        tab = FORM[part][vowels[0]][:3]
        nz = sum(bandnoise(n, max(80, F - BW), F + BW, rng) * 10 ** (g / 20) for F, BW, g in tab)
        nz = unit(nz) * math.sqrt(n)
        be = env_ar(n, 0.05, 0.3, 0.5) * 0.7 + env_ar(n, att, max(0.0, dur - att), rel) * 0.3
        out += pan(nz * be * vel * 0.2 * 0.025 * breath, p0)
    return out


# ───────────────────────────── dây / organ / harmonium / sáo ─────────────────────────────


def _peaks(fs, peaks):
    return sum(g / np.sqrt(1 + (2 * (fs - F) / BW) ** 2) for F, BW, g in peaks)


def strings(midi, dur, rng, vel=0.5, voices=3, att=0.18, rel=0.5, vib=8.0, bright=1.0, pan0=0.0, width=0.5, bow=1.0):
    f0 = hz(midi)
    K = max(1, int(min(7500 * bright, 9000) / f0))
    k = np.arange(1, K + 1)
    fs = f0 * k
    body = 0.25 + _peaks(fs, [(280, 160, 1.0), (520, 240, 0.5), (1050, 380, 0.7), (2600, 900, 0.45)])
    A = unit(k ** -1.0 * body / (1 + (fs / (4200 * bright)) ** 4))
    n = int((dur + rel) * SR)
    out = np.zeros((n, 2))
    for v in range(voices):
        det = (-4, 0, 4, -7, 7)[v % 5] + rng.normal(0, 1)
        i0 = int(rng.uniform(0, 0.02) * SR)
        ns = n - i0
        t = np.arange(ns) / SR
        vibenv = np.clip((t - 0.25) / 0.35, 0, 1)
        cents = det + vib * vibenv * np.sin(2 * np.pi * rng.uniform(4.8, 5.6) * t + rng.uniform(0, 6.28)) + drift(ns, 0.5, rng, 1.5)
        sig = additive(f0, ns, A, rng, cents)
        e = env_ar(ns, att * rng.uniform(0.85, 1.15), max(0.0, dur - i0 / SR - att), rel)
        out[i0:] += pan(sig * e * vel * 0.22 / math.sqrt(voices), pan0 + rng.uniform(-width, width))
    if bow > 0:
        nz = unit(bandnoise(n, 700, 3000, rng)) * math.sqrt(n)
        out += pan(nz * env_ar(n, att, max(0.0, dur - att), rel * 0.6) * vel * 0.22 * 0.022 * bow, pan0)
    return out


def organ(midi, dur, rng, vel=0.5, pedal=False, att=0.06, rel=0.3, flute=False, pan0=0.0):
    """Ống 8′ + 4′ + 2⅔′ + 2′ (+16′ ở pedal), chiff 1–3 kHz, gió 200–900 Hz; hai hàng ống lệch 1,5 cent"""
    f0 = hz(midi)
    if flute:
        ranks = {1: 0, 2: -14, 3: -30, 4: -34}
    else:
        ranks = {1: 0, 2: -12, 3: -23, 4: -27, 5: -34, 6: -36, 8: -40}
    K = max(ranks)
    A = np.zeros(K)
    for kk, g in ranks.items():
        if f0 * kk < 12000:
            A[kk - 1] = 10 ** (g / 20)
    n = int((dur + rel) * SR)
    e = env_ar(n, att, max(0.0, dur - att), rel)
    sig = additive(f0, n, A, rng) + 0.7 * additive(f0, n, A, rng, np.full(n, 1.5))
    if pedal:
        sig += 10 ** (-15 / 20) * 2.2 * np.sin(2 * np.pi * f0 / 2 * np.arange(n) / SR)
    sig *= e
    chiff = bandnoise(n, 1000, 3000, rng) * env_ar(n, 0.005, 0.01, 0.03)
    wind = bandnoise(n, 200, 900, rng) * e
    sig += unit(chiff) * math.sqrt(n) * 10 ** (-24 / 20) * 0.35 + unit(wind) * math.sqrt(n) * 10 ** (-38 / 20) * 0.3
    return pan(sig * vel * 0.21, pan0)


def harmonium(midi, dur, rng, vel=0.5, pan0=0.0):
    f0 = hz(midi)
    k = np.arange(1, 13)
    A = k ** -1.1
    A[1:4] *= 1.41
    A = unit(A / (1 + (f0 * k / 3500) ** 4))
    n = int((dur + 0.35) * SR)
    t = np.arange(n) / SR
    sig = additive(f0, n, A, rng, drift(n, 0.3, rng, 1.5))
    trem = 10 ** (0.7 * np.sin(2 * np.pi * 0.6 * t + rng.uniform(0, 6.28)) / 20)
    sig *= env_ar(n, 0.16, max(0.0, dur - 0.16), 0.35) * trem
    return pan(sig * vel * 0.19, pan0)


def flute(midi, dur, rng, vel=0.5, pan0=0.0):
    f0 = hz(midi)
    A = unit(np.array([1.0, 0.32, 0.1, 0.04]))
    n = int((dur + 0.3) * SR)
    t = np.arange(n) / SR
    vibenv = np.clip((t - 0.3) / 0.3, 0, 1)
    cents = 10 * vibenv * np.sin(2 * np.pi * 5.0 * t) + drift(n, 0.8, rng, 2)
    e = env_ar(n, 0.08, max(0.0, dur - 0.08), 0.28)
    sig = additive(f0, n, A, rng, cents) * e * (1 + 0.05 * vibenv * np.sin(2 * np.pi * 5.0 * t))
    br = bandnoise(n, f0 * 1.5, min(f0 * 4, 12000), rng)
    sig += unit(br) * math.sqrt(n) * 0.05 * (env_ar(n, 0.04, 0.05, 0.2) + 0.4 * e)
    return pan(sig * vel * 0.24, pan0)


# ───────────────────────────── mode: hộp nhạc / celesta / chuông / timpani ─────────────────────────────


def modal(f, parts, length, rng, att=0.002, cents=None, tick=0.0, tick_hp=3000):
    n = int(length * SR)
    t = np.arange(n) / SR
    fr = np.full(n, f) if cents is None else f * 2 ** (cents / 1200)
    ph = 2 * np.pi * np.cumsum(fr) / SR
    out = np.zeros(n)
    for r, g, t60 in parts:
        if f * r > 16000:
            continue
        out += 10 ** (g / 20) * np.exp(-6.91 * t / t60) * np.sin(r * ph + rng.uniform(0, 6.28))
    out *= np.clip(t / att, 0, 1)
    if tick > 0:
        tk = highpass(rng.standard_normal(n), tick_hp) * np.exp(-t / 0.0015)
        out += tk * tick
    return out


def musicbox(midi, rng, vel=0.5, detune=0.0, wow=0.0, pan0=0.0):
    f = hz(midi)
    T = float(np.clip(1.6 * (1000 / f) ** 0.35, 0.9, 3.0))
    parts = [(1, 0, T), (2.0, -26, T * 0.4), (6.27, -21, 0.35), (17.55, -34, 0.10)]
    L = T * 1.4
    n = int(L * SR)
    cents = None
    if detune or wow:
        t = np.arange(n) / SR
        cents = detune + wow * np.sin(2 * np.pi * 0.9 * t + rng.uniform(0, 6.28))
    sig = modal(f, parts, L, rng, 0.002, cents, tick=0.06)
    return pan(sig * vel * 0.64, pan0)


def celesta(midi, rng, vel=0.5, pan0=0.0):
    f = hz(midi)
    T = float(np.clip(1.3 * (800 / f) ** 0.3, 0.7, 2.4))
    parts = [(1, 0, T), (2.0, -26, T * 0.35), (2.76, -19, 0.25), (5.42, -30, 0.08)]
    sig = modal(f, parts, T * 1.5, rng, 0.006, tick=0.02, tick_hp=2000)
    return pan(sig * vel * 0.64, pan0)


def bell(midi, rng, vel=0.5, scale=1.0, pan0=0.0):
    """chuông nhà thờ: hum 0,5 · prime 1 · tierce 1,189 · quint 1,498 · nominal 2 (+ bồi âm trên)"""
    f = hz(midi)
    parts = [(0.5, -12, 5), (1, 0, 3), (1.189, -10, 1.9), (1.498, -18, 1.5), (2, -8, 0.9), (2.66, -20, 0.6), (3.0, -22, 0.5), (4.0, -26, 0.35)]
    parts = [(r, g, t60 * scale) for r, g, t60 in parts]
    sig = modal(f, parts, 5.5 * scale, rng, 0.003, tick=0.05, tick_hp=1500)
    return pan(sig * vel * 0.42, pan0)


def glassbell(midi, rng, vel=0.5, pan0=0.0):
    f = hz(midi)
    parts = [(1, 0, 2.2), (2.76, -9, 1.2), (5.4, -13, 0.7), (8.9, -18, 0.35)]
    return pan(modal(f, parts, 2.8, rng, 0.003) * vel * 0.25, pan0)


def timpani(midi, rng, vel=0.6, pan0=0.0):
    f = hz(midi)
    n = int(2.6 * SR)
    t = np.arange(n) / SR
    cents = -35 * (1 - np.exp(-t / 0.15))
    parts = [(1, 0, 1.8), (1.5, -6, 1.2), (1.98, -10, 0.9), (2.44, -14, 0.6), (2.94, -18, 0.4)]
    sig = modal(f, parts, 2.6, rng, 0.003, cents)
    thump = lowpass(rng.standard_normal(n), 900) * np.exp(-t / 0.03)
    sig += thump * 0.5
    return pan(sig * vel * 0.9, pan0)


def lowdrum(rng, vel=0.6, f=55.0):
    n = int(1.4 * SR)
    t = np.arange(n) / SR
    fr = f * (1 + 1.2 * np.exp(-t / 0.04))
    sig = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t / 0.35)
    sig += lowpass(rng.standard_normal(n), 400) * np.exp(-t / 0.05) * 0.6
    return pan(sig * vel * 0.5, 0)


# ───────────────────────────── Karplus–Strong: harpsichord / đàn hạc / pizzicato ─────────────────────────────


def ks(f, length, t60, rng, pos=0.13, damp=0.2, soft=0.0):
    """Dây gảy: vòng trễ + lọc hai điểm (trọng số damp) + allpass chỉnh lẻ mẫu, qua scipy lfilter (nhanh)"""
    P = SR / f
    s = float(damp)
    N = int(math.floor(P - s - 0.1))
    d = P - s - N
    if d < 0.1:
        N -= 1
        d += 1
    C = (1 - d) / (1 + d)
    g = 10 ** (-3 / (f * t60))
    a0, a1 = 1 - s, s
    a = np.zeros(N + 3)
    a[0] = 1
    a[1] += C
    a[N] -= g * a0 * C
    a[N + 1] -= g * (a0 + a1 * C)
    a[N + 2] -= g * a1
    n = int(length * SR)
    x = np.zeros(n)
    L = max(2, int(round(P)))
    burst = rng.uniform(-1, 1, L)
    if soft > 0:
        burst = ss.lfilter([1 - soft], [1, -soft], burst)
    burst = burst - np.roll(burst, max(1, int(round(pos * P))))
    x[:L] = burst
    y = ss.lfilter([1, C], a, x)
    return ss.lfilter([1, -1], [1, -0.995], y)  # chặn DC


def harpsichord(midi, rng, vel=0.5, pan0=0.0, wow=0.0, detune=0.0):
    f = hz(midi) * 2 ** (detune / 1200)
    t60 = float(np.clip(1.2 * (220 / f) ** 0.5, 0.35, 2.2))
    L = t60 * 1.1 + 0.1
    s8 = ks(f, L, t60, rng, pos=0.12, damp=0.14, soft=0.35)
    s4 = ks(f * 2 * 2 ** (3 / 1200), L, t60 * 0.7, rng, pos=0.14, damp=0.18, soft=0.35)
    sig = s8 + 0.32 * s4
    if wow:
        # "băng chùng": đọc lệch theo LFO (±wow cent) — nội suy tuyến tính
        n = len(sig)
        t = np.arange(n) / SR
        rate = 2 ** (wow * np.sin(2 * np.pi * 0.9 * t + rng.uniform(0, 6.28)) / 1200)
        pos = np.clip(np.cumsum(rate) - rate[0], 0, n - 1)
        sig = np.interp(pos, np.arange(n), sig)
    sig = lowpass(highpass(sig, 90), 6500)
    return pan(unit(sig) * math.sqrt(len(sig)) * vel * 0.08, pan0)


def harp(midi, rng, vel=0.5, pan0=0.0):
    f = hz(midi)
    t60 = float(np.clip(2.6 * (200 / f) ** 0.3, 1.0, 4.0))
    sig = ks(f, t60 * 0.9, t60, rng, pos=0.32, damp=0.35, soft=0.85)
    sig = lowpass(sig * np.clip(np.arange(len(sig)) / (0.002 * SR), 0, 1), 4200)
    return pan(unit(sig) * math.sqrt(len(sig)) * vel * 0.092, pan0)


def pizz(midi, rng, vel=0.5, pan0=0.0):
    f = hz(midi)
    t60 = float(np.clip(0.55 * (110 / f) ** 0.2, 0.25, 0.7))
    sig = ks(f, t60 * 1.2, t60, rng, pos=0.25, damp=0.45, soft=0.8)
    body = ss.sosfilt(ss.butter(2, [250 / (SR / 2), 1800 / (SR / 2)], btype="band", output="sos"), sig)
    sig = lowpass(sig * 0.6 + body * 0.8, 3000)
    return pan(unit(sig) * math.sqrt(len(sig)) * vel * 0.12, pan0)


# ───────────────────────────── vang (IR tổng hợp) ─────────────────────────────

_IR_CACHE = {}


def make_ir(kind):
    """IR stereo: phản xạ sớm + nhiễu Gauss tắt dần theo 4 dải (RT60 riêng), 30 % chung / 70 % riêng mỗi kênh"""
    if kind in _IR_CACHE:
        return _IR_CACHE[kind]
    presets = {
        "room": ([1.0, 0.85, 0.65, 0.45], 0.012, 0.03),
        "hall": ([2.6, 2.2, 1.6, 1.0], 0.018, 0.06),
        "cathedral": ([5.5, 4.5, 3.0, 1.8], 0.024, 0.08),
        "far": ([4.5, 3.6, 2.0, 1.0], 0.06, 0.12),
    }
    rts, pre, build = presets[kind]
    rng = np.random.default_rng(7 + len(kind))
    L = int((max(rts) * 1.05 + pre) * SR)
    t = np.arange(L) / SR
    bands = [(125, 500), (500, 1500), (1500, 4000), (4000, 8000)]
    shared = rng.standard_normal(L)
    ir = np.zeros((L, 2))
    for c in range(2):
        nz = math.sqrt(0.3) * shared + math.sqrt(0.7) * rng.standard_normal(L)
        acc = np.zeros(L)
        for (lo, hi), rt in zip(bands, rts):
            if kind == "far" and lo >= 4000:
                continue
            sos = ss.butter(2, [lo / (SR / 2), hi / (SR / 2)], btype="band", output="sos")
            acc += ss.sosfilt(sos, nz) * 10 ** (-3 * t / rt)
        acc *= np.clip((t - pre) / build, 0, 1)
        ir[:, c] = acc
    for ms_, db in zip([24, 39, 57, 83], [-12, -16, -19, -22]):
        i = int((pre * 0.5 + ms_ / 1000) * SR)
        ir[i, 0] += 10 ** (db / 20) * rng.choice([-1, 1]) * 3
        ir[i + int(rng.uniform(0.002, 0.009) * SR), 1] += 10 ** (db / 20) * rng.choice([-1, 1]) * 3
    ir /= np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True))
    _IR_CACHE[kind] = ir
    return ir


class Mix:
    """Bus khô + bus gửi vang (một loại vang / bản) + bus gửi vang "far" (xa)"""

    def __init__(self, dur, space="hall"):
        self.n = int(dur * SR)
        self.dry = np.zeros((self.n, 2))
        self.send = np.zeros((self.n, 2))
        self.far = np.zeros((self.n, 2))
        self.space = space

    def add(self, sig, t0, send=0.25, gain=1.0, far=0.0):
        if sig.ndim == 1:
            sig = pan(sig, 0)
        i0 = int(round(t0 * SR))
        if i0 >= self.n:
            return
        L = min(len(sig), self.n - i0)
        s = sig[:L] * gain
        self.dry[i0 : i0 + L] += s * (1 - far)
        if send:
            self.send[i0 : i0 + L] += s * send
        if far:
            self.far[i0 : i0 + L] += s * far

    def render(self, wet=0.5, far_wet=1.0):
        out = self.dry.copy()
        for bus, kind, w in ((self.send, self.space, wet), (self.far, "far", far_wet)):
            if not np.any(bus):
                continue
            ir = make_ir(kind)
            for c in range(2):
                out[:, c] += ss.fftconvolve(bus[:, c], ir[:, c])[: self.n] * w
        if np.any(self.far):
            pass
        return out


# ───────────────────────────── độ to / giới hạn / ghi ─────────────────────────────


def lufs(x):
    """độ to tích hợp BS.1770 (K-weighting 48 kHz, cổng tuyệt đối −70, tương đối −10)"""
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, -1.99004745483398, 0.99007225036621]
    y = ss.lfilter(b2, a2, ss.lfilter(b1, a1, x, axis=0), axis=0)
    blk = int(0.4 * SR)
    hop = int(0.1 * SR)
    ms = []
    for i in range(0, max(1, len(y) - blk), hop):
        ms.append(float(np.sum(np.mean(y[i : i + blk] ** 2, axis=0))))
    ms = np.array(ms) + 1e-12
    L = -0.691 + 10 * np.log10(ms)
    g = ms[L > -70]
    if len(g) == 0:
        return -70.0
    rel = -0.691 + 10 * np.log10(np.mean(g)) - 10
    g2 = ms[(L > -70) & (L > rel)]
    return float(-0.691 + 10 * np.log10(np.mean(g2)))


def limit(x, ceil_db=-1.0):
    thr = 10 ** (ceil_db / 20)
    env = maximum_filter1d(np.max(np.abs(x), axis=1), size=int(0.006 * SR))
    g = np.minimum(1.0, thr / np.maximum(env, 1e-9))
    gs = ss.lfilter([0.002], [1, -0.998], g, zi=[g[0] * 0.998])[0]
    g = np.minimum(g, gs)
    return x * g[:, None]


def fade_tail(x, sec):
    n = min(len(x), int(sec * SR))
    if n > 0:
        x[-n:] *= (0.5 + 0.5 * np.cos(np.pi * np.arange(n) / n))[:, None]
    return x


def write_wav(path, x):
    import wave

    y = np.clip(x, -1, 1)
    pcm = (y * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def encode(wav, base, demo=False):
    if demo:
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libopus", "-b:a", "96k", base + ".ogg"], check=True)
        return
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libopus", "-b:a", f"{OPUS_KBPS}k", "-vbr", "on", "-application", "audio", base + ".ogg"], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "aac", "-b:a", f"{AAC_KBPS}k", "-movflags", "+faststart", base + ".m4a"], check=True)


# ───────────────────────────── khung một bản nhạc ─────────────────────────────


class Track:
    def __init__(self, tid, bpm, beats, bars, slot_bars, root, scale, space, level, rest, tail=3.0, seed=1):
        self.id = tid
        self.bpm = bpm
        self.beats = beats
        self.bars = bars
        self.slot_bars = slot_bars
        self.root = root
        self.scale = scale
        self.space = space
        self.level = level
        self.rest = rest
        self.tail = tail
        self.beat_s = 60.0 / bpm
        self.bar_s = self.beat_s * beats
        self.rng = np.random.default_rng(seed)
        self.stems = {}  # tên → (mảng, kind, slot, param)
        self.chords = []  # mỗi ô nhịp: pcs so với root

    def t(self, bar, beat=0.0):
        return (bar * self.beats + beat) * self.beat_s

    def mix(self, bars):
        return Mix(bars * self.bar_s + self.tail, self.space)

    def put(self, name, audio, kind, slot=None, param=None):
        self.stems[name] = (audio, kind, slot, param)


def merged(voicings, part_idx):
    """gộp các ô nhịp liên tiếp cùng nốt ở một bè → [(ô bắt đầu, số ô, midi)]"""
    out = []
    for b, v in enumerate(voicings):
        x = v[part_idx] if part_idx < len(v) else None
        if x is None:
            continue
        if out and out[-1][2] == x and out[-1][0] + out[-1][1] == b:
            out[-1] = (out[-1][0], out[-1][1] + 1, x)
        else:
            out.append((b, 1, x))
    return out


def lay_choir(mx, tr, voicings, rng, vel=0.35, vowels=("u", "o"), parts=(0, 1, 2, 3), bars=None, send=0.45, far=0.0, overlap=0.25, att=0.45, vib=8.0):
    for pi in parts:
        for b, nb, x in merged(voicings, pi):
            if bars and b not in bars:
                continue
            mx.add(choir(x, nb * tr.bar_s + overlap, rng, vel=vel, vowels=vowels, att=att, vib=vib), tr.t(b), send=send, far=far)


def lay_strings(mx, tr, voicings, rng, vel=0.3, parts=(0, 1, 2), send=0.35, overlap=0.2, bright=0.9, oct_shift=0):
    for pi in parts:
        for b, nb, x in merged(voicings, pi):
            mx.add(strings(x + oct_shift, nb * tr.bar_s + overlap, rng, vel=vel, bright=bright, pan0=(-0.4, 0.4, -0.15, 0.2)[pi % 4]), tr.t(b), send=send)


def lay_melody(mx, tr, notes, inst, rng, start_bar=0, vel=0.5, send=0.35, far=0.0, **kw):
    for beat, d, x in notes:
        if x is None:
            continue
        t0 = tr.t(start_bar, beat) + rng.uniform(0, 0.012)
        v = vel * rng.uniform(0.9, 1.05)
        if inst == "flute":
            s = flute(x, d * tr.beat_s * 0.95, rng, v, pan0=kw.get("pan0", 0.1))
        elif inst == "musicbox":
            s = musicbox(x, rng, v, kw.get("detune", 0.0) + rng.normal(0, kw.get("jit", 0.0)), kw.get("wow", 0.0), kw.get("pan0", 0.15))
        elif inst == "celesta":
            s = celesta(x, rng, v, kw.get("pan0", 0.2))
        elif inst == "harp":
            s = harp(x, rng, v, kw.get("pan0", -0.2))
        elif inst == "glass":
            s = glassbell(x, rng, v, kw.get("pan0", 0.0))
        elif inst == "bell":
            s = bell(x, rng, v, kw.get("scale", 1.0), kw.get("pan0", 0.0))
        elif inst == "choir":
            s = choir(x, d * tr.beat_s + 0.1, rng, vel=v, vowels=kw.get("vowels", ("o", "a")), att=kw.get("att", 0.12), rel=kw.get("rel", 0.5), vib=kw.get("vib", 9), singers=kw.get("singers", 3))
        elif inst == "strings":
            s = strings(x, d * tr.beat_s * 0.98, rng, vel=v, att=kw.get("att", 0.12), rel=kw.get("rel", 0.4), vib=kw.get("vib", 10), pan0=kw.get("pan0", 0.0), width=0.3)
        elif inst == "organflute":
            s = organ(x, d * tr.beat_s * 0.95, rng, vel=v, flute=True, att=0.05, rel=0.2, pan0=kw.get("pan0", 0.0))
        elif inst == "harpsichord":
            s = harpsichord(x, rng, v, kw.get("pan0", 0.0))
        else:
            raise ValueError(inst)
        mx.add(s, t0, send=send, far=far)


def arp(mx, tr, voicings, rng, pattern, inst="harp", vel=0.4, send=0.3, bars=None, octave=0, pan_spread=0.5, wow=0.0, jit=0.0, far=0.0):
    """pattern: [(phách, chỉ số nốt trong hợp âm mở rộng)]; chỉ số ≥ len → lên quãng tám"""
    for b, v in enumerate(voicings):
        if bars is not None and b not in bars:
            continue
        tones = sorted(set(v))
        for beat, idx in pattern:
            o, j = divmod(idx, len(tones))
            x = tones[j] + 12 * (o + octave)
            t0 = tr.t(b, beat) + rng.uniform(0, 0.008)
            vv = vel * rng.uniform(0.85, 1.05) * (1.12 if beat == 0 else 1.0)
            p = rng.uniform(-pan_spread, pan_spread)
            if inst == "harp":
                s = harp(x, rng, vv, p)
            elif inst == "harpsichord":
                s = harpsichord(x, rng, vv, p, wow=wow, detune=rng.normal(0, jit) if jit else 0.0)
            elif inst == "celesta":
                s = celesta(x, rng, vv, p)
            elif inst == "musicbox":
                s = musicbox(x, rng, vv, rng.normal(0, jit) if jit else 0.0, wow, p)
            elif inst == "pizz":
                s = pizz(x, rng, vv, p)
            else:
                raise ValueError(inst)
            mx.add(s, t0, send=send, far=far)


def pcs(tr, voicing):
    """các lớp cao độ (so với root) của hợp âm, bè trầm trước — cho MUSIC_KEY lúc chạy"""
    out = []
    for x in voicing:
        p = (x - tr.root) % 12
        if p not in out:
            out.append(p)
    return out


def finish(tr, mx, wet=0.5, far_wet=1.0):
    x = mx.render(wet, far_wet)
    return fade_tail(x, min(1.6, tr.tail * 0.6))


# ═════════════════════════════ CÁC BẢN NHẠC ═════════════════════════════


def t_hub_day():
    """Quảng trường ngày — đồng quê anime, Rê trưởng, 3/4, 80 BPM: đàn hạc rải, dây legato, 'oo' nửa sau; sáo / celesta"""
    tr = Track("hubDay", 80, 3, 8, 4, m("D4"), [0, 2, 4, 5, 7, 9, 11], "hall", 0.62, 0.3, tail=3.0, seed=11)
    V = [ch("D3 A3 F#4 A4"), ch("C#3 A3 E4 A4"), ch("B2 F#3 D4 A4"), ch("G2 D3 B3 F#4"), ch("F#2 D3 A3 F#4"), ch("G2 B3 D4 G4"), ch("E2 B2 G3 D4"), ch("A2 E3 D4 A4")]
    tr.chords = [pcs(tr, v) for v in V]
    rng = tr.rng
    mx = tr.mix(8)
    arp(mx, tr, V, rng, [(0, 0), (1, 1), (1.5, 2), (2, 3), (2.5, 5)], "harp", vel=0.34, send=0.3)
    lay_strings(mx, tr, V, rng, vel=0.26, parts=(0, 1, 2), bright=0.75)
    lay_choir(mx, tr, V, rng, vel=0.22, vowels=("u", "o"), parts=(1, 2, 3), bars=range(4, 8))
    # Asus4 → A: bè alto D4 → C#4 ở phách 2 ô cuối
    mx.add(choir(m("C#4"), tr.bar_s * 0.6, rng, vel=0.2, vowels=("o", "o")), tr.t(7, 1.4), send=0.45)
    for b in (3, 7):
        mx.add(celesta(m("A5") if b == 3 else m("E6"), rng, 0.32, 0.35), tr.t(b, 2), send=0.4)
    tr.put("bed", finish(tr, mx, 0.42), "bed")
    cells = {
        ("c0a", 0, "flute"): "F#5:2 A5:1 | E5:1.5 C#5:.5 A4:1 | B4:1 C#5:1 D5:1 | F#5:2 E5:1",
        ("c0b", 0, "celesta"): "A5:1 F#5:1 D6:1 | C#6:3 | D6:1 B5:1 F#5:1 | G5:1.5 A5:.5 B5:1",
        ("c1a", 1, "flute"): "A5:1 F#5:1 D5:1 | B4:1.5 D5:.5 G5:1 | F#5:1 E5:1 D5:1 | E5:2 r:1",
        ("c1b", 1, "celesta"): "D6:2 A5:1 | B5:2 G5:1 | E5:1 G5:1 B5:1 | A5:3",
    }
    for (name, slot, inst), s in cells.items():
        cm = tr.mix(4)
        lay_melody(cm, tr, mel(s, 3), inst, rng, vel=0.55, send=0.35)
        tr.put(name, finish(tr, cm, 0.42), "cell", slot)
    return tr


def t_hub_night():
    """Quảng trường đêm — Si thứ (cùng tập nốt Rê trưởng), 3/4, 66 BPM: đàn hạc chậm, dây trầm, 'oo' rất nhỏ; hộp nhạc"""
    tr = Track("hubNight", 66, 3, 8, 4, m("B3"), [0, 2, 3, 5, 7, 8, 10], "hall", 0.6, 0.35, tail=3.2, seed=12)
    V = [ch("B2 F#3 D4 C#5"), ch("G2 D3 B3 F#4"), ch("D3 A3 F#4 A4"), ch("A2 E3 C#4 A4"), ch("E2 B2 G3 D4"), ch("F#2 B3 D4 F#4"), ch("G2 B3 D4 G4"), ch("F#2 C#4 A#4 F#4")]
    tr.chords = [pcs(tr, v) for v in V]
    rng = tr.rng
    mx = tr.mix(8)
    arp(mx, tr, V, rng, [(0, 0), (1, 2), (2, 3)], "harp", vel=0.3, send=0.38)
    lay_strings(mx, tr, V, rng, vel=0.22, parts=(0, 1), bright=0.6)
    lay_choir(mx, tr, V, rng, vel=0.2, vowels=("u", "u"), parts=(2, 3))
    tr.put("bed", finish(tr, mx, 0.5), "bed")
    cells = {
        ("c0a", 0, "musicbox"): "F#5:1 D5:1 C#5:1 | B4:2 F#5:1 | A5:1.5 F#5:.5 D5:1 | E5:3",
        ("c0b", 0, "musicbox"): "D6:2 B5:1 | B5:1 A5:1 F#5:1 | A5:3 | C#6:1 E6:1 A5:1",
        ("c1a", 1, "musicbox"): "G5:1 F#5:1 E5:1 | D5:2 F#5:1 | B5:1.5 A5:.5 G5:1 | F#5:1 E5:1 A#4:1",
        ("c1b", 1, "celesta"): "B5:1 G5:1 E5:1 | F#5:3 | D6:1 B5:1 G5:1 | C#6:2 A#5:1",
    }
    for (name, slot, inst), s in cells.items():
        cm = tr.mix(4)
        lay_melody(cm, tr, mel(s, 3), inst, rng, vel=0.52, send=0.45, jit=3.0)
        tr.put(name, finish(tr, cm, 0.5), "cell", slot)
    return tr


def t_impossible():
    """Thế giới Bất Khả — thánh ca: organ + hợp xướng SATB, Mi Aeolian, plagal iv → I (Picardy), vang nhà thờ"""
    tr = Track("impossible", 62, 4, 8, 4, m("E4"), [0, 2, 3, 5, 7, 8, 10], "cathedral", 0.62, 0.3, tail=4.5, seed=13)
    V = [ch("E3 B3 G4 B4"), ch("C3 E4 G4 C5"), ch("G2 D4 G4 B4"), ch("D3 D4 F#4 A4"), ch("A2 C4 E4 A4"), ch("E3 B3 E4 G4"), ch("A2 E4 A4 C5"), ch("E2 E4 G#4 B4")]
    tr.chords = [pcs(tr, v) for v in V]
    rng = tr.rng
    mx = tr.mix(8)
    for b, v in enumerate(V):
        # organ êm (8′ + 4′) giữ hợp âm; pedal 16′ ở bè trầm
        mx.add(organ(v[0] - 12, tr.bar_s + 0.15, rng, vel=0.3, pedal=True, att=0.12), tr.t(b), send=0.5)
        for x in v[1:]:
            mx.add(organ(x, tr.bar_s + 0.1, rng, vel=0.2, att=0.15, pan0=rng.uniform(-0.3, 0.3)), tr.t(b), send=0.55)
    lay_choir(mx, tr, V, rng, vel=0.36, vowels=("o", "a"), parts=(0, 1, 2, 3), att=0.6, vib=7)
    mx.add(bell(m("E4"), rng, 0.3, 1.0, -0.3), tr.t(0), send=0.3, far=0.6)
    tr.put("bed", finish(tr, mx, 0.62), "bed")
    cells = {
        # chant đơn âm (tenor + bass hát chung "oh"), quãng hẹp, đi bậc; 1–2 nốt có bè quãng năm (organum)
        ("c0a", 0, "chant"): "E4:1 G4:1 A4:1.5 A4:.5 | B4:2 A4:1 G4:1 | A4:1 B4:1 G4:1 E4:1 | F#4:2 E4:1 D4:1",
        ("c0b", 0, "descant"): "E5:4 | E5:2 G5:2 | D5:4 | F#5:2 A5:2",
        ("c1a", 1, "chant"): "C4:1 E4:1 D4:1 C4:1 | B3:2 E4:2 | E4:1 D4:1 C4:1 A3:1 | B3:2 B3:2",
        ("c1b", 1, "bells"): "E5:2 B4:2 | G4:2 E4:2 | A4:2 C5:2 | B4:4",
    }
    for (name, slot, kind), s in cells.items():
        cm = tr.mix(4)
        notes = mel(s, 4)
        if kind == "chant":
            lay_melody(cm, tr, notes, "choir", rng, vel=0.5, send=0.6, vowels=("o", "o"), att=0.15, rel=0.6, vib=5, singers=4)
            lay_melody(cm, tr, [(b0, d, x - 12 if x else None) for b0, d, x in notes], "choir", rng, vel=0.32, send=0.6, vowels=("o", "o"), att=0.15, rel=0.6, vib=5)
            # organum: một nốt quãng năm ở cuối câu
            b0, d, x = notes[-2]
            cm.add(choir(x + 7, d * tr.beat_s + 0.2, rng, vel=0.26, vowels=("o", "a")), tr.t(0, b0), send=0.6)
        elif kind == "descant":
            lay_melody(cm, tr, notes, "choir", rng, vel=0.36, send=0.6, vowels=("a", "a"), att=0.5, rel=1.0, vib=10)
        else:
            lay_melody(cm, tr, notes, "bell", rng, vel=0.42, send=0.3, far=0.6, scale=0.8)
        tr.put(name, finish(tr, cm, 0.62), "cell", slot)
    return tr


SIREN_V = None


def t_siren():
    """Mê cung Hoạ âm — ngọt mà rợn: harpsichord ostinato + hộp nhạc + hợp xướng + pizz, Đô thứ ↔ Đô trưởng, 96 BPM khoá HARMONIC"""
    global SIREN_V
    tr = Track("siren", 96, 4, 8, 4, m("C4"), [0, 2, 3, 5, 7, 8, 10], "hall", 0.6, 0.25, tail=2.6, seed=14)
    V = [ch("C3 G3 Eb4 G4"), ch("Ab2 Eb3 C4 Ab4"), ch("Eb3 G3 Bb3 G4"), ch("Bb2 F3 D4 Bb4"), ch("F2 C4 F4 Ab4"), ch("Db3 F3 Ab3 F4"), ch("G2 D4 F4 B4"), ch("C3 G3 E4 G4")]
    SIREN_V = V
    tr.chords = [pcs(tr, v) for v in V]
    rng = tr.rng
    pat = [(0, 0), (0.5, 1), (1, 2), (1.5, 1), (2, 3), (2.5, 1), (3, 2), (3.5, 1)]

    def bed(dis):
        r = np.random.default_rng(140 + dis)
        mx = tr.mix(8)
        arp(mx, tr, V, r, pat, "harpsichord", vel=0.3, send=0.22, octave=0, wow=(28 if dis else 0), jit=(18 if dis else 0))
        for b, v in enumerate(V):
            for beat in (0, 2):
                mx.add(pizz(v[0] if beat == 0 else v[0] + 7, r, 0.36, -0.1), tr.t(b, beat), send=0.2)
        if not dis:
            lay_choir(mx, tr, V, r, vel=0.24, vowels=("a", "o"), parts=(2, 3), att=0.5)
        else:
            # bất hoà: hợp xướng thêm quãng hai thứ trên bè soprano, nguyên âm "e" mỏng; hộp nhạc lệch dây đúp ostinato
            lay_choir(mx, tr, V, r, vel=0.22, vowels=("e", "u"), parts=(2, 3), att=0.5, vib=16)
            for b, v in enumerate(V):
                mx.add(choir(v[3] + 1, tr.bar_s, r, vel=0.12, vowels=("u", "e"), vib=20), tr.t(b, 0.5), send=0.5)
            arp(mx, tr, V, r, [(0.25, 4), (1.75, 5), (3.25, 6)], "musicbox", vel=0.22, send=0.4, wow=22, jit=30)
            # vút ngược (reverse swell) vào ô 1 và ô 5
            for b in (3, 7):
                sw = mx_rev_swell(r, V[(b + 1) % 8], tr.bar_s)
                mx.add(sw, tr.t(b + 1) - len(sw) / SR, send=0.1)
            # loé toàn cung ở ô 7
            for i, x in enumerate([m("C6"), m("D6"), m("E6"), m("F#6"), m("G#6"), m("A#6")]):
                mx.add(musicbox(x, r, 0.16, r.normal(0, 25), 10, 0.4), tr.t(6, 2 + i * 0.25), send=0.45)
        return finish(tr, mx, 0.4)

    tr.put("bed", bed(0), "bed")
    tr.put("dis", bed(1), "layer", param="dissonance")
    cells = {
        ("c0a", 0): "G5:1 Eb5:.5 D5:.5 C5:1 G4:1 | Ab4:1.5 C5:.5 Eb5:2 | Bb5:1 G5:1 Eb5:1 F5:1 | D5:3 r:1",
        ("c0b", 0): "C6:2 Bb5:1 G5:1 | Ab5:1 G5:.5 F5:.5 Eb5:2 | G5:1 Bb5:1 Eb6:2 | D6:1 C6:.5 Bb5:.5 F5:2",
        ("c1a", 1): "Ab5:1 G5:.5 F5:.5 C5:2 | Db5:1 F5:1 Ab5:2 | C5:1 D5:1 F5:.5 D5:.5 r:1 | E5:4",
        ("c1b", 1): "F5:2 Ab5:1 C6:1 | Bb5:1 Ab5:1 F5:2 | G5:1.5 F5:.5 D5:2 | C5:1 E5:1 G5:1 C6:1",
    }
    for (name, slot), s in cells.items():
        cm = tr.mix(4)
        lay_melody(cm, tr, mel(s, 4), "musicbox", rng, vel=0.55, send=0.4, jit=4.0, pan0=0.2)
        tr.put(name, finish(tr, cm, 0.45), "cell", slot)
    # lớp boss: dây spiccato 16 nốt / ô trên nốt trầm, "ah" tenor mỗi 2 ô, timpani phách 1 & 3, hợp xướng cao ô 5–8
    r = np.random.default_rng(149)
    bm = tr.mix(8)
    for b, v in enumerate(V):
        root = v[0] - 12
        for i in range(16):
            x = root + (12 if i % 4 == 2 else 7 if i % 8 == 6 else 0)
            bm.add(strings(x, tr.beat_s * 0.2, r, vel=0.36 * (1.25 if i % 4 == 0 else 1), att=0.008, rel=0.09, vib=0, voices=2, bow=0.6), tr.t(b, i * 0.25), send=0.18)
        for beat in (0, 2):
            bm.add(timpani(v[0] - 12 if beat == 0 else v[0] - 5, r, 0.5 if beat == 0 else 0.38), tr.t(b, beat), send=0.2)
    lay_choir(bm, tr, [[v[1] - 12, v[1]] for v in V], r, vel=0.42, vowels=("a", "a"), parts=(0, 1), bars=[0, 2, 4, 6], att=0.12, vib=11, overlap=-tr.bar_s * 0.35)
    lay_choir(bm, tr, V, r, vel=0.32, vowels=("o", "a"), parts=(2, 3), bars=range(4, 8), att=0.3, vib=12)
    tr.put("boss", finish(tr, bm, 0.35), "layer", param="boss")
    # glitch cắt dán (1 ô nhịp): dừng băng, hộp nhạc ngược, lắp bắp hợp xướng
    g = np.random.default_rng(150)
    gm = Mix(tr.bar_s + 1.2, "hall")
    for i, x in enumerate([m("C6"), m("G5"), m("Eb6"), m("D6"), m("C6"), m("G5"), m("Ab5"), m("G5")]):
        gm.add(musicbox(x, g, 0.4, 0, 6, 0.3), i * tr.beat_s / 2, send=0.3)
    a = gm.render(0.35)
    tr.put("g0", fade_tail(tape_stop(a, 0.55), 0.3), "glitch")
    gm = Mix(tr.bar_s + 2.5, "hall")
    for i, x in enumerate([m("C5"), m("Eb5"), m("G5"), m("C6"), m("Eb6"), m("G6")]):
        gm.add(musicbox(x, g, 0.35, g.normal(0, 15), 0, -0.3), i * 0.12, send=0.9)
    a = gm.render(0.9)[::-1].copy()
    n = int(tr.bar_s * SR)
    tr.put("g1", fade_tail(a[len(a) - n :] * env_ar(n, 0.8, 99, 0.01)[:, None], 0.03), "glitch")
    gm = Mix(tr.bar_s + 1.0, "hall")
    src = choir(m("G4"), 0.5, g, vel=0.5, vowels=("a", "a"), att=0.02, rel=0.1) + choir(m("Eb5"), 0.5, g, vel=0.4, vowels=("a", "a"), att=0.02, rel=0.1)
    sl = int(tr.beat_s / 4 * SR)
    for i in range(12):
        piece = src[int(0.1 * SR) : int(0.1 * SR) + sl].copy() * env_ar(sl, 0.004, tr.beat_s / 4 - 0.02, 0.012)[:, None]
        k = 2 ** (-(i // 4) / 12)
        idx = np.clip((np.arange(int(sl / k)) * k).astype(int), 0, sl - 1)
        gm.add(piece[idx] * (0.95 ** i), i * tr.beat_s / 4, send=0.25)
    tr.put("g2", fade_tail(gm.render(0.3), 0.4), "glitch")
    return tr


def mx_rev_swell(rng, voicing, bar_s):
    """hợp âm hộp nhạc + vang dài, đảo ngược → vút lên chạm phách mạnh (dài ~0,7 ô nhịp)"""
    mx = Mix(3.5, "cathedral")
    for x in sorted(set(voicing))[1:]:
        mx.add(musicbox(x + 12, rng, 0.35, rng.normal(0, 12), 0, rng.uniform(-0.5, 0.5)), 0.0, send=1.0)
    a = mx.render(1.2)[::-1].copy()
    n = int(bar_s * 0.7 * SR)
    a = a[len(a) - n :]
    return a * env_ar(n, bar_s * 0.6, 99, 0.01)[:, None]


def tape_stop(a, frac):
    """giảm tốc đều tới 0 trong `frac` cuối đoạn (như băng dừng) — không làm lệch phách vì cả đoạn dài đúng 1 ô"""
    n = len(a)
    k0 = int(n * (1 - frac))
    speed = np.ones(n)
    speed[k0:] = np.linspace(1, 0, n - k0) ** 1.5
    pos = np.clip(np.cumsum(speed) - 1, 0, n - 1)
    out = np.stack([np.interp(pos, np.arange(n), a[:, c]) for c in range(2)], axis=1)
    out[k0:] *= np.linspace(1, 0.2, n - k0)[:, None]
    return out


def t_boss():
    """Đấu boss — Rê thứ, 112 BPM: dây spiccato, pedal organ, hợp xướng 'ah' mạnh, timpani; câu soprano / dây"""
    tr = Track("boss", 112, 4, 8, 4, m("D4"), [0, 2, 3, 5, 7, 8, 10], "hall", 0.72, 0.15, tail=2.4, seed=15)
    V = [ch("D3 A3 F4 A4"), ch("Bb2 F3 D4 F4"), ch("G2 D3 Bb3 G4"), ch("A2 E3 C#4 A4"), ch("D3 A3 F4 D5"), ch("F2 C4 F4 A4"), ch("C3 G3 E4 G4"), ch("A2 E3 C#4 G4")]
    tr.chords = [pcs(tr, v) for v in V]
    rng = tr.rng
    mx = tr.mix(8)
    for b, v in enumerate(V):
        root = v[0] - 12
        for i in range(8):
            x = root + (0, 12, 7, 12, 0, 12, 7, 15 if b in (0, 4) else 12)[i]
            mx.add(strings(x, tr.beat_s * 0.32, rng, vel=0.36 * (1.25 if i % 2 == 0 else 1), att=0.008, rel=0.1, vib=0, voices=2, bow=0.7), tr.t(b, i * 0.5), send=0.2)
        mx.add(organ(v[0] - 12, tr.bar_s + 0.05, rng, vel=0.3, pedal=True, att=0.05), tr.t(b), send=0.3)
        for beat, vv in ((0, 0.6), (2, 0.42)):
            mx.add(timpani(v[0] - 12, rng, vv), tr.t(b, beat), send=0.25)
        if b in (3, 7):
            for i, beat in enumerate((3, 3.25, 3.5, 3.75)):
                mx.add(timpani(v[0] - 12 + (0, 0, 7, 7)[i], rng, 0.3 + 0.06 * i), tr.t(b, beat), send=0.25)
    lay_choir(mx, tr, V, rng, vel=0.4, vowels=("a", "a"), parts=(1, 2, 3), att=0.25, vib=12)
    for b in (0, 4):
        mx.add(bell(V[b][0] + 12, rng, 0.3, 0.8, 0.3), tr.t(b), send=0.3)
    tr.put("bed", finish(tr, mx, 0.4), "bed")
    cells = {
        ("c0a", 0, "choir"): "A5:2 F5:1 D5:1 | D5:1.5 F5:.5 Bb5:2 | G5:1 A5:1 Bb5:1 D6:1 | C#6:2 A5:2",
        ("c0b", 0, "strings"): "D5:1 E5:1 F5:1 A5:1 | Bb5:2 A5:1 F5:1 | G5:2 Bb5:2 | A5:4",
        ("c1a", 1, "choir"): "F5:1 E5:1 D5:1 A5:1 | C6:2 A5:2 | G5:1 E5:1 C5:1 E5:1 | A5:2 G5:1 E5:1",
        ("c1b", 1, "strings"): "A5:3 D6:1 | C6:2 F5:2 | E5:2 G5:2 | C#6:2 E6:2",
    }
    for (name, slot, inst), s in cells.items():
        cm = tr.mix(4)
        if inst == "choir":
            lay_melody(cm, tr, mel(s, 4), "choir", rng, vel=0.55, send=0.45, vowels=("a", "a"), att=0.08, rel=0.4, vib=12, singers=4)
        else:
            notes = mel(s, 4)
            lay_melody(cm, tr, notes, "strings", rng, vel=0.5, send=0.4, att=0.1, vib=12)
            lay_melody(cm, tr, [(b0, d, x - 12 if x else None) for b0, d, x in notes], "strings", rng, vel=0.36, send=0.4, att=0.1, vib=12, pan0=-0.3)
        tr.put(name, finish(tr, cm, 0.4), "cell", slot)
    return tr


def t_exp_day():
    """Vùng Mở rộng ngày — Sol trưởng, 80 BPM: pizz, đàn hạc thưa, dây, 'oo' nửa sau; sáo / celesta / đàn hạc"""
    tr = Track("expDay", 80, 4, 8, 4, m("G4"), [0, 2, 4, 5, 7, 9, 11], "hall", 0.6, 0.3, tail=3.0, seed=16)
    V = [ch("G2 D3 B3 G4"), ch("F#2 D3 A3 F#4"), ch("E2 B2 G3 D4"), ch("C3 G3 D4 E4"), ch("B2 D3 G3 D4"), ch("C3 E3 G3 E4"), ch("A2 E3 G3 C4"), ch("D3 A3 C4 F#4")]
    tr.chords = [pcs(tr, v) for v in V]
    rng = tr.rng
    mx = tr.mix(8)
    for b, v in enumerate(V):
        mx.add(pizz(v[0], rng, 0.42, -0.15), tr.t(b, 0), send=0.2)
        mx.add(pizz(v[0] + 7 if b % 2 == 0 else v[0] + 12, rng, 0.32, 0.1), tr.t(b, 2), send=0.2)
    arp(mx, tr, V, rng, [(0.5, 2), (1, 3), (2.5, 4), (3, 5)], "harp", vel=0.3, send=0.32)
    lay_strings(mx, tr, V, rng, vel=0.24, parts=(1, 2, 3), bright=0.7)
    lay_choir(mx, tr, V, rng, vel=0.2, vowels=("u", "o"), parts=(2, 3), bars=range(4, 8))
    tr.put("bed", finish(tr, mx, 0.42), "bed")
    cells = {
        ("c0a", 0, "flute"): "B4:1 D5:1 G5:2 | F#5:1.5 E5:.5 D5:2 | E5:1 G5:1 B5:1 A5:1 | G5:2 E5:1 D5:1",
        ("c0b", 0, "celesta"): "D6:2 B5:2 | A5:3 r:1 | G5:1 B5:1 D6:2 | E6:4",
        ("c1a", 1, "flute"): "D5:1 B4:1 G4:1 B4:1 | C5:1 E5:1 G5:2 | A5:1 G5:1 E5:1 C5:1 | D5:2 A4:2",
        ("c1b", 1, "harp"): "G5:2 D5:2 | E5:2 G5:2 | C6:2 A5:2 | F#5:4",
    }
    for (name, slot, inst), s in cells.items():
        cm = tr.mix(4)
        lay_melody(cm, tr, mel(s, 4), inst, rng, vel=0.55, send=0.35)
        tr.put(name, finish(tr, cm, 0.42), "cell", slot)
    return tr


def t_exp_night():
    """Vùng Mở rộng đêm — Mi thứ, 64 BPM: celesta rải chậm, dây rất nhỏ, 'oo', chuông xa; hộp nhạc / sáo trầm"""
    tr = Track("expNight", 64, 4, 8, 4, m("E4"), [0, 2, 3, 5, 7, 8, 10], "hall", 0.58, 0.35, tail=3.4, seed=17)
    V = [ch("E3 B3 G4 F#4"), ch("C3 G3 E4 B4"), ch("G2 D3 B3 G4"), ch("D3 A3 F#4 A4"), ch("A2 E3 G3 C4"), ch("G2 B3 E4 G4"), ch("C3 G3 E4 G4"), ch("B2 F#3 D#4 B4")]
    tr.chords = [pcs(tr, v) for v in V]
    rng = tr.rng
    mx = tr.mix(8)
    arp(mx, tr, V, rng, [(0, 1), (1.5, 3), (3, 4)], "celesta", vel=0.3, send=0.45)
    lay_strings(mx, tr, V, rng, vel=0.2, parts=(0, 1), bright=0.55)
    lay_choir(mx, tr, V, rng, vel=0.2, vowels=("u", "u"), parts=(2, 3))
    mx.add(bell(m("E3"), rng, 0.26, 1.0, 0.3), tr.t(0), send=0.2, far=0.7)
    tr.put("bed", finish(tr, mx, 0.52), "bed")
    cells = {
        ("c0a", 0, "musicbox"): "B5:2 G5:1 F#5:1 | E5:2 B5:2 | D6:1 B5:1 G5:2 | A5:2 F#5:2",
        ("c0b", 0, "musicbox"): "E5:1 F#5:1 G5:1 B5:1 | C6:3 B5:1 | D6:4 | A5:2 D6:2",
        ("c1a", 1, "flute"): "C5:2 E5:2 | G5:2 F#5:1 E5:1 | E5:2 G5:2 | F#5:2 D#5:2",
        ("c1b", 1, "musicbox"): "A5:1 C6:1 E6:2 | B5:4 | C6:1 G5:1 E5:2 | D#6:2 B5:2",
    }
    for (name, slot, inst), s in cells.items():
        cm = tr.mix(4)
        lay_melody(cm, tr, mel(s, 4), inst, rng, vel=0.5 if inst == "musicbox" else 0.55, send=0.45, jit=3.0)
        tr.put(name, finish(tr, cm, 0.52), "cell", slot)
    return tr


def t_archive():
    """Kho Lưu trữ — tối, thưa: drone organ trầm Rê + không khí + hợp xướng rất xa (Rê Phrygian)"""
    tr = Track("archive", 54, 4, 6, 3, m("D4"), [0, 1, 3, 5, 7, 8, 10], "cathedral", 0.6, 0.45, tail=4.5, seed=18)
    V = [ch("D2 A2 D3 F3")] * 3 + [ch("D2 Eb3 G3 Bb3")] * 3
    tr.chords = [pcs(tr, v) for v in V]
    rng = tr.rng
    mx = tr.mix(6)
    L = 6 * tr.bar_s
    mx.add(organ(m("D2"), L - 0.5, rng, vel=0.36, pedal=True, att=2.5, rel=1.5, flute=True), 0, send=0.4)
    mx.add(organ(m("A2"), L * 0.5 - 0.3, rng, vel=0.2, att=2.0, rel=1.2, flute=True), 0, send=0.4)
    mx.add(organ(m("Bb2"), L * 0.5 - 0.3, rng, vel=0.18, att=2.0, rel=1.2, flute=True), L * 0.5, send=0.4)
    n = int(L * SR)
    air = unit(bandnoise(n, 180, 1200, rng)) * math.sqrt(n) * 0.018 * (1 + 0.5 * drift(n, 0.08, rng, 1))
    mx.add(pan(air, 0) * env_ar(n, 2.0, L - 4.0, 2.0)[:, None], 0, send=0.3)
    lay_choir(mx, tr, [[None, x[1] + 12, x[2] + 12, x[3] + 12] for x in V], rng, vel=0.3, vowels=("u", "u"), parts=(1, 2, 3), far=0.85, send=0.0, att=1.5)
    tr.put("bed", finish(tr, mx, 0.6, 1.2), "bed")
    cm = tr.mix(3)
    cm.add(bell(m("D4"), rng, 0.36, 1.2, -0.3), tr.t(0, 1), send=0.2, far=0.8)
    cm.add(lowdrum(rng, 0.35, 41.2), tr.t(0, 1), send=0.3)
    cm.add(glassbell(m("A6"), rng, 0.3, 0.4), tr.t(1, 2), send=0.3, far=0.7)
    tr.put("c0a", finish(tr, cm, 0.6, 1.2), "cell", 0)
    cm = tr.mix(3)
    lay_melody(cm, tr, mel("A4:4 | Bb4:2 A4:2 | r:4", 4), "choir", rng, vel=0.34, send=0.0, far=0.9, vowels=("u", "o"), att=0.8, rel=1.5, vib=6)
    tr.put("c0b", finish(tr, cm, 0.6, 1.2), "cell", 0)
    cm = tr.mix(3)
    lay_melody(cm, tr, mel("r:1 Eb5:1 D5:2 | r:2 A4:2 | r:4", 4), "celesta", rng, vel=0.36, send=0.2, far=0.75)
    tr.put("c1a", finish(tr, cm, 0.6, 1.2), "cell", 1)
    cm = tr.mix(3)
    cm.add(strings(m("A2"), tr.bar_s * 2, rng, vel=0.3, att=2.5, rel=1.5, vib=4, bright=0.5), 0, send=0.2, far=0.6)
    cm.add(bell(m("G3"), rng, 0.3, 1.4, 0.4), tr.t(2), send=0.1, far=0.9)
    tr.put("c1b", finish(tr, cm, 0.6, 1.2), "cell", 1)
    return tr


def t_study():
    """Phòng Học — rất nhỏ, ru: harmonium + đàn hạc mềm, Fa trưởng 70 BPM; câu hộp nhạc"""
    tr = Track("study", 70, 4, 8, 4, m("F4"), [0, 2, 4, 5, 7, 9, 11], "room", 0.45, 0.4, tail=2.6, seed=19)
    V = [ch("F2 C3 A3 F4"), ch("E2 C3 G3 E4"), ch("D2 A2 F3 C4"), ch("Bb1 F2 D3 A3"), ch("A1 F2 C3 F3"), ch("Bb1 F2 D3 F3"), ch("G1 F2 Bb2 D3"), ch("C2 G2 C3 E3")]
    tr.chords = [pcs(tr, v) for v in V]
    rng = tr.rng
    mx = tr.mix(8)
    for b, v in enumerate(V):
        for x in v[1:]:
            mx.add(harmonium(x + 12, tr.bar_s + 0.1, rng, vel=0.22, pan0=rng.uniform(-0.3, 0.3)), tr.t(b), send=0.3)
    arp(mx, tr, V, rng, [(0, 0), (1, 2), (2, 3), (3, 2)], "harp", vel=0.26, send=0.3, octave=1)
    tr.put("bed", finish(tr, mx, 0.4), "bed")
    cells = {
        ("c0a", 0): "A5:2 C6:2 | G5:2 E5:2 | F5:1 A5:1 C6:2 | D6:4",
        ("c0b", 0): "F5:1 G5:1 A5:2 | C6:1 G5:1 E5:2 | D5:2 F5:2 | A5:2 F5:2",
        ("c1a", 1): "C6:2 A5:2 | Bb5:1 D6:1 F5:2 | G5:2 Bb5:1 A5:1 | G5:4",
        ("c1b", 1): "F5:2 A5:1 C6:1 | D6:2 Bb5:2 | A5:1 G5:1 F5:1 D5:1 | E5:2 G5:2",
    }
    for (name, slot), s in cells.items():
        cm = tr.mix(4)
        lay_melody(cm, tr, mel(s, 4), "musicbox", rng, vel=0.5, send=0.35, jit=2.0)
        tr.put(name, finish(tr, cm, 0.4), "cell", slot)
    return tr


TRACKS = {
    "hubDay": t_hub_day,
    "hubNight": t_hub_night,
    "impossible": t_impossible,
    "siren": t_siren,
    "boss": t_boss,
    "expDay": t_exp_day,
    "expNight": t_exp_night,
    "archive": t_archive,
    "study": t_study,
}


# ═════════════════════════════ STINGER (bus Hiệu ứng, sprite một file, viết ở Rê — lúc chạy dịch giọng) ═════════════════════════════


def stingers():
    rng = np.random.default_rng(99)
    out = {}
    # Amen: iv → I (Sol thứ → Rê trưởng), "oh → ah", kèm celesta lấp lánh
    mx = Mix(4.2, "hall")
    a = [m("G3"), m("D4"), m("G4"), m("Bb4")]
    b = [m("D3"), m("D4"), m("F#4"), m("A4")]
    for x in a:
        mx.add(choir(x, 0.75, rng, vel=0.45, vowels=("o", "o"), att=0.12, rel=0.35, vib=8), 0.0, send=0.4)
    for x in b:
        mx.add(choir(x, 1.6, rng, vel=0.5, vowels=("o", "a"), att=0.2, rel=1.0, vib=10), 0.78, send=0.45)
    for i, x in enumerate([m("D6"), m("F#6"), m("A6")]):
        mx.add(celesta(x, rng, 0.4, 0.3), 0.85 + i * 0.09, send=0.5)
    out["amen"] = fade_tail(mx.render(0.45), 0.8)
    # Thắng: bVI → bVII → I (Sib → Đô → Rê), dây + hợp xướng + organ, chuông
    mx = Mix(4.6, "hall")
    seq = [([m("Bb2"), m("F3"), m("D4"), m("Bb4")], 0.0, 0.34), ([m("C3"), m("G3"), m("E4"), m("C5")], 0.36, 0.34), ([m("D3"), m("A3"), m("F#4"), m("D5")], 0.72, 2.0)]
    for i in range(10):
        x = [m("D4"), m("E4"), m("F#4"), m("A4"), m("B4"), m("D5"), m("E5"), m("F#5"), m("A5"), m("D6")][i]
        mx.add(harp(x, rng, 0.38, -0.3 + i * 0.06), i * 0.035, send=0.35)
    for v, t0, d in seq:
        for x in v:
            mx.add(strings(x, d, rng, vel=0.42, att=0.05, rel=0.6, vib=10, width=0.3), t0, send=0.35)
            mx.add(choir(x, d, rng, vel=0.4, vowels=("a", "a"), att=0.06, rel=0.8, vib=11), t0, send=0.45)
        mx.add(organ(v[0] - 12, d, rng, vel=0.3, pedal=True, att=0.03), t0, send=0.3)
    mx.add(bell(m("D5"), rng, 0.38, 0.7, 0.3), 0.72, send=0.35)
    mx.add(timpani(m("D2"), rng, 0.45), 0.72, send=0.3)
    out["victory"] = fade_tail(mx.render(0.42), 1.0)
    # Thua: "oo" đi xuống không giải (A → G → F → E trên pedal Rê), celesta thưa
    mx = Mix(3.8, "hall")
    mx.add(choir(m("D3"), 2.6, rng, vel=0.3, vowels=("u", "u"), att=0.3, rel=0.9), 0.0, send=0.45)
    mx.add(choir(m("A3"), 2.6, rng, vel=0.24, vowels=("u", "u"), att=0.3, rel=0.9), 0.0, send=0.45)
    for i, x in enumerate([m("A4"), m("G4"), m("F4"), m("E4")]):
        mx.add(choir(x, 0.62 if i < 3 else 1.3, rng, vel=0.4, vowels=("u", "o"), att=0.12, rel=0.4 if i < 3 else 0.9, vib=6), i * 0.6, send=0.5)
    mx.add(celesta(m("D5"), rng, 0.3, 0.3), 0.0, send=0.5)
    mx.add(celesta(m("Bb4"), rng, 0.26, -0.3), 1.2, send=0.5)
    out["defeat"] = fade_tail(mx.render(0.5), 0.9)
    # Boss xuất hiện: vút ngược (nhiễu + cụm hợp xướng) vào chuông trầm + timpani + organ quãng năm trống
    mx = Mix(4.4, "cathedral")
    swell = Mix(3.0, "cathedral")
    for x in (m("D4"), m("Eb4"), m("A4")):
        swell.add(choir(x, 0.5, rng, vel=0.5, vowels=("a", "a"), att=0.02, rel=0.2), 0.0, send=1.0)
    rv = swell.render(1.0)[::-1].copy()
    n = int(1.1 * SR)
    rv = rv[len(rv) - n :] * env_ar(n, 1.0, 9, 0.01)[:, None]
    nz = pan(unit(bandnoise(n, 1500, 9000, rng)) * math.sqrt(n) * 0.06 * np.linspace(0, 1, n) ** 3, 0)
    mx.add(rv + nz, 0.0, send=0.1)
    t1 = 1.1
    mx.add(bell(m("D3"), rng, 0.5, 1.0, 0.0), t1, send=0.4)
    mx.add(timpani(m("D2"), rng, 0.6), t1, send=0.3)
    mx.add(lowdrum(rng, 0.5, 36.7), t1, send=0.3)
    for x in (m("D2"), m("A2"), m("D3")):
        mx.add(organ(x, 1.6, rng, vel=0.36, pedal=x == m("D2"), att=0.02, rel=1.0), t1, send=0.5)
    for x in (m("D4"), m("A4")):
        mx.add(choir(x, 1.6, rng, vel=0.45, vowels=("a", "o"), att=0.03, rel=1.0, vib=12), t1, send=0.5)
    out["bossReveal"] = fade_tail(mx.render(0.5), 1.0)
    # Cổng dịch chuyển: đàn hạc lướt lên ngũ cung + "oo" ngược, hạ cánh nhẹ (celesta + "oo")
    mx = Mix(3.2, "hall")
    gl = [m(x) for x in "D4 E4 F#4 A4 B4 D5 E5 F#5 A5 B5 D6 E6".split()]
    for i, x in enumerate(gl):
        mx.add(harp(x, rng, 0.3 + 0.01 * i, -0.5 + i / len(gl)), 0.1 + i * 0.075, send=0.45)
    swell = Mix(2.6, "hall")
    swell.add(choir(m("A4"), 0.4, rng, vel=0.5, vowels=("u", "u"), att=0.02, rel=0.2), 0, send=1.0)
    swell.add(choir(m("D5"), 0.4, rng, vel=0.4, vowels=("u", "u"), att=0.02, rel=0.2), 0, send=1.0)
    rv = swell.render(1.0)[::-1].copy()
    n = int(1.2 * SR)
    mx.add(rv[len(rv) - n :] * env_ar(n, 1.1, 9, 0.01)[:, None], 0.0, send=0.2)
    for x in (m("D4"), m("A4"), m("F#5")):
        mx.add(choir(x, 0.9, rng, vel=0.3, vowels=("u", "u"), att=0.08, rel=0.8), 1.2, send=0.5)
    mx.add(celesta(m("D6"), rng, 0.38, 0.2), 1.2, send=0.5)
    mx.add(celesta(m("A6"), rng, 0.3, -0.2), 1.32, send=0.5)
    out["portal"] = fade_tail(mx.render(0.45), 0.8)
    return out


# ═════════════════════════════ xuất bản ═════════════════════════════


def render_track(tid):
    t0 = time.time()
    tr = TRACKS[tid]()
    # chuẩn hoá theo NHÓM (cùng hệ số cho mọi stem của bản): bed + một câu khe 0 + lớp đầu
    ref = tr.stems["bed"][0].copy()
    for name, (a, kind, slot, param) in tr.stems.items():
        if kind == "cell" and slot == 0:
            L = min(len(ref), len(a))
            ref[:L] += a[:L]
            break
    g = 10 ** ((TARGET_LUFS - lufs(ref)) / 20)
    meta = {
        "id": tr.id,
        "bpm": tr.bpm,
        "beats": tr.beats,
        "bars": tr.bars,
        "slotBars": tr.slot_bars,
        "root": tr.root,
        "scale": tr.scale,
        "chords": tr.chords,
        "level": tr.level,
        "rest": tr.rest,
        "bed": None,
        "cells": [],
        "layers": [],
        "glitch": [],
    }
    for name, (a, kind, slot, param) in tr.stems.items():
        y = limit(a * g)
        base = f"{tr.id}_{name}"
        write_wav(os.path.join(WAV_DIR, base + ".wav"), y)
        ref_ = {"f": base, "dur": round(len(y) / SR, 3)}
        if kind == "bed":
            meta["bed"] = ref_
        elif kind == "cell":
            meta["cells"].append({**ref_, "slot": slot})
        elif kind == "layer":
            meta["layers"].append({**ref_, "param": param})
        elif kind == "glitch":
            meta["glitch"].append(ref_)
    with open(os.path.join(META_DIR, tr.id + ".json"), "w", encoding="utf-8") as f:
        json.dump(meta, f)
    print(f"  {tid}: {len(tr.stems)} stem, {time.time() - t0:.1f}s, gain {20 * math.log10(g):+.1f} dB")
    return tr, g


def demo(tr, g, secs=64.0):
    """bản nghe thử: mô phỏng bộ ghép câu lúc chạy (bed lặp + câu ngẫu nhiên / nghỉ; Siren: bất hoà tăng dần + boss + glitch)"""
    rng = np.random.default_rng(5)
    loop = tr.bars * tr.bar_s
    slot_s = tr.slot_bars * tr.bar_s
    n = int((secs + 6) * SR)
    out = np.zeros((n, 2))

    def put(a, t, gain=1.0):
        i = int(t * SR)
        if i >= n:
            return
        L = min(len(a), n - i)
        out[i : i + L] += a[:L] * gain * g

    last = {}
    k = 0
    while k * loop < secs:
        t = k * loop
        frac = t / secs
        bed = tr.stems["bed"][0]
        if "dis" in tr.stems:
            d = min(1.0, frac * 1.6)
            put(bed, t, math.cos(d * math.pi / 2))
            put(tr.stems["dis"][0], t, math.sin(d * math.pi / 2))
            if frac > 0.55:
                put(tr.stems["boss"][0], t, 1.0)
            for b in range(tr.bars):
                if d > 0.25 and rng.random() < 0.35 * d:
                    gl = [v for kk, v in tr.stems.items() if v[1] == "glitch"]
                    put(gl[rng.integers(len(gl))][0], t + b * tr.bar_s, 0.8)
        else:
            put(bed, t)
        for s in range(tr.bars // tr.slot_bars):
            opts = [(name, v) for name, v in tr.stems.items() if v[1] == "cell" and v[2] == s and name != last.get(s)]
            if not opts or (k > 0 and rng.random() < tr.rest):
                last[s] = None
                continue
            name, v = opts[rng.integers(len(opts))]
            last[s] = name
            put(v[0], t + s * slot_s)
        k += 1
    out = fade_tail(out[: int((k * loop + tr.tail) * SR)], 3.0)
    p = os.path.join(DEMO_DIR, f"{tr.id}_demo")
    write_wav(p + ".wav", limit(out * tr.level / 0.7))
    encode(p + ".wav", p, demo=True)
    os.remove(p + ".wav")


def write_manifest(stinger_meta):
    metas = []
    for tid in TRACKS:
        p = os.path.join(META_DIR, tid + ".json")
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                metas.append(json.load(f))
    lines = [
        "/**",
        " * SINH TỰ ĐỘNG bởi scripts/audio-render.py — đừng sửa tay (chạy lại script để cập nhật).",
        " * Bảng các bản nhạc nền render sẵn (public/world/audio/<f>.ogg | .m4a) + stinger (sprite một file).",
        " * Kiểu dữ liệu + logic chọn / ghép câu: lib/world/musicStems.ts.",
        " */",
        'import type { StingerSprite, TrackDef } from "./musicStems";',
        "",
        "export const TRACKS: Record<string, TrackDef> = " + json.dumps({x["id"]: x for x in metas}, ensure_ascii=False, indent=2) + ";",
        "",
        "export const STINGERS: StingerSprite = " + json.dumps(stinger_meta, ensure_ascii=False, indent=2) + ";",
        "",
    ]
    with open(TS_OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))


def job(tid, no_enc, no_demo):
    t0 = time.time()
    tr, g = render_track(tid)
    if not no_enc:
        for name in tr.stems:
            base = f"{tr.id}_{name}"
            encode(os.path.join(WAV_DIR, base + ".wav"), os.path.join(PUB_DIR, base))
    if not no_demo and not no_enc:
        demo(tr, g)
    return f"  {tid}: xong sau {time.time() - t0:.0f}s"


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    no_enc = "--no-encode" in sys.argv
    no_demo = "--no-demo" in sys.argv
    for d in (WAV_DIR, META_DIR, DEMO_DIR, PUB_DIR):
        os.makedirs(d, exist_ok=True)
    ids = args or list(TRACKS)
    if "stingers" in ids:
        ids = [i for i in ids if i != "stingers"]
        do_st = True
    else:
        do_st = not args
    from concurrent.futures import ProcessPoolExecutor

    with ProcessPoolExecutor(max_workers=min(len(ids), max(1, (os.cpu_count() or 2) - 1))) as ex:
        for line in ex.map(job, ids, [no_enc] * len(ids), [no_demo] * len(ids)):
            print(line, flush=True)
    st_path = os.path.join(META_DIR, "stingers.json")
    if do_st:
        st = stingers()
        gap = int(0.25 * SR)
        parts = []
        cues = {}
        pos = 0
        for name, a in st.items():
            a = a * 10 ** ((-18.0 - lufs(a)) / 20)
            a = limit(a)
            cues[name] = {"at": round(pos / SR, 4), "dur": round(len(a) / SR, 3)}
            parts += [a, np.zeros((gap, 2))]
            pos += len(a) + gap
        sprite = np.concatenate(parts)
        write_wav(os.path.join(WAV_DIR, "stingers.wav"), sprite)
        if not no_enc:
            encode(os.path.join(WAV_DIR, "stingers.wav"), os.path.join(PUB_DIR, "stingers"))
        with open(st_path, "w", encoding="utf-8") as f:
            json.dump({"f": "stingers", "root": m("D4"), "cues": cues}, f)
        print(f"  stingers: {', '.join(cues)}")
    if os.path.exists(st_path):
        with open(st_path, encoding="utf-8") as f:
            write_manifest(json.load(f))
    tot = sum(os.path.getsize(os.path.join(PUB_DIR, x)) for x in os.listdir(PUB_DIR))
    print(f"public/world/audio: {len(os.listdir(PUB_DIR))} file, {tot / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
