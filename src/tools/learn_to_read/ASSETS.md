# Phonics Adventure assets

| Path | What it is | Source and licence |
| --- | --- | --- |
| `assets/finn.webp` | Finn the fox, the guide | Original artwork made for this project. |
| `pics/*.webp` | Every picture card, sticker and map mark | [Fluent Emoji 3D](https://github.com/microsoft/fluentui-emoji) by Microsoft, MIT licence. Recentred on equal square canvases by `scripts/phonics/fetch_pictures.py`. |
| `audio/en/*.mp3` | English words, letter names, instructions, sentences and stories | Recorded with [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), voice `af_heart`, Apache-2.0. |
| `audio/de/*.mp3` | German words, letter names, instructions, sentences and stories | Recorded with [kikiri-tts/kikiri-german-victoria](https://huggingface.co/kikiri-tts/kikiri-german-victoria), a Kokoro fine-tune, Apache-2.0. |
| `audio/manifest.js` | Clip file names, lengths and word timings for sentences and stories. Missing-word clips (`cz:`) are the sentence recordings with the answer word silenced. | Written by `scripts/phonics/generate_audio.py`. |

All pictures come from one illustration family on purpose, so cards keep the same size and style. Add a new word by naming its picture in `content.js` (and in `fetch_pictures.py` if it is new), then run both scripts. The audio script records only clips whose text changed and checks each clip with Whisper.
