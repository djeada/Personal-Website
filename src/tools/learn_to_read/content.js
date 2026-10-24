/* Content stays separate from the player so new reading adventures are easy to add. */
window.PhonicsContent = (() => {
    "use strict";

    const letters = {
        en: [
            ["s", "sun", "☀️"], ["a", "apple", "🍎"], ["t", "tiger", "🐯"],
            ["p", "pig", "🐷"], ["i", "insect", "🐞"], ["n", "net", "🥅"],
            ["m", "moon", "🌙"], ["d", "dog", "🐕"], ["g", "goat", "🐐"],
            ["o", "octopus", "🐙"], ["c", "cat", "🐈"], ["k", "kite", "🪁"],
            ["e", "egg", "🥚"], ["u", "umbrella", "☂️"], ["r", "rabbit", "🐇"],
            ["h", "hat", "🎩"], ["b", "bus", "🚌"], ["f", "fish", "🐟"],
            ["l", "leaf", "🍃"], ["j", "jam", "🫙"], ["v", "van", "🚐"],
            ["w", "web", "🕸️"], ["y", "yarn", "🧶"], ["z", "zebra", "🦓"],
            ["q", "queen", "👑"], ["x", "fox", "🦊"]
        ],
        de: [
            ["m", "Maus", "🐁"], ["a", "Apfel", "🍎"], ["s", "Sonne", "☀️"],
            ["i", "Igel", "🦔"], ["o", "Oma", "👵"], ["p", "Panda", "🐼"],
            ["l", "Lampe", "💡"], ["t", "Tiger", "🐯"], ["n", "Nase", "👃"],
            ["e", "Elefant", "🐘"], ["r", "Rose", "🌹"], ["d", "Dach", "🏠"],
            ["u", "Uhr", "🕒"], ["f", "Fisch", "🐟"], ["b", "Ball", "⚽"],
            ["h", "Hut", "🎩"], ["w", "Wolke", "☁️"], ["k", "Katze", "🐈"],
            ["g", "Gans", "🪿"], ["z", "Zebra", "🦓"], ["j", "Jacke", "🧥"],
            ["v", "Vogel", "🐦"], ["c", "Clown", "🤡"], ["q", "Qualle", "🪼"],
            ["x", "Xylophon", "🎵"], ["y", "Yoga", "🧘"], ["ä", "Äpfel", "🍎"],
            ["ö", "Öl", "🫗"], ["ü", "Überraschung", "🎁"]
        ]
    };
    const word = (text, emoji, tiles = [...text]) => ({ id: text, text, emoji, tiles });
    const words = {
        en: [
            { id: "first", title: "First little words", hint: "Start with s, a, t, p, i, n, m.", items: [
                word("sat", "🪑"), word("mat", "🧺"), word("tap", "🚰"), word("pan", "🍳"),
                word("pin", "📌"), word("sit", "🪑"), word("tin", "🥫"), word("nap", "😴"),
                word("map", "🗺️"), word("pat", "🤚"), word("sip", "🥤"), word("ant", "🐜")
            ] },
            { id: "vowels", title: "Short-vowel trail", hint: "Three letters. One little word.", items: [
                word("cat", "🐈"), word("dog", "🐕"), word("sun", "☀️"), word("pig", "🐷"),
                word("hen", "🐔"), word("bed", "🛏️"), word("cup", "☕"), word("bus", "🚌"),
                word("hat", "🎩"), word("fox", "🦊"), word("red", "🔴"), word("bug", "🐞"),
                word("net", "🥅"), word("log", "🪵"), word("jam", "🫙"), word("mud", "🟤")
            ] },
            { id: "teams", title: "Sound-team bridge", hint: "Some letters work together: sh, ch, th, ck.", items: [
                word("ship", "🚢", ["sh", "i", "p"]), word("fish", "🐟", ["f", "i", "sh"]),
                word("shop", "🏪", ["sh", "o", "p"]), word("chin", "🙂", ["ch", "i", "n"]),
                word("chop", "🪓", ["ch", "o", "p"]), word("thin", "🪡", ["th", "i", "n"]),
                word("bath", "🛁", ["b", "a", "th"]), word("duck", "🦆", ["d", "u", "ck"]),
                word("sock", "🧦", ["s", "o", "ck"]), word("rock", "🪨", ["r", "o", "ck"])
            ] }
        ],
        de: [
            { id: "first", title: "Erste kleine Wörter", hint: "Entdecke m, a, s, i, o, p und l.", items: [
                word("Mama", "👩"), word("Oma", "👵"), word("Papa", "👨"), word("Opa", "👴"),
                word("Lama", "🦙"), word("am", "📍"), word("im", "📦"), word("Salami", "🥪")
            ] },
            { id: "vowels", title: "Die Wörterwiese", hint: "Höre zu und setze die Buchstaben zusammen.", items: [
                word("Hut", "🎩"), word("Bus", "🚌"), word("Rose", "🌹"), word("Nase", "👃"),
                word("Hase", "🐇"), word("Dose", "🥫"), word("Tomate", "🍅"), word("Melone", "🍈"),
                word("Banane", "🍌"), word("Lampe", "💡"), word("Sofa", "🛋️"), word("Salat", "🥗")
            ] },
            { id: "teams", title: "Buchstaben als Team", hint: "Manche Buchstaben gehören zusammen: sch, ch, au, ei, ie.", items: [
                word("Fisch", "🐟", ["f", "i", "sch"]), word("Schaf", "🐑", ["sch", "a", "f"]),
                word("Buch", "📕", ["b", "u", "ch"]), word("Haus", "🏠", ["h", "au", "s"]),
                word("Maus", "🐁", ["m", "au", "s"]), word("Baum", "🌳", ["b", "au", "m"]),
                word("Eis", "🍦", ["ei", "s"]), word("Seil", "🪢", ["s", "ei", "l"]),
                word("Biene", "🐝", ["b", "ie", "n", "e"]), word("Wiese", "🌱", ["w", "ie", "s", "e"])
            ] }
        ]
    };
    const page = (text, target, emoji) => ({ text, target, emoji });
    const stories = {
        en: [
            { id: "cat", title: "A nap for the cat", emoji: "🐈", pages: [page("The cat sat on a mat.", "mat", "🐈"), page("The cat had a nap.", "nap", "😴"), page("A dog ran to the cat.", "dog", "🐕")] },
            { id: "sun", title: "Fun in the sun", emoji: "☀️", pages: [page("The sun is up.", "sun", "☀️"), page("Sam put on a hat.", "hat", "🎩"), page("Sam can run and hop.", "hop", "🐇")] },
            { id: "pig", title: "The little pig", emoji: "🐷", pages: [page("The pig is in the mud.", "pig", "🐷"), page("The hen has a red hat.", "red", "🎩"), page("The pig and hen sit.", "sit", "🐔")] },
            { id: "fox", title: "A box for a fox", emoji: "🦊", pages: [page("A fox ran to a log.", "log", "🪵"), page("The fox hid in a box.", "box", "📦"), page("The fox had a nap.", "fox", "🦊")] },
            { id: "dog", title: "The dog and the log", emoji: "🐕", pages: [page("The dog ran to a log.", "dog", "🐕"), page("The dog dug in the mud.", "mud", "🟤"), page("The dog sat on the log.", "log", "🪵")] },
            { id: "hen", title: "Ten eggs for a hen", emoji: "🐔", pages: [page("The hen has ten eggs.", "hen", "🐔"), page("An egg is in the nest.", "egg", "🥚"), page("The hen can sit and rest.", "rest", "🪹")] },
            { id: "bee", title: "The busy little bee", emoji: "🐝", pages: [page("The bee is on a bud.", "bee", "🐝"), page("The bud is red.", "red", "🌹"), page("The bee can fly up.", "up", "🌤️")] },
            { id: "bus", title: "On the bus", emoji: "🚌", pages: [page("The bus is red.", "bus", "🚌"), page("A man has a big bag.", "bag", "👜"), page("The man got on the bus.", "man", "👨")] },
            { id: "fish", title: "A wish for a fish", emoji: "🐟", pages: [page("A fish is in the pond.", "fish", "🐟"), page("A duck can swim.", "duck", "🦆"), page("The fish and duck splash.", "splash", "💦")] }
        ],
        de: [
            { id: "cat", title: "Die kleine Katze", emoji: "🐈", pages: [page("Die Katze sitzt auf der Matte.", "Matte", "🐈"), page("Die Katze macht eine Pause.", "Pause", "😴"), page("Ein Hund kommt zur Katze.", "Hund", "🐕")] },
            { id: "sun", title: "Ein Tag in der Sonne", emoji: "☀️", pages: [page("Die Sonne ist da.", "Sonne", "☀️"), page("Sam hat einen Hut.", "Hut", "🎩"), page("Sam rennt über die Wiese.", "Wiese", "🌱")] },
            { id: "pig", title: "Auf dem Bauernhof", emoji: "🐷", pages: [page("Das Schwein spielt im Matsch.", "Schwein", "🐷"), page("Das Huhn hat einen roten Hut.", "Hut", "🎩"), page("Das Huhn sitzt im Gras.", "Gras", "🐔")] },
            { id: "fox", title: "Der Fuchs im Wald", emoji: "🦊", pages: [page("Der Fuchs rennt zum Baum.", "Baum", "🌳"), page("Der Fuchs sitzt in einer Kiste.", "Kiste", "📦"), page("Der Fuchs macht eine Pause.", "Fuchs", "🦊")] },
            { id: "dog", title: "Der Hund und der Baum", emoji: "🐕", pages: [page("Der Hund rennt zum Baum.", "Hund", "🐕"), page("Der Hund spielt im Garten.", "Garten", "🌱"), page("Der Hund sitzt unter dem Baum.", "Baum", "🌳")] },
            { id: "hen", title: "Das Huhn im Nest", emoji: "🐔", pages: [page("Das Huhn sitzt im Nest.", "Huhn", "🐔"), page("Ein Ei liegt im Nest.", "Ei", "🥚"), page("Das Huhn macht eine Pause.", "Pause", "🪹")] },
            { id: "bee", title: "Die fleißige Biene", emoji: "🐝", pages: [page("Die Biene sitzt auf der Blume.", "Biene", "🐝"), page("Die Blume ist rot.", "rot", "🌹"), page("Die Biene fliegt zur Wiese.", "Wiese", "🌱")] },
            { id: "bus", title: "Eine Fahrt im Bus", emoji: "🚌", pages: [page("Der Bus ist rot.", "Bus", "🚌"), page("Oma hat eine große Tasche.", "Tasche", "👜"), page("Oma steigt in den Bus.", "Oma", "👵")] },
            { id: "fish", title: "Am kleinen See", emoji: "🐟", pages: [page("Der Fisch lebt im See.", "Fisch", "🐟"), page("Eine Ente kann schwimmen.", "Ente", "🦆"), page("Die Ente spielt im Wasser.", "Wasser", "💦")] }
        ]
    };
    return { letters, words, stories };
})();
