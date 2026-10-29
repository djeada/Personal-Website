"""Build the noun list for the Der Die Das trainer (src/tools/der_die_das/words.json).

Genders, plurals and English meanings come from Wiktionary through the kaikki.org
extracts (CC BY-SA 4.0); frequency ranks come from the OpenSubtitles 2018 list in
hermitdave/FrequencyWords (CC BY-SA 4.0). Downloads are cached in
scripts/.source-cache/der_die_das/. Levels 1 and 2 are the curated lists in
der_die_das_levels.json; levels 3 and 4 are the next most frequent nouns.
der_die_das_meanings.json replaces Wiktionary's meaning where a learner needs a
plainer one.

Run by hand when the list should change:

    python3 scripts/build_der_die_das_data.py [--limit 6000] [--report]
"""

import argparse
import json
import logging
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "scripts/.source-cache/der_die_das"
LEVELS = ROOT / "scripts/der_die_das_levels.json"
OUTPUT = ROOT / "src/tools/der_die_das/words.json"
KAIKKI = "https://kaikki.org/dictionary/German/pos-{0}/kaikki.org-dictionary-German-by-pos-{0}.jsonl"
FREQUENCY_URL = "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/{0}/{0}_50k.txt"
CLOSED_POS = (
    "adv",
    "pron",
    "prep",
    "conj",
    "particle",
    "intj",
    "det",
    "num",
    "article",
)
OPEN_POS = ("verb", "adj")
COMMON_RANK = 6000
ENGLISH_RANK = 20000
ENGLISH_PENALTY = 3
LEVEL_3_SIZE = 2000

WORD_RE = re.compile(
    r"^[A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ]?[a-zäöüß]+)*$|^[A-Z]-[A-ZÄÖÜ][a-zäöüß]+$"
)
GENDER_RE = re.compile(r"^([mfnp])(?:\.[a-z_]+)*(?:\[(.*)\])?$")
REGIONAL_RE = re.compile(
    r"Austria|Switzerland|Swiss|Southern|South Tyrol|Bavaria|Luxembourg|regional|dialect",
    re.I,
)
STANDARD_QUALIFIERS = re.compile(
    r"^(?:|Germany|predominantly|standard|more common|common)$", re.I
)
REGION_TAGS = {
    "Austria": "Austria",
    "Switzerland": "Switzerland",
    "Southern-Germany": "southern Germany",
    "South-Tyrol": "South Tyrol",
    "Bavaria": "Bavaria",
}
SKIP_SENSE_TAGS = {
    "form-of",
    "alt-of",
    "abbreviation",
    "initialism",
    "acronym",
    "obsolete",
    "archaic",
    "dated",
    "rare",
    "dialectal",
    "literary",
    "poetic",
    "misspelling",
    "nonstandard",
}
BLOCK_SENSE_TAGS = {"vulgar", "offensive", "derogatory", "slur", "ethnic"}
BAD_FORM_TAGS = {
    "nonstandard",
    "uncommon",
    "rare",
    "archaic",
    "dated",
    "obsolete",
    "colloquial",
    "dialectal",
    "poetic",
    "diminutive",
}
DERIVATION_TAGS = {"agent", "noun-from-verb", "gerund"}
REGIONAL_ONLY_RE = re.compile(r"northern|western|eastern|southern|Germany", re.I)
MEANINGS = ROOT / "scripts/der_die_das_meanings.json"
CASE_TAGS = {"nominative", "genitive", "dative", "accusative", "definite", "indefinite"}

