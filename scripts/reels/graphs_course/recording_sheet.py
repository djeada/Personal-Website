import re, sys, pathlib
d = pathlib.Path(sys.argv[1])
out = ["# Graphs for LeetCode: recording sheet", "",
"Narration only, all eight sections. Record one file per section, named like the heading (for example `04-topological-sort.wav`). Read each beat as one take and leave about one second of silence before the next beat; the renderer cuts the recording on those silences. If you stumble, pause, then restart the whole beat. The beat headings are for you, don't read them.",
"", "Shots, code panels and on-screen text are in the full scripts in `scripts/`. This sheet is generated from them by `python3 recording_sheet.py scripts`, so edit the scripts, not this file.", ""]
total = 0
for f in sorted(d.glob("0*.md")):
    text = f.read_text()
    title = text.splitlines()[0].lstrip("# ").strip()
    text = re.sub(r"```.*?```", "", text, flags=re.S)
    beats = re.split(r"^## Beat (\d+)\s*$", text, flags=re.M)
    sec = []
    words = 0
    for i in range(1, len(beats), 2):
        paras = [p.strip() for p in beats[i+1].strip().split("\n\n") if p.strip()]
        paras = [p for p in paras if not p.startswith("On screen") and not p.startswith("- ")]
        narr = " ".join(paras)
        words += len(narr.split())
        sec.append(f"**Beat {beats[i]}.** {narr}")
    total += words
    out += [f"## {f.stem}: {title.split(': ',1)[1]}", "", f"About {words} words, roughly {words/145:.1f} minutes.", ""]
    for s in sec: out += [s, ""]
    print(f"{f.stem}: {words} words, {words/145:.2f} min")
print("total", total, f"{total/145:.1f} min")
(d.parent / "RECORDING.md").write_text("\n".join(out).rstrip() + "\n")
