/* The reading journey: a fixed phonics order, decodable words with one picture style, and short stories. */
window.PhonicsContent = (() => {
    "use strict";

    // Turns "s:sun a:apple" style lists into objects without repeating keys in every entry.
    const pairs = (text) => Object.fromEntries(text.trim().split(/\s+/).map((pair) => pair.split(":")));
    const page = (text, target, pics) => ({ text, target, pics: pics.split(" ") });

    const en = {
        locale: "en-US",
        // Multi-letter sounds are matched first when words are split into tiles.
        teams: ["sh", "ch", "th", "ng", "ck", "ee", "oo", "ar", "oa", "qu"],
        // Each sound: example word and where the sound sits in it.
        sounds: {
            s: ["sun", "start"], a: ["apple", "start"], t: ["tiger", "start"], p: ["pig", "start"],
            i: ["insect", "start"], n: ["nest", "start"], m: ["mouse", "start"], d: ["dog", "start"],
            g: ["goat", "start"], o: ["octopus", "start"], c: ["cat", "start"], k: ["kite", "start"],
            e: ["egg", "start"], u: ["umbrella", "start"], r: ["rabbit", "start"], h: ["horse", "start"],
            b: ["bear", "start"], f: ["fish", "start"], l: ["lion", "start"], j: ["jellyfish", "start"],
            v: ["violin", "start"], w: ["whale", "start"], x: ["fox", "end"], y: ["yoyo", "start"],
            z: ["zebra", "start"], qu: ["queen", "start"], sh: ["ship", "start"], ch: ["chick", "start"],
            th: ["thumb", "start"], ng: ["ring", "end"], ck: ["duck", "end"], ee: ["bee", "in"],
            oo: ["moon", "in"], ar: ["car", "in"], oa: ["boat", "in"]
        },
        // Spoken sound for each tile, in the phoneme alphabet of the recorded voice.
        phonemes: pairs(`s:s a:æ t:t p:p i:ɪ n:n m:m d:d g:ɡ o:ɑ c:k k:k ck:k e:ɛ u:ʌ r:ɹ h:h b:b f:f
            l:l j:ʤ v:v w:w x:ks y:j z:z qu:kw sh:ʃ ch:ʧ th:θ ng:ŋ ee:i oo:u ar:ɑɹ oa:O`),
        // Word -> picture. The yo-yo is written without its hyphen so it splits into tiles cleanly.
        pictures: pairs(`sun:sun apple:apple tiger:tiger pig:pig insect:insect nest:nest mouse:mouse dog:dog
            goat:goat octopus:octopus cat:cat kite:kite egg:egg umbrella:umbrella rabbit:rabbit horse:horse
            bear:bear fish:fish lion:lion jellyfish:jellyfish violin:violin whale:whale fox:fox yoyo:yoyo
            zebra:zebra queen:queen ship:ship chick:chick thumb:thumb ring:ring duck:duck bee:bee moon:moon
            car:car boat:boat ant:ant pin:pin tin:tin pan:pan nap:nap map:map man:man pot:pot cap:cap
            cup:cup nut:nut net:net pen:pen mug:mug rat:rat hat:hat hen:hen bed:bed bus:bus bug:bug fan:fan
            bat:bat frog:frog drum:drum tent:tent log:log leg:leg jet:jet van:van web:web lemon:lemon
            melon:melon shell:shell chips:chips bath:bath sock:sock rock:rock box:box tree:tree sheep:sheep
            boot:boot spoon:spoon star:star shark:shark coat:coat`),
        spelling: { yoyo: "yo-yo" },
        levels: [
            { kind: "sounds", items: "s a t" },
            { kind: "sounds", items: "p i n" },
            { kind: "words", items: "ant pin tin pan nap" },
            { kind: "sounds", items: "m d g o" },
            { kind: "words", items: "map man dog pig pot" },
            { kind: "story", story: "dogpig" },
            { kind: "sounds", items: "c k e u" },
            { kind: "words", items: "cat cap cup nut sun net pen mug" },
            { kind: "sounds", items: "r h b f" },
            { kind: "words", items: "rat hat hen bed bus bug fan bat frog drum tent" },
            { kind: "story", story: "cathat" },
            { kind: "review" },
            { kind: "sounds", items: "l j v w" },
            { kind: "words", items: "log leg jet van web lemon melon" },
            { kind: "sounds", items: "x y z qu" },
            { kind: "story", story: "foxbox" },
            { kind: "sounds", items: "sh ch th ng ck" },
            { kind: "words", items: "ship shell fish chick chips bath ring sock duck rock box fox" },
            { kind: "sounds", items: "ee oo ar oa" },
            { kind: "words", items: "bee tree sheep moon boot spoon car star shark boat coat goat" },
            { kind: "story", story: "moonboat" },
            { kind: "review" }
        ],
        stories: {
            dogpig: { title: "Dog and Pig", cover: "dog", pages: [
                page("A dog sat.", "dog", "dog"), page("A pig sat.", "pig", "pig"),
                page("The dog and the pig nap.", "nap", "dog pig")
            ] },
            cathat: { title: "The Cat and the Hat", cover: "cat", pages: [
                page("A cat has a hat.", "hat", "cat hat"), page("The hat is on the bed.", "bed", "hat bed"),
                page("A rat sat on the hat!", "rat", "rat hat"), page("The cat is sad. The rat is glad.", "sad", "cat rat")
            ] },
            foxbox: { title: "A Fox in a Box", cover: "fox", pages: [
                page("A fox got in a box.", "box", "fox box"), page("A hen sat on the box.", "hen", "hen box"),
                page("The hen fell off.", "fell", "hen"), page("The fox and the hen had fun.", "fun", "fox hen")
            ] },
            moonboat: { title: "The Moon Boat", cover: "boat", pages: [
                page("A goat is in a boat.", "boat", "goat boat"), page("The goat can see a shark.", "shark", "goat shark"),
                page("The shark can swim to the moon.", "moon", "shark moon"), page("The goat and the shark sleep.", "sleep", "goat moon")
            ] }
        },
        // Everything the guide says. The audio generator records each line once.
        lines: {
            welcome: "Hi, I'm Finn! Let's learn to read together.",
            listen: "Listen!",
            meetSay: "Can you say it?",
            startQ: "Which letter does it start with?",
            endQ: "Which letter do you hear at the end?",
            inQ: "Which letters make the sound in the middle?",
            findStart: "Which picture starts with this sound?",
            findEnd: "Which picture ends with this sound?",
            findIn: "Which picture has this sound?",
            build: "Let's build the word",
            read: "Read the word. Then tap the right picture.",
            storyFind: "Can you find the word",
            storyStart: "Story time! Tap any word to hear it.",
            sounds: "New sounds to discover!",
            words: "Let's read some words!",
            review: "Let's practise everything you know!",
            theEnd: "The end! What a lovely story.",
            levelDone: "Hooray! You finished the level!",
            sticker: "You got a new sticker!",
            allDone: "You finished the whole adventure. You are a super reader!",
            hereItIs: "Here it is! Tap it.",
            praise1: "Yes!", praise2: "Great job!", praise3: "Well done!", praise4: "Super!",
            praise5: "You got it!", praise6: "Fantastic!", praise7: "Brilliant!", praise8: "Wow, you are a reader!",
            retry1: "Oops! Try again.", retry2: "Almost! Have another go.", retry3: "Listen again.", retry4: "Nearly! Try once more."
        }
    };

    const de = {
        locale: "de-DE",
        teams: ["sch", "ch", "ck", "ei", "au", "eu", "ie", "qu", "pf"],
        sounds: {
            m: ["Maus", "start"], a: ["Apfel", "start"], o: ["Oma", "start"], l: ["Lama", "start"],
            i: ["Igel", "start"], s: ["Sonne", "start"], e: ["Esel", "start"], r: ["Rose", "start"],
            n: ["Nase", "start"], t: ["Tiger", "start"], u: ["Uhr", "start"], d: ["Delfin", "start"],
            h: ["Hund", "start"], b: ["Ball", "start"], f: ["Fisch", "start"], w: ["Wal", "start"],
            k: ["Kuh", "start"], p: ["Pinguin", "start"], g: ["Gans", "start"], z: ["Zebra", "start"],
            j: ["Jacke", "start"], v: ["Vogel", "start"], sch: ["Schaf", "start"], ch: ["Buch", "end"],
            ei: ["Eis", "start"], au: ["Auto", "start"], ie: ["Biene", "in"], eu: ["Eule", "start"],
            "ä": ["Bär", "in"], "ö": ["Löwe", "in"], "ü": ["Tür", "in"], st: ["Stern", "start"],
            sp: ["Spinne", "start"], qu: ["Qualle", "start"], pf: ["Pferd", "start"]
        },
        phonemes: pairs(`m:m a:ɑː o:oː l:l i:iː s:z e:eː r:r n:n t:t u:uː d:d h:h b:b f:f w:v k:k p:p
            g:ɡ z:ʦ j:j v:f sch:ʃ ch:x ck:k ei:I au:W ie:iː eu:ɔø ä:ɛː ö:øː ü:yː st:ʃt sp:ʃp qu:kv pf:pf`),
        pictures: pairs(`Maus:mouse Apfel:apple Oma:grandma Lama:llama Igel:hedgehog Sonne:sun Esel:donkey
            Rose:rose Nase:nose Tiger:tiger Uhr:clock Delfin:dolphin Hund:dog Ball:ball Fisch:fish Wal:whale
            Kuh:cow Pinguin:penguin Gans:goose Zebra:zebra Jacke:coat Vogel:bird Schaf:sheep Buch:book
            Eis:icecream Auto:car Biene:bee Eule:owl Bär:bear Löwe:lion Tür:door Stern:star Spinne:spider
            Qualle:jellyfish Pferd:horse Mama:woman Tomate:tomato Melone:melon Ente:duck Nest:nest
            Note:note Hut:hat Bus:bus Dose:tin Hose:jeans Hase:rabbit Banane:banana Brot:bread Mund:mouth
            Sofa:sofa Salat:salad Wolke:cloud Kamel:camel Panda:panda Pilz:mushroom Tulpe:tulip Affe:monkey
            Opa:grandpa Papa:man Kanu:canoe Gurke:cucumber Zelt:tent Jojo:yoyo Tasche:bag Milch:milk
            Ei:egg Haus:house Baum:tree Kuchen:cake Ziege:goat Brief:letter Feuer:fire Käse:cheese
            Hütte:hut Mücke:mosquito Stift:pencil Spiegel:mirror Topf:pot`),
        // "st" and "sp" only say /scht/ and /schp/ at the start, so those words name their tiles.
        tiles: { Stern: ["St", "e", "r", "n"], Spinne: ["Sp", "i", "n", "n", "e"], Stift: ["St", "i", "f", "t"], Spiegel: ["Sp", "ie", "g", "e", "l"] },
        levels: [
            { kind: "sounds", items: "m a o" },
            { kind: "sounds", items: "l i s" },
            { kind: "words", items: "Mama Oma Lama" },
            { kind: "sounds", items: "e r n t" },
            { kind: "words", items: "Esel Rose Nase Tomate Melone Ente Nest Note Sonne" },
            { kind: "story", story: "lotte" },
            { kind: "sounds", items: "u d h b" },
            { kind: "words", items: "Hut Bus Dose Hose Hase Banane Hund Ball Brot Mund" },
            { kind: "sounds", items: "f w k p" },
            { kind: "words", items: "Sofa Salat Wolke Kamel Panda Pilz Tulpe Affe Opa Papa Kanu" },
            { kind: "story", story: "hund" },
            { kind: "review" },
            { kind: "sounds", items: "g z j v" },
            { kind: "words", items: "Igel Gurke Zelt Zebra Jojo Gans Vogel" },
            { kind: "sounds", items: "sch ch ei au" },
            { kind: "words", items: "Fisch Schaf Tasche Buch Milch Eis Ei Haus Maus Baum Auto Kuchen" },
            { kind: "sounds", items: "ie eu ä ö ü" },
            { kind: "words", items: "Biene Ziege Brief Eule Feuer Bär Käse Löwe Tür Hütte Mücke" },
            { kind: "story", story: "eule" },
            { kind: "sounds", items: "st sp qu pf" },
            { kind: "words", items: "Stern Stift Spinne Spiegel Qualle Pferd Apfel Topf" },
            { kind: "story", story: "stern" },
            { kind: "review" }
        ],
        stories: {
            lotte: { title: "Lama Lotte", cover: "llama", pages: [
                page("Lotte ist ein Lama.", "Lama", "llama"), page("Lotte mag Melone.", "Melone", "llama melon"),
                page("Oma hat eine Rose.", "Rose", "grandma rose"), page("Lotte isst die Rose!", "isst", "llama rose")
            ] },
            hund: { title: "Der Hund und der Ball", cover: "dog", pages: [
                page("Der Hund hat einen Ball.", "Ball", "dog ball"), page("Der Ball rollt zum Sofa.", "Sofa", "ball sofa"),
                page("Unter dem Sofa sitzt eine Maus.", "Maus", "sofa mouse"), page("Hund und Maus spielen Ball.", "Hund", "dog mouse")
            ] },
            eule: { title: "Die Eule im Baum", cover: "owl", pages: [
                page("Im Baum sitzt eine Eule.", "Eule", "tree owl"), page("Die Eule sieht eine Biene.", "Biene", "owl bee"),
                page("Die Biene fliegt zum Haus.", "Haus", "bee house"), page("Die Eule schläft im Baum.", "Baum", "owl tree")
            ] },
            stern: { title: "Der kleine Stern", cover: "star", pages: [
                page("Am Himmel ist ein Stern.", "Stern", "star"), page("Ein Pferd sieht den Stern.", "Pferd", "horse star"),
                page("Das Pferd springt hoch.", "springt", "horse"), page("Gute Nacht, kleiner Stern!", "Nacht", "star moon")
            ] }
        },
        lines: {
            welcome: "Hallo, ich bin Finn! Komm, wir lernen zusammen lesen.",
            listen: "Hör mal!",
            meetSay: "Kannst du das sagen?",
            startQ: "Mit welchem Buchstaben fängt das an?",
            endQ: "Welchen Laut hörst du am Ende?",
            inQ: "Welchen Laut hörst du in der Mitte?",
            findStart: "Welches Bild fängt mit diesem Laut an?",
            findEnd: "Welches Bild hört mit diesem Laut auf?",
            findIn: "In welchem Bild hörst du diesen Laut?",
            build: "Wir bauen das Wort",
            read: "Lies das Wort. Tippe dann auf das richtige Bild.",
            storyFind: "Findest du das Wort",
            storyStart: "Zeit für eine Geschichte! Tippe auf ein Wort, dann hörst du es.",
            sounds: "Neue Laute warten auf dich!",
            words: "Jetzt lesen wir Wörter!",
            review: "Jetzt üben wir alles, was du schon kannst!",
            theEnd: "Ende! Was für eine schöne Geschichte.",
            levelDone: "Hurra! Du hast das Level geschafft!",
            sticker: "Du hast einen neuen Sticker gewonnen!",
            allDone: "Du hast das ganze Abenteuer geschafft. Du bist ein super Leser!",
            hereItIs: "Hier ist es! Tippe darauf.",
            praise1: "Ja!", praise2: "Toll gemacht!", praise3: "Super!", praise4: "Prima!",
            praise5: "Genau richtig!", praise6: "Klasse!", praise7: "Wunderbar!", praise8: "Juhu, du kannst lesen!",
            retry1: "Hoppla! Versuch es noch einmal.", retry2: "Fast! Probier es nochmal.", retry3: "Hör noch einmal hin.", retry4: "Beinahe! Noch ein Versuch."
        }
    };

    // Collectable rewards, one per level, shown in the sticker book.
    const stickers = ["butterfly", "turtle", "koala", "unicorn", "panda", "rocket", "flamingo", "parrot", "trex",
        "rainbow", "teddy", "crown", "dragon", "otter", "peacock", "sloth", "hamster", "kangaroo", "giraffe",
        "elephant", "polarbear", "castle", "trophy"];

    return { en, de, stickers };
})();