DENY = {
    "Aber",
    "Anderen",
    "Mama",
    "Papa",
    "Mami",
    "Papi",
    "Dad",
    "Daddy",
    "Mom",
    "Mommy",
    "Sir",
    "Madam",
    "Miss",
    "Mister",
    "Lady",
    "Honey",
    "Darling",
    "Okay",
    "Hey",
    "Colonel",
    "County",
    "Lawra",
    "Alt",
    "Selbst",
    "Ganze",
    "Gute",
    "Innere",
    "Gehen",
    "Halten",
    "Lachen",
    "Laufen",
    "Lesen",
    "Parken",
    "Schießen",
    "Schlafen",
    "Schwimmen",
    "Tanzen",
    "Trinken",
    "Weinen",
    "Wegwerfen",
    "Klopfen",
    "Kochen",
    "Atmen",
    "Ablehnen",
    "Denken",
    "Reisen",
    "Englisch",

    "Nutte",
    "Kacke",
    "Muschi",
    "Fotze",
    "Willi",
    "Pisser",
    "Pimmel",
    "Scheißhaufen",
    "Zigeunerin",
    "Zigeuner",
    "Dreckloch",
    "Luder",
    "Schweinehund",
    "Furz",
    "Arschloch",
    "Hure",
    "Schlampe",
    "Wichser",
    "Hurensohn",
    "Miststück",
    "Mistkerl",
    "Arsch",

    "Henry",
    "Lee",
    "Kate",
    "Tommy",
    "Marie",
    "Klaus",
    "Molly",
    "Maya",
    "Hugo",
    "Ethan",
    "Steven",
    "Benjamin",
    "Grant",
    "Leo",
    "Matt",
    "Charlotte",
    "Penny",
    "Yang",
    "Manhattan",
    "My",
    "Are",
    "Be",
    "Out",
    "First",
    "Girl",
    "Boy",
    "Kid",
    "Doctor",
    "Football",
    "Lake",
    "Green",
    "Hall",
    "House",
    "City",
    "Queen",
    "Master",
    "Gentleman",
    "Media",
    "Like",
    "Top",
    "German",
    "Mum",
    "Lord",
    "Madame",
    "Sheriff",
    "Penis",
}

CORE_VERBS = {
    "sein",
    "haben",
    "werden",
    "können",
    "müssen",
    "sollen",
    "wollen",
    "dürfen",
    "mögen",
    "wissen",
    "machen",
    "sagen",
    "gehen",
    "kommen",
    "sehen",
    "geben",
    "lassen",
    "stehen",
    "finden",
    "bleiben",
    "liegen",
    "glauben",
    "denken",
    "tun",
    "warten",
    "suchen",
    "schauen",
    "halten",
    "sprechen",
    "nehmen",
    "bringen",
    "heißen",
    "hören",
    "fragen",
    "brauchen",
    "helfen",
    "hassen",
    "sitzen",
    "legen",
    "setzen",
    "stellen",
    "zeigen",
}


KEEP_DESPITE_COLLISION = {
    "Abend",
    "Arm",
    "Arbeit",
    "Essen",
    "Frage",
    "Glaube",
    "Leben",
    "Liebe",
    "Macht",
    "Morgen",
    "Recht",
    "Rede",
    "Ruhe",
    "Sorge",
    "Weg",
    "Wissen",
    "Wert",
    "Ernst",
    "Schuld",
    "Laden",
    "Rat",
    "Ruf",
    "Halt",
    "Suche",
    "Würde",
    "Tat",
    "Pass",
    "Antwort",
    "Hilfe",
    "Reise",
    "Miete",
    "Schule",
    "Ende",
    "Spiel",
    "Kampf",
    "Fang",
    "Spaß",
    "Dank",
    "Lauf",
    "Fall",
    "Grund",
    "Stand",
    "Zug",
    "Blick",
    "Schutz",
    "Mittag",
    "Ordnung",
    "Wunsch",
    "Kuss",
    "Schluss",
    "Sieg",
    "Streit",
    "Bitte",
    "Punkt",
    "Paar",
    "Ei",
    "Teil",
    "Art",
    "Stimme",
    "Stunde",
    "Mark",
    "See",
    "Mitte",
    "Engel",
    "Hotel",
    "Taxi",
    "Team",
    "Party",
    "Show",
    "Film",
    "Bank",
    "Ball",
    "Kind",
    "Hand",
    "Finger",
    "Name",
    "Problem",
    "Wolf",
    "Rose",
    "Hut",
    "Agent",
    "Major",
    "Rate",
    "Achtung",
    "Angriff",
    "Befehl",
    "Bombe",
    "Ehre",
    "Falle",
    "Fest",
    "Folge",
    "Gewissen",
    "Gnade",
    "Grad",
    "Hexe",
    "Kauf",
    "Kugel",
    "Leid",
    "Nähe",
    "Not",
    "Reich",
    "Schrei",
    "Stelle",
    "Sucht",
    "Unrecht",
    "Unterricht",
    "Versteck",
    "Vorsicht",
    "Wache",
    "Wahnsinn",
    "Wette",
    "Zahl",
    "Grab",
    "Null",
    "Klappe",
    "Weise",
    "Liter",
}


