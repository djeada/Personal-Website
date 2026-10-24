"""Record every spoken clip of Phonics Adventure with neural voices.

Letters are spoken by their names ("em", "ess"; German "Em", "Es").

English uses Kokoro-82M (voice af_heart, Apache-2.0). German uses the
Kokoro-compatible kikiri-tts "Victoria" fine-tune (Apache-2.0). Whisper
large-v3 checks that each clip says what it should and supplies word timings
for the read-along highlight in stories.

Setup (once, outside the repository):
    python3 -m venv ~/phonics-tts
    ~/phonics-tts/bin/pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128
    ~/phonics-tts/bin/pip install kokoro "misaki[en]" soundfile faster-whisper
    # German weights: kikiri-tts/kikiri-german-victoria (pass the folder with --german)
Run from the repository root:
    ~/phonics-tts/bin/python scripts/phonics/generate_audio.py --german /path/to/kikiri-german-victoria

Clips are cached by their text in scripts/phonics/audio_cache.json, so a rerun
only records what changed. Use --force to record everything again.
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[2]
TOOL = ROOT / "src/tools/learn_to_read"
OUT = TOOL / "audio"
CACHE = Path(__file__).with_name("audio_cache.json")
SR = 24000
FRAME = 600  # Kokoro predicts durations in frames of 600 samples.
OVERRIDE = re.compile(r"\[([^\]]+)\]\(/([^/]+)/\)")
# espeak-ng cannot transcribe these words for the German voice.
GERMAN_PRONUNCIATION = {"Gurke": "ɡˈʊɾkə."}


def use_system_espeak():
    """The espeak-ng wheel points at a build-machine path, so borrow the system library."""
    import espeakng_loader
    for lib in ("/usr/lib/x86_64-linux-gnu/libespeak-ng.so.1", "/usr/lib/libespeak-ng.so.1"):
        if Path(lib).exists():
            espeakng_loader.get_library_path = lambda lib=lib: lib
            espeakng_loader.get_data_path = lambda lib=lib: str(Path(lib).parent / "espeak-ng-data")
            return


def slug(text):
    text = text.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def word_key(text):
    return re.sub(r"[^\w]", "", text.lower())


def load_content():
    script = (TOOL / "content.js").read_text()
    node = "const window = {};\n" + script + "\nprocess.stdout.write(JSON.stringify(window.PhonicsContent));"
    return json.loads(subprocess.run(["node", "-e", node], capture_output=True, text=True, check=True).stdout)


def tiles_for(lang, word):
    """Split a word into sound tiles, preferring the longest team at each position."""
    if word in lang.get("tiles", {}):
        return lang["tiles"][word]
    teams = sorted(lang["teams"], key=len, reverse=True)
    out, i, lower = [], 0, word.lower()
    while i < len(word):
        team = next((t for t in teams if lower.startswith(t, i)), None)
        size = len(team) if team else 1
        out.append(word[i:i + size])
        i += size
    return out


class Voice:
    def __init__(self, code, german_dir=None):
        import torch
        self.code = code
        import kokoro.pipeline as kp
        from kokoro import KModel, KPipeline
        self.KPipeline = KPipeline
        if code == "en":
            self.model = KModel().to("cuda").eval()
            self.pipe = KPipeline(lang_code="a", model=self.model)
            self.voice = self.pipe.load_voice("af_heart")
        else:
            german = Path(german_dir)
            fixed = german / "victoria_kokoro.pth"
            if not fixed.exists():
                # The fine-tune stores weight-norm tensors under the newer parametrization names.
                state = torch.load(german / "kikiri_german_victoria_ep10.pth", map_location="cpu")
                rename = lambda k: k.replace("parametrizations.weight.original0", "weight_g").replace("parametrizations.weight.original1", "weight_v")
                torch.save({part: {rename(k): v for k, v in sd.items()} for part, sd in state.items()}, fixed)
            from huggingface_hub import hf_hub_download
            config = hf_hub_download("hexgrad/Kokoro-82M", "config.json")
            self.model = KModel(repo_id="hexgrad/Kokoro-82M", config=config, model=str(fixed)).to("cuda").eval()
            kp.LANG_CODES["d"] = "de"
            self.pipe = KPipeline(lang_code="d", model=self.model)
            self.voice = torch.load(german / "voices/victoria.pt", map_location="cpu")

    def german_phonemes(self, text):
        """espeak has no inline pronunciations, so splice the [Name](/ipa/) parts in by hand."""
        out, pos = [], 0
        for match in OVERRIDE.finditer(text):
            if text[pos:match.start()].strip(" "):
                out.append(self.pipe.g2p(text[pos:match.start()])[0].strip())
            out.append(match.group(2))
            pos = match.end()
        if text[pos:].strip(" "):
            out.append(self.pipe.g2p(text[pos:])[0].strip())
        return " ".join(part for part in out if part)

    def say(self, text, speed=0.88):
        if self.code != "en" and OVERRIDE.search(text):
            return self.KPipeline.infer(self.model, self.german_phonemes(text), self.voice, speed).audio.cpu().numpy()
        chunks = [audio.numpy() for _, _, audio in self.pipe(text, voice=self.voice, speed=speed)]
        return np.concatenate(chunks)

    def word(self, text, speed=0.88):
        """English voices add a breath before a lone word, so cut the word out of a short carrier."""
        if self.code != "en":
            # The German front end has no word timings, so locate the word by its predicted phoneme lengths.
            carrier = self.pipe.g2p("Okay.")[0] + " "
            word = GERMAN_PRONUNCIATION.get(text) or (self.german_phonemes(text) + "." if OVERRIDE.search(text) else self.pipe.g2p(text + ".")[0])
            out = self.KPipeline.infer(self.model, carrier + word, self.voice, speed)
            start = np.cumsum(out.pred_dur.cpu().numpy())[len(carrier)] * FRAME
            return out.audio.cpu().numpy()[max(0, start - int(0.05 * SR)):]
        spoken = "[a](/ɐ/)" if text.lower() == "a" else text[0].upper() + text[1:]
        results = list(self.pipe(f"Okay. {spoken}.", voice=self.voice, speed=speed))
        audio = np.concatenate([r.audio.numpy() for r in results])
        tokens = [t for r in results for t in r.tokens]
        stop = next(i for i, t in enumerate(tokens) if t.text == ".")
        span = [t for t in tokens[stop + 1:] if re.search(r"\w", t.text)]
        return audio[int(max(0, span[0].start_ts - 0.05) * SR):int((span[-1].end_ts + 0.12) * SR)]


def trim(audio, pad=0.04, floor=0.012, rel=0.04):
    level = np.abs(audio)
    loud = np.where(level > max(floor, level.max() * rel))[0]
    if not len(loud):
        return audio
    start = max(0, loud[0] - int(pad * SR))
    end = min(len(audio), loud[-1] + int(pad * SR))
    return audio[start:end]


def fade(audio, ms=25):
    n = min(len(audio) // 3, int(SR * ms / 1000))
    if n:
        ramp = np.linspace(0, 1, n)
        audio = audio.copy()
        audio[:n] *= ramp
        audio[-n:] *= ramp[::-1]
    return audio


def encode(audio, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    peak = np.abs(audio).max() or 1
    audio = audio / peak * 0.89
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp, "clip.wav")
        sf.write(wav, audio, SR)
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", wav, "-ac", "1", "-ar", "24000",
                        "-codec:a", "libmp3lame", "-b:a", "48k", path], check=True)
    return round(len(audio) / SR, 2)


def plan(code, lang):
    """Every clip as (id, kind, payload)."""
    clips = []
    words = set(lang["pictures"]) | {example for example, _ in lang["sounds"].values()}
    tokens = {}
    texts = [page["text"] for story in lang["stories"].values() for page in story["pages"]] + [s["text"] for s in lang["sentences"]]
    for text in texts:
        for token in re.findall(r"[\w']+", text):
            tokens.setdefault(word_key(token), token)
    for story in lang["stories"].values():
        for question in story["questions"]:
            words.update([question["answer"], *question["others"]])
    spelled = lang.get("spelling", {})
    for word in sorted(words):
        clips.append((f"w:{word_key(word)}", "word", spelled.get(word, word)))
    for key, token in sorted(tokens.items()):
        if f"w:{key}" not in {c[0] for c in clips}:
            clips.append((f"w:{key}", "word", token))
    # Letters are spoken by their names ("em", "ess"); teams are spelled letter by letter.
    for grapheme, name in lang["names"].items():
        clips.append((f"ph:{grapheme}", "name", name))
    for grapheme, (example, _) in lang["sounds"].items():
        text = lang["introTemplate"].replace("{name}", lang["names"][grapheme]).replace("{word}", spelled.get(example, example))
        clips.append((f"in:{grapheme}", "intro", text))
    for name, text in lang["lines"].items():
        clips.append((f"line:{name}", "line", text))
    for story_id, story in lang["stories"].items():
        for i, page in enumerate(story["pages"]):
            clips.append((f"st:{story_id}:{i}", "story", page["text"]))
        for i, question in enumerate(story["questions"]):
            clips.append((f"q:{story_id}:{i}", "line", question["text"]))
    # Sentence clips also yield a copy with the answer word silenced, for "which word is missing?".
    for i, item in enumerate(lang["sentences"]):
        clips.append((f"sn:{i}", "sentence", [item["text"], item["answer"]]))
    return clips


def i_slug(clip_id):
    return slug(clip_id.partition(":")[2].replace(":", "-"))


def similar(heard, expected):
    norm = lambda s: re.sub(r"[^\w]", "", s.lower().replace("-", ""))
    a, b = norm(heard), norm(expected)
    return a == b or (len(b) > 3 and (a in b or b in a))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--german", required=True, help="folder with the kikiri-german-victoria files")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--only", choices=["en", "de"])
    args = parser.parse_args()
    use_system_espeak()
    import torch
    import torchaudio
    from faster_whisper import WhisperModel
    whisper = WhisperModel("large-v3", device="cuda", compute_type="float16")

    def listen(audio, code, words=False):
        audio16 = torchaudio.functional.resample(torch.from_numpy(audio.astype(np.float32)), SR, 16000).numpy()
        pad = np.zeros(8000, dtype=np.float32)  # Whisper hears short clips better with a little silence around them.
        segments, _ = whisper.transcribe(np.concatenate([pad, audio16, pad]), language=code, beam_size=5, word_timestamps=words)
        segments = list(segments)
        found = [w for s in segments for w in (s.words or [])]
        for w in found:
            w.start, w.end = max(0.0, w.start - 0.5), max(0.0, w.end - 0.5)
        return " ".join(s.text.strip() for s in segments), found

    content = load_content()
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    manifest_path = OUT / "manifest.js"
    old = {}
    if manifest_path.exists():
        old = json.loads(manifest_path.read_text().split("=", 1)[1].rstrip().rstrip(";"))
    manifest = {}
    problems = []
    for code in ("en", "de"):
        lang = content[code]
        manifest[code] = {}
        if args.only and args.only != code:
            manifest[code] = old.get(code, {})
            continue
        voice = Voice(code, args.german)
        for clip_id, kind, payload in plan(code, lang):
            kind_prefix, _, rest = clip_id.partition(":")
            name = f"{kind_prefix}-{slug(rest.replace(':', '-'))}.mp3"
            path = OUT / code / name
            digest = hashlib.sha1(json.dumps([kind, payload, 3]).encode()).hexdigest()[:12]
            key = f"{code}/{clip_id}"
            if not args.force and cache.get(key) == digest and path.exists() and clip_id in old.get(code, {}):
                manifest[code][clip_id] = old[code][clip_id]
                if kind == "sentence" and f"cz:{clip_id[3:]}" in old.get(code, {}):
                    manifest[code][f"cz:{clip_id[3:]}"] = old[code][f"cz:{clip_id[3:]}"]
                    continue
                if kind != "sentence":
                    continue
            entry = None
            if kind == "name":
                audio = fade(trim(voice.word(payload)), 15)
                print("name", code, clip_id, "heard", listen(audio, code)[0])
            elif kind == "sentence":
                text, answer = payload
                tokens = re.findall(r"\S+", text)
                for attempt in range(3):
                    audio = trim(voice.say(text, 0.88 - 0.04 * attempt))
                    heard, words = listen(audio, code, words=True)
                    if similar(heard, text) and len(words) == len(tokens):
                        break
                else:
                    problems.append(f"{code} {clip_id}: expected {text!r}, heard {heard!r} ({len(words)} words)")
                starts = [round(w.start, 2) for w in words] if len(words) == len(tokens) else None
                if starts is None:
                    total, lengths = len(audio) / SR, [len(t) + 2 for t in tokens]
                    starts = [round(total * sum(lengths[:i]) / sum(lengths), 2) for i in range(len(tokens))]
                entry = starts
                # Silence the answer word from its start to the next word, with short fades either side.
                index = next(i for i, token in enumerate(tokens) if word_key(token) == word_key(answer))
                gap = audio.copy()
                lo = int(max(0, starts[index] - 0.02) * SR)
                hi = int((starts[index + 1] - 0.03) * SR) if index + 1 < len(tokens) else len(audio)
                gap[lo:hi] = 0
                gap[max(0, lo - 240):lo] *= np.linspace(1, 0, len(gap[max(0, lo - 240):lo]))
                cloze_name = f"cz-{i_slug(clip_id)}.mp3"
                manifest[code][f"cz:{clip_id[3:]}"] = [cloze_name, encode(gap, OUT / code / cloze_name)]
            else:
                for attempt in range(3):
                    speed = 0.88 - 0.04 * attempt
                    audio = trim(voice.word(payload, speed) if kind == "word" else voice.say(payload, speed))
                    heard, words = listen(audio, code, words=(kind == "story"))
                    # Whisper cannot tell one-syllable homophones apart (bee/B, see/C), and intros contain
                    # letter names written as phonemes, so those are only printed for a listen-through.
                    if kind == "intro":
                        print("intro", code, clip_id, "heard", heard)
                        break
                    if similar(heard, payload) or (kind == "word" and len(payload) <= 3):
                        break
                else:
                    problems.append(f"{code} {clip_id}: expected {payload!r}, heard {heard!r}")
                if kind == "story":
                    tokens = re.findall(r"\S+", payload)
                    if len(words) == len(tokens):
                        entry = [round(w.start, 2) for w in words]
                    else:
                        # Fall back to spreading the words by length when Whisper merges or splits them.
                        total, lengths = len(audio) / SR, [len(t) + 2 for t in tokens]
                        entry = [round(total * sum(lengths[:i]) / sum(lengths), 2) for i in range(len(tokens))]
                        problems.append(f"{code} {clip_id}: approximate word timings")
            duration = encode(audio, path)
            manifest[code][clip_id] = [name, duration] + ([entry] if entry else [])
            cache[key] = digest
            print("recorded", code, clip_id, duration)
        del voice
        torch.cuda.empty_cache()
    # Drop files that no clip uses any more.
    for code in ("en", "de"):
        used = {entry[0] for entry in manifest[code].values()}
        for file in (OUT / code).glob("*.mp3"):
            if file.name not in used:
                file.unlink()
    manifest_path.write_text("window.PhonicsAudio = " + json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + ";\n")
    CACHE.write_text(json.dumps(cache, indent=0, sort_keys=True))
    print("\n".join(problems) or "All clips verified.")


if __name__ == "__main__":
    sys.exit(main())
