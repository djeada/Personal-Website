"""Scratch narration with Kokoro: one WAV per beat.

    HF_HUB_OFFLINE=1 ~/.local/share/soi-tts/bin/python -I tts.py <jobs.json>

jobs.json is {"voice": "am_michael", "speed": 1.0, "jobs": [{"text": "...", "out": "/abs/path.wav"}, ...]}.
The pipeline loads once for all jobs. Output is 24 kHz mono float WAV. American
voices (a*_) use lang_code 'a', British voices (b*_) use 'b'.
"""

import json
import sys

import numpy as np
import soundfile as sf
from kokoro import KPipeline


def main(path):
    with open(path, encoding="utf-8") as handle:
        spec = json.load(handle)
    voice = spec["voice"]
    pipeline = KPipeline(lang_code=voice[0], repo_id="hexgrad/Kokoro-82M")
    for job in spec["jobs"]:
        chunks = [np.asarray(result.audio) for result in pipeline(job["text"], voice=voice, speed=spec.get("speed", 1.0)) if result.audio is not None]
        # Kokoro splits long text into chunks; a short breath between them reads naturally.
        gap = np.zeros(int(24000 * 0.12), dtype=np.float32)
        audio = np.concatenate([part for chunk in chunks for part in (chunk, gap)][:-1])
        sf.write(job["out"], audio, 24000)
        print(f"{job['out']} {len(audio) / 24000:.2f}s", flush=True)


if __name__ == "__main__":
    main(sys.argv[1])