HOMOGRAPHS = {
    "See",
    "Leiter",
    "Band",
    "Schild",
    "Steuer",
    "Kiefer",
    "Golf",
    "Gehalt",
    "Erbe",
    "Laster",
    "Bund",
    "Verdienst",
    "Mark",
    "Stift",
    "Tau",
    "Otter",
    "Lama",
    "Pony",
    "Bauer",
    "Mangel",
    "Heide",
    "Service",
    "Moment",
    "Gummi",
}

HOMOGRAPH_FIRST = {
    "Gehalt": "n",
    "Band": "f",
    "Laster": "m",
    "Bauer": "m",
    "Stift": "m",
}

ARTICLE_OVERRIDES = {
    "Monat": "m",
    "Konsulat": "n",
    "Zimt": "m",
    "Magistrat": "m",
    "Oberteil": "n",
    "Körperteil": "m",
    "Schutzschild": "m",
    "Volleyball": "m",
    "Pfand": "n",
    "Gong": "m",
    "Comic": "m",
    "Alzheimer": "m",
    "Plunder": "m",
    "Zimmerservice": "m",
    "Karaoke": "n",
}

SAME_WORD = {"Teil"}


def source(name: str, url: str) -> Path:
    path = CACHE / name
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        logging.info("Downloading %s", url)
        urllib.request.urlretrieve(url, path)
    return path


def split_top(text: str, sep: str) -> list:
    """Split on sep outside [brackets]."""
    parts, depth, current = [], 0, []
    for char in text:
        depth += char == "["
        depth -= char == "]"
        if char == sep and depth == 0:
            parts.append("".join(current))
            current = []
        else:
            current.append(char)
    parts.append("".join(current))
    return parts


def parse_genders(spec: str) -> list:
    """'m[Germany]:n[Austria, Switzerland],s,s' -> [('m', 'Germany'), ('n', 'Austria, Switzerland')].

    The newer '((<m,,en.weak_n>,<m,,n.weak>))' form lists whole declensions; the first one counts.
    """
    nested = re.search(r"<([^<>]*)>", spec)
    if spec.startswith("((") and nested:
        spec = nested.group(1)
    out = []
    for alternative in split_top(split_top(spec, ",")[0], ":"):
        match = GENDER_RE.match(alternative.strip())
        if match:
            out.append((match.group(1), (match.group(2) or "").strip()))
    return out


def fold(text: str) -> str:
    return text.lower().translate(str.maketrans("äöüß", "aous"))


def fix_plural(word: str, plural: str) -> str:
    """Wiktionary sometimes gives a compound only the plural of its last part."""
    if plural in ("", "-") or fold(plural)[:2] == fold(word)[:2]:
        return plural
    for start in range(1, len(word) - 2):
        tail = word[start:]
        if fold(tail)[:2] == fold(plural)[:2] and abs(len(tail) - len(plural)) <= 3:
            return word[:start] + plural.lower()
    return ""


