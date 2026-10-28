"""Download the Phonics Adventure picture set (Fluent Emoji 3D, MIT) as WebP.

Every picture in the game comes from this one illustration family so that the
cards look the same size and style. Run from the repository root:
    python3 scripts/phonics/fetch_pictures.py
"""

import io
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

OUT = Path("src/tools/learn_to_read/pics")
TREE = (
    "https://api.github.com/repos/microsoft/fluentui-emoji/git/trees/main?recursive=1"
)
RAW = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/"

PICTURES = {
    "sun": "Sun",
    "apple": "Red apple",
    "tiger": "Tiger",
    "pig": "Pig",
    "insect": "Lady beetle",
    "nest": "Nest with eggs",
    "mouse": "Mouse",
    "dog": "Dog",
    "goat": "Goat",
    "octopus": "Octopus",
    "cat": "Cat",
    "kite": "Kite",
    "egg": "Egg",
    "umbrella": "Umbrella",
    "rabbit": "Rabbit",
    "horse": "Horse",
    "bear": "Bear",
    "fish": "Tropical fish",
    "lion": "Lion",
    "jellyfish": "Jellyfish",
    "violin": "Violin",
    "whale": "Spouting whale",
    "fox": "Fox",
    "yoyo": "Yo-yo",
    "zebra": "Zebra",
    "queen": "Princess",
    "ship": "Ship",
    "chick": "Baby chick",
    "thumb": "Thumbs up",
    "ring": "Ring",
    "bee": "Honeybee",
    "moon": "Crescent moon",
    "car": "Automobile",
    "boat": "Sailboat",
    "ant": "Ant",
    "pan": "Cooking",
    "pin": "Pushpin",
    "tin": "Canned food",
    "tap": "Potable water",
    "map": "World map",
    "man": "Man",
    "pot": "Pot of food",
    "nap": "Sleeping face",
    "cap": "Billed cap",
    "cup": "Cup with straw",
    "nut": "Chestnut",
    "net": "Goal net",
    "pen": "Pen",
    "mug": "Hot beverage",
    "rat": "Rat",
    "hat": "Top hat",
    "hen": "Chicken",
    "bed": "Bed",
    "bus": "Bus",
    "bug": "Bug",
    "fan": "Folding hand fan",
    "bat": "Bat",
    "frog": "Frog",
    "drum": "Drum",
    "tent": "Tent",
    "log": "Wood",
    "leg": "Leg",
    "jet": "Airplane",
    "van": "Minibus",
    "web": "Spider web",
    "lemon": "Lemon",
    "melon": "Melon",
    "box": "Package",
    "shell": "Spiral shell",
    "chips": "French fries",
    "bath": "Bathtub",
    "sock": "Socks",
    "duck": "Duck",
    "rock": "Rock",
    "tree": "Deciduous tree",
    "sheep": "Ewe",
    "feet": "Foot",
    "boot": "Hiking boot",
    "spoon": "Spoon",
    "star": "Star",
    "shark": "Shark",
    "coat": "Coat",
    "woman": "Woman",
    "grandma": "Old woman",
    "grandpa": "Old man",
    "llama": "Llama",
    "hedgehog": "Hedgehog",
    "donkey": "Donkey",
    "rose": "Rose",
    "nose": "Nose",
    "tomato": "Tomato",
    "note": "Musical note",
    "clock": "Alarm clock",
    "dolphin": "Dolphin",
    "ball": "Soccer ball",
    "jeans": "Jeans",
    "banana": "Banana",
    "bread": "Bread",
    "mouth": "Mouth",
    "cow": "Cow",
    "penguin": "Penguin",
    "sofa": "Couch and lamp",
    "salad": "Green salad",
    "cloud": "Cloud",
    "camel": "Camel",
    "panda": "Panda",
    "mushroom": "Mushroom",
    "tulip": "Tulip",
    "monkey": "Monkey",
    "goose": "Goose",
    "bird": "Bird",
    "cucumber": "Cucumber",
    "canoe": "Canoe",
    "bag": "Handbag",
    "shoe": "Running shoe",
    "book": "Closed book",
    "milk": "Glass of milk",
    "icecream": "Soft ice cream",
    "house": "House",
    "owl": "Owl",
    "letter": "Envelope",
    "fire": "Fire",
    "cheese": "Cheese wedge",
    "door": "Door",
    "hut": "Hut",
    "mosquito": "Mosquito",
    "spider": "Spider",
    "mirror": "Mirror",
    "pencil": "Pencil",
    "chair": "Chair",
    "taxi": "Taxi",
    "witch": "Woman mage",
    "unicorn": "Unicorn",
    "trex": "T-rex",
    "rainbow": "Rainbow",
    "rocket": "Rocket",
    "koala": "Koala",
    "turtle": "Turtle",
    "butterfly": "Butterfly",
    "flamingo": "Flamingo",
    "peacock": "Peacock",
    "parrot": "Parrot",
    "sloth": "Sloth",
    "teddy": "Teddy bear",
    "balloon": "Balloon",
    "cake": "Birthday cake",
    "crown": "Crown",
    "trophy": "Trophy",
    "gem": "Gem stone",
    "castle": "Castle",
    "polarbear": "Polar bear",
    "otter": "Otter",
    "hamster": "Hamster",
    "kangaroo": "Kangaroo",
    "giraffe": "Giraffe",
    "elephant": "Elephant",
    "dragon": "Dragon",
    "snail": "Snail",
    "openbook": "Open book",
    "party": "Party popper",
    "lock": "Locked",
    "sparkles": "Sparkles",
    "medal": "Sports medal",
    "seedling": "Seedling",
    "sunflower": "Sunflower",
    "blossom": "Blossom",
    "corn": "Ear of corn",
    "feather": "Feather",
    "grapes": "Grapes",
    "gift": "Wrapped gift",
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    tree = json.load(urllib.request.urlopen(TREE))["tree"]
    paths = {}
    for item in tree:
        parts = item["path"].split("/")
        if item["path"].endswith(".png") and "3D" in parts:

            folder = parts[1]
            if len(parts) == 4 or parts[2] == "Default":
                paths[folder] = item["path"]
    missing = []
    for name, folder in PICTURES.items():
        target = OUT / f"{name}.webp"
        if target.exists():
            continue
        if folder not in paths:
            missing.append(folder)
            continue
        data = urllib.request.urlopen(RAW + urllib.parse.quote(paths[folder])).read()
        image = Image.open(io.BytesIO(data)).convert("RGBA")
        bbox = image.getbbox()

        image = image.crop(bbox)
        side = max(image.size)
        canvas = Image.new("RGBA", (int(side * 1.08), int(side * 1.08)), (0, 0, 0, 0))
        canvas.paste(
            image,
            ((canvas.width - image.width) // 2, (canvas.height - image.height) // 2),
        )
        canvas.resize((240, 240), Image.LANCZOS).save(
            target, "WEBP", quality=86, method=6
        )
        print("saved", target)
    if missing:
        sys.exit(f"Missing Fluent assets: {missing}")


if __name__ == "__main__":
    main()
