"""Record every spoken clip of Phonics Adventure with neural voices.

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
VOWELS = set("aeiouyæɛɪɑʌɒɔøœəɜɐAEIOUWY")
# espeak-ng cannot transcribe these words for the German voice.
GERMAN_PRONUNCIATION = {"Gurke": "ɡˈʊɾkə."}
CONTINUANTS = {"s", "z", "ʃ", "f", "v", "θ", "m", "n", "ŋ", "l", "ɹ", "r", "x", "ks"}


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

    def say(self, text, speed=0.88):
        chunks = [audio.numpy() for _, _, audio in self.pipe(text, voice=self.voice, speed=speed)]
        return np.concatenate(chunks)

    def word(self, text, speed=0.88):
        """English voices add a breath before a lone word, so cut the word out of a short carrier."""
        if self.code != "en":
            # The German front end has no word timings, so locate the word by its predicted phoneme lengths.
            carrier = self.pipe.g2p("Okay.")[0] + " "
            word = GERMAN_PRONUNCIATION.get(text) or self.pipe.g2p(text + ".")[0]
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

    def held(self, ps, lengths, speed=0.85):
        """Synthesise phonemes with chosen symbols held for a set number of 25ms frames."""
        import torch
        m = self.model
        with torch.no_grad():
            ids = torch.LongTensor([[0, *[m.vocab[c] for c in ps], 0]]).to(m.device)
            ref = self.voice[len(ps) - 1].to(m.device)
            size = torch.full((1,), ids.shape[-1], device=m.device, dtype=torch.long)
            mask = torch.zeros_like(ids, dtype=torch.bool)
            d_en = m.bert_encoder(m.bert(ids, attention_mask=(~mask).int())).transpose(-1, -2)
            style = ref[:, 128:]
            d = m.predictor.text_encoder(d_en, style, size, mask)
            x, _ = m.predictor.lstm(d)
            durations = torch.round(torch.sigmoid(m.predictor.duration_proj(x)).sum(-1).squeeze() / speed).clamp(min=1).long()
            durations[0] = 4
            for index, count in lengths.items():
                durations[index] = count  # Index 0 is the start token, so symbol k sits at k + 1.
            index = torch.repeat_interleave(torch.arange(ids.shape[1], device=m.device), durations)
            align = torch.zeros((ids.shape[1], index.shape[0]), device=m.device)
            align[index, torch.arange(index.shape[0])] = 1
            align = align.unsqueeze(0)
            f0, noise = m.predictor.F0Ntrain(d.transpose(-1, -2) @ align, style)
            audio = m.decoder(m.text_encoder(ids, size, mask) @ align, f0, noise, ref[:, :128]).squeeze()
        return audio.cpu().numpy(), durations.cpu().numpy()


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


def stretch(audio, factor):
    """Slow a steady sound down without changing its pitch (ffmpeg WSOLA)."""
    chain = []
    while factor > 2:
        chain.append("atempo=0.5")
        factor /= 2
    chain.append(f"atempo={1 / factor:.4f}")
    with tempfile.TemporaryDirectory() as tmp:
        src, dst = Path(tmp, "in.wav"), Path(tmp, "out.wav")
        sf.write(src, audio, SR)
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-af", ",".join(chain), dst], check=True)
        return sf.read(dst, dtype="float32")[0]


def frames(audio, size=240):
    """Per-10ms loudness (dB) and spectral centroid (Hz)."""
    out = []
    for i in range(0, len(audio) - size, size):
        x = audio[i:i + size]
        spectrum = np.abs(np.fft.rfft(x * np.hanning(size)))
        freqs = np.fft.rfftfreq(size, 1 / SR)
        out.append((20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-7), (spectrum * freqs).sum() / (spectrum.sum() + 1e-9)))
    return np.array(out)


def vowel_span(audio):
    """First and last 10ms frame of the carrier vowel: loud and low-pitched in spectrum."""
    f = frames(audio)
    loud = f[:, 0] > f[:, 0].max() - 7
    vowel = np.where(loud & (f[:, 1] < 2500))[0]
    sound = np.where(f[:, 0] > f[:, 0].max() - 45)[0]
    return vowel[0], vowel[-1], sound[0], sound[-1]


def phoneme_clip(voice, ph, code):
    """An isolated letter sound: held for continuants, clipped for stops, plain for vowels.

    The consonant is spoken next to a vowel with its duration stretched inside the
    model, then cut where the vowel begins (or ends, for sounds heard at the end).
    """
    hop = 240
    if ph[0] in VOWELS:
        audio, _ = voice.held("ˈ" + ph, {i + 2: 14 // len(ph) for i in range(len(ph))})
        return fade(trim(audio, pad=0.02), 40)
    if ph in CONTINUANTS:
        if ph in ("ŋ", "x", "ks"):
            audio, d = voice.held("ˈɑ" + ph, {i + 3: 9 for i in range(len(ph))})
            start = d[:3].sum() * FRAME
            part = audio[start:start + d[3:3 + len(ph)].sum() * FRAME + int(0.05 * SR)]
        else:
            audio, d = voice.held(ph + "ˈɑ", {1: 18})
            part = audio[d[0] * FRAME:(d[0] + d[1]) * FRAME - int(0.02 * SR)]
        part = trim(part, pad=0.01, floor=0)
        if len(part) < 0.38 * SR:
            part = stretch(part, 0.42 * SR / len(part))
        return fade(part, 45)
    # Stops and glides need a breath of vowel to be heard; keep it as short as possible.
    keep = 9 if ph in ("h", "w", "j", "kw", "kv") else 6
    if voice.code == "en":
        # The English voice barely releases a stop at the very start, so take it from between two vowels.
        audio, d = voice.held("ə" + ph + "ˈɑ", {})
        f = frames(audio)
        lo = max(0, d[:2].sum() * FRAME // hop - 6)
        hi = (d[:2 + len(ph)].sum() * FRAME) // hop + 6
        dip = lo + int(np.argmin(f[lo:hi, 0]))
        vowel = next(i for i in range(dip + 1, len(f)) if f[i, 0] > f[:, 0].max() - 7 and f[i, 1] < 2500)
        return fade(audio[dip * hop:(vowel + keep) * hop], 20)
    audio, _ = voice.held(ph + "ˈɑ", {})
    first, _, _, _ = vowel_span(audio)
    return fade(trim(audio[max(0, first - 12) * hop:(first + keep) * hop], pad=0.01, floor=0, rel=0.012), 20)


def concat(parts, gap=0.28):
    silence = np.zeros(int(SR * gap), dtype=np.float32)
    out = []
    for part in parts:
        out += [part.astype(np.float32), silence]
    return np.concatenate(out[:-1])


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
    for story in lang["stories"].values():
        for page in story["pages"]:
            for token in re.findall(r"[\w']+", page["text"]):
                tokens.setdefault(word_key(token), token)
    spelled = lang.get("spelling", {})
    for word in sorted(words):
        clips.append((f"w:{word_key(word)}", "word", spelled.get(word, word)))
    for key, token in sorted(tokens.items()):
        if f"w:{key}" not in {c[0] for c in clips}:
            clips.append((f"w:{key}", "word", token))
    for grapheme, ph in lang["phonemes"].items():
        clips.append((f"ph:{grapheme}", "phoneme", ph))
    for grapheme, (example, _) in lang["sounds"].items():
        clips.append((f"in:{grapheme}", "intro", [lang["phonemes"][grapheme], spelled.get(example, example)]))
    for name, text in lang["lines"].items():
        clips.append((f"line:{name}", "line", text))
    for story_id, story in lang["stories"].items():
        for i, page in enumerate(story["pages"]):
            clips.append((f"st:{story_id}:{i}", "story", page["text"]))
    return clips


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
                continue
            entry = None
            if kind == "phoneme":
                audio = phoneme_clip(voice, payload, code)
            elif kind == "intro":
                ph, example = payload
                sound = phoneme_clip(voice, ph, code)
                audio = concat([trim(voice.say(lang["lines"]["listen"])), sound, sound, trim(voice.say(example + "!"))], 0.35)
            else:
                for attempt in range(3):
                    speed = 0.88 - 0.04 * attempt
                    audio = trim(voice.word(payload, speed) if kind == "word" else voice.say(payload, speed))
                    heard, words = listen(audio, code, words=(kind == "story"))
                    # Whisper cannot tell one-syllable homophones apart (bee/B, see/C), so only longer words are checked strictly.
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