def clean_gloss(gloss: str) -> str:
    """Short learner-friendly meaning: up to three plain items, e.g. 'hint, clue, pointer'."""
    gloss = re.sub(r"^(?:female|male) equivalent of [^:]+:\s*", "", gloss)
    gloss = re.sub(
        r"^(?:agent noun of|gerund of|verbal noun of) \S+[;:,]?\s*", "", gloss
    )
    for _ in range(2):
        gloss = re.sub(r"\s*[(\[][^()\[\]]*[)\]]", "", gloss)
    items = []
    for item in re.split(r"[;,]", gloss):
        item = re.sub(r"\s+", " ", item).strip(" .:…")
        item = re.sub(r"^(?:an?|the) (?=[a-z])", "", item, flags=re.I)
        if not item or re.search(
            r"\bsee\b|usage|e\.g\.|\betc\b|includ|specific|^or\b|^and\b|\bor$|^(?:one|someone|something|that|a person) (?:who|which|that)",
            item,
        ):
            continue
        if len(item.split()) >= 4:
            item = re.split(
                r" (?:of|as|for|that|which|where|who|taken|with|used|or anything) ",
                item,
            )[0]
        if (
            len(item.split()) > 1
            and re.match(r"[A-Z][a-z]+ [a-z]+(?: [a-z]+)?$", item)
            and items
        ):
            continue
        items.append(item)
    if not items:
        return ""
    chosen = [item for item in items if len(item.split()) <= 3] or items[:1]
    gloss = chosen[0]
    for item in chosen[1:3]:
        if len(gloss) + len(item) + 2 > 36:
            break
        gloss += ", " + item
    if (
        gloss[:1].isupper()
        and gloss[1:2].islower()
        and not re.match(r"(?:American|English|German|European|French)\b", gloss)
    ):
        gloss = gloss[0].lower() + gloss[1:]
    if len(gloss) > 48:
        gloss = gloss[:46].rsplit(" ", 1)[0] + "…"
    return gloss


def read_other_forms(ranks: dict, noun_forms: set) -> tuple:
    """Spellings of German function words, forms of common verbs and adjectives, and verbs.

    A verb or adjective counts as common when its own spelling ranks high and is not
    also an inflected noun: "herzen" ranks high only because it is the plural of Herz.
    """
    closed, common, verbs = set(), set(), set()
    for pos in CLOSED_POS + OPEN_POS:
        with source(f"de-{pos}.jsonl", KAIKKI.format(pos)).open(
            encoding="utf-8"
        ) as handle:
            for line in handle:
                entry = json.loads(line)
                lemma = entry.get("word", "").lower()
                if entry.get("lang_code") != "de" or " " in lemma:
                    continue
                forms = {lemma} | {
                    f.get("form", "").lower()
                    for f in entry.get("forms", [])
                    if " " not in f.get("form", " ")
                }
                if pos == "verb":
                    verbs.add(lemma)
                if pos in CLOSED_POS:
                    closed |= forms
                elif lemma in CORE_VERBS or (
                    ranks.get(lemma, 10**9) <= COMMON_RANK and lemma not in noun_forms
                ):
                    common |= forms
    return closed, common, verbs


def pick_gloss(senses: list, strict: bool):
    """First usable meaning; strict mode also skips senses tagged rare, dated and the like."""
    for sense in senses:
        tags = set(sense.get("tags", []))
        glosses = sense.get("glosses") or []
        if not glosses or tags & BLOCK_SENSE_TAGS:
            continue
        if "form-of" in tags and not tags & DERIVATION_TAGS:
            continue
        if tags & {"alt-of", "abbreviation", "initialism", "acronym", "misspelling"}:
            continue
        if strict and tags & (SKIP_SENSE_TAGS - {"form-of"}):
            continue
        derived = re.match(
            r"(?:agent noun|verbal noun|gerund|female equivalent|male equivalent) of",
            glosses[0],
        )
        gloss = clean_gloss(glosses[-1] if derived or len(glosses) == 1 else glosses[0])
        if gloss and not re.match(
            r"(?:agent|verbal) noun of \S+$|gerund of \S+$", gloss
        ):
            return gloss
    return ""


def read_entry(entry: dict):
    head = next(
        (h for h in entry.get("head_templates", []) if h.get("name") == "de-noun"), None
    )
    if not head:
        return None
    genders = parse_genders(head.get("args", {}).get("1", ""))
    if not genders or any(letter == "p" for letter, _ in genders):
        return None
    senses = entry.get("senses", [])
    primary, variants = [], {}
    for letter, qualifier in genders:
        if STANDARD_QUALIFIERS.match(qualifier):
            primary.append(letter)
        elif REGIONAL_RE.search(qualifier):
            variants[letter] = qualifier
    if not primary and genders and all(REGIONAL_ONLY_RE.search(q) for _, q in genders):
        first_tags = set(senses[0].get("tags", [])) if senses else set()
        primary = [letter for letter, _ in genders]
        primary += [
            l
            for l, name in (("m", "masculine"), ("f", "feminine"), ("n", "neuter"))
            if name in first_tags
        ]
    if not primary:
        return None

    first = next((s for s in senses if s.get("glosses")), {})
    if set(first.get("tags", [])) & BLOCK_SENSE_TAGS:
        return None
    for sense in senses:
        tags = set(sense.get("tags", []))
        regions = [name for tag, name in REGION_TAGS.items() if tag in tags]
        for letter, name in (("m", "masculine"), ("f", "feminine"), ("n", "neuter")):
            if (
                name in tags
                and letter not in primary
                and "regional" in tags
                and regions
            ):
                variants.setdefault(letter, ", ".join(regions))
    gloss = pick_gloss(senses, True) or pick_gloss(senses, False)
    if not gloss:
        return None

    word = entry["word"]
    plural, nominative_plural, forms = "", "", set()
    expansion = head.get("expansion", "")
    if "no plural" in expansion or "uncountable" in expansion:
        plural = "-"
    for form in entry.get("forms", []):
        tags = set(form.get("tags", []))
        text = form.get("form", "")
        if (
            len(text) < 3
            or " " in text
            or tags & BAD_FORM_TAGS
            or not tags & {"plural", "genitive"}
        ):
            continue
        if fold(text)[:2] == fold(word)[:2]:
            forms.add(text.lower())
        if not plural and "plural" in tags and not tags & CASE_TAGS:
            plural = fix_plural(word, text)
        if not nominative_plural and {"plural", "nominative"} <= tags:
            nominative_plural = text
    plural = plural or fix_plural(word, nominative_plural)
    return {
        "primary": "".join(dict.fromkeys(primary)),
        "variants": {k: v for k, v in variants.items() if k not in primary},
        "gloss": gloss,
        "plural": plural,
        "forms": forms,
    }


def read_ranks(language: str) -> dict:
    ranks = {}
    with source(f"{language}_50k.txt", FREQUENCY_URL.format(language)).open(
        encoding="utf-8"
    ) as handle:
        for index, line in enumerate(handle, start=1):
            ranks.setdefault(line.split(" ", 1)[0], index)
    return ranks


def build(limit: int, report: bool = False) -> list:
    ranks = read_ranks("de")
    english = {word for word, rank in read_ranks("en").items() if rank <= ENGLISH_RANK}
    anchors = json.loads(LEVELS.read_text(encoding="utf-8"))
    meanings = json.loads(MEANINGS.read_text(encoding="utf-8"))
    anchor_level = {word: 1 for word in anchors["essentials"]}
    anchor_level.update(
        {word: 2 for word in anchors["core"] if word not in anchor_level}
    )

    lemmas = {}
    with source("de-nouns.jsonl", KAIKKI.format("noun")).open(
        encoding="utf-8"
    ) as handle:
        for line in handle:
            entry = json.loads(line)
            word = entry.get("word", "")
            if (
                entry.get("lang_code") == "de"
                and WORD_RE.match(word)
                and word not in DENY
            ):
                parsed = read_entry(entry)
                if parsed:
                    lemmas.setdefault(word, []).append(parsed)
    owners = {}
    for word, entries in lemmas.items():
        for form in {f for e in entries for f in e["forms"]} | {word.lower()}:
            owners.setdefault(form, set()).add(word)
    protected = set(anchor_level) | KEEP_DESPITE_COLLISION
    inflected = {
        form for form, words in owners.items() if any(w.lower() != form for w in words)
    }
    closed, common, verbs = read_other_forms(
        ranks,
        {
            form
            for form in inflected
            if owners[form] & protected
            and not owners[form] & {f.capitalize() for f in [form]}
        },
    )
    other = closed | common

    dropped = []
    candidates = []
    for word, entries in lemmas.items():
        lower = word.lower()
        evidence = [
            ranks[f]
            for e in entries
            for f in e["forms"]
            if f in ranks
            and f != lower
            and f != lower + "s"
            and owners[f] == {word}
            and f not in other
            and f not in english
        ]
        collides = lower in other and word not in KEEP_DESPITE_COLLISION
        keep = word in KEEP_DESPITE_COLLISION
        if word in anchor_level:
            rank = (
                min(evidence, default=10**5)
                if collides
                else ranks.get(lower) or min(evidence, default=10**6)
            )
        elif word.endswith("en") and lower in verbs and not keep:
            continue
        elif lower in inflected and owners[lower] - {word} and not keep:
            continue
        elif collides:
            if not evidence:
                if ranks.get(lower, 10**9) < 3000:
                    dropped.append(word)
                continue
            rank = min(evidence)
        else:
            rank = ranks.get(lower) or min(evidence, default=None)
        if rank is None:
            continue
        if lower in english and word not in anchor_level and not keep:
            rank *= ENGLISH_PENALTY
        if word in SAME_WORD:
            merged = dict(
                entries[0],
                primary="".join(dict.fromkeys("".join(e["primary"] for e in entries))),
            )
            entries = [merged]
        elif word not in HOMOGRAPHS:
            entries = entries[:1]
        else:
            first = HOMOGRAPH_FIRST.get(word)
            entries = (
                sorted(entries, key=lambda e: e["primary"] != first)
                if first
                else entries
            )
            seen, unique = set(), []
            for entry in entries:
                if entry["primary"] not in seen:
                    seen.add(entry["primary"])
                    unique.append(entry)
            entries = unique
        for index, entry in enumerate(entries):
            candidates.append((word, index, len(entries), rank, entry))

    def order(candidate):
        word, index, _, rank, _ = candidate
        level = anchor_level.get(word, 3) if index == 0 else 3
        return (level, rank if index == 0 else rank * 4, word)

    candidates.sort(key=order)
    items, level_3_count = [], 0
    for word, index, count, rank, entry in candidates:
        level = anchor_level.get(word, 3) if index == 0 else 3
        if level >= 3:
            level_3_count += 1
            level = 3 if level_3_count <= LEVEL_3_SIZE else 4
        articles = ARTICLE_OVERRIDES.get(word) or "".join(
            sorted(entry["primary"], key="mfn".index)
        )
        meaning = (
            meanings.get(f"{word}|{articles}")
            or (meanings.get(word) if index == 0 else None)
            or entry["gloss"]
        )
        row = [word, articles, entry["plural"], meaning, level]
        extra = {}
        if entry["variants"]:
            extra["v"] = "".join(sorted(entry["variants"], key="mfn".index))
            extra["vn"] = next(iter(entry["variants"].values()))
        if count > 1:
            extra["d"] = 1
        if articles == "n" and word.endswith("en") and word.lower() in verbs:
            extra["i"] = 1
        if extra:
            row.append(extra)
        items.append(row)
        if len(items) >= limit:
            break

    if report:
        missing = sorted(set(anchor_level) - {row[0] for row in items})
        logging.info("Anchors not used (%d): %s", len(missing), " ".join(missing))
        logging.info("Dropped as other parts of speech: %s", " ".join(sorted(dropped)))
    return items


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--limit", type=int, default=6000, help="number of nouns to keep"
    )
    parser.add_argument(
        "--report", action="store_true", help="list curated words that were left out"
    )
    args = parser.parse_args()
    items = build(args.limit, args.report)
    payload = {
        "source": "Wiktionary via kaikki.org (CC BY-SA 4.0); frequency from OpenSubtitles 2018 via FrequencyWords (CC BY-SA 4.0)",
        "fields": [
            "word",
            "articles",
            "plural",
            "meaning",
            "level",
            "extra: v=regional article, vn=where, d=homograph, i=verb used as noun",
        ],
        "words": items,
    }
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    OUTPUT.write_text(text.replace('],["', '],\n["') + "\n", encoding="utf-8")
    levels = {
        level: sum(1 for row in items if row[4] == level) for level in (1, 2, 3, 4)
    }
    logging.info(
        "%d nouns, levels %s, %d with several articles, written to %s",
        len(items),
        levels,
        sum(1 for row in items if len(row[1]) > 1),
        OUTPUT.relative_to(ROOT),
    )


if __name__ == "__main__":
    main()
