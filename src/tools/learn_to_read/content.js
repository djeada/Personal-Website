/* Three reading paths (letters, words, sentences and stories) built from one picture style and recorded voices. */
window.PhonicsContent = (() => {
    "use strict";

    // Turns "s:sun a:apple" style lists into objects without repeating keys in every entry.
    const pairs = (text) => Object.fromEntries(text.trim().split(/\s+/).map((pair) => {
        const [key, ...rest] = pair.split(":");
        return [key, rest.join(":")];
    }));
    const page = (text, target, pics) => ({ text, target, pics: pics.split(" ") });
    const sentence = (text, answer) => ({ text, answer });
    const question = (text, answer, others) => ({ text, answer, others: others.split(" ") });
    // Letter names as the voice should say them, written as exact pronunciations; teams are spelled letter by letter.
    const spell = (names) => (grapheme) => [...grapheme].map((letter) => {
        const [name, ipa] = names[letter].split(":");
        return `[${name}](/${ipa}/)`;
    }).join(", ");
    const englishName = spell(pairs(`a:A:ˈA b:B:bˈi c:C:sˈi d:D:dˈi e:E:ˈi f:F:ˈɛf g:G:ʤˈi h:H:ˈAʧ i:I:ˈI j:J:ʤˈA k:K:kˈA
        l:L:ˈɛl m:M:ˈɛm n:N:ˈɛn o:O:ˈO p:P:pˈi q:Q:kjˈu r:R:ˈɑɹ s:S:ˈɛs t:T:tˈi u:U:jˈu v:V:vˈi w:W:dˈʌbəljˌu
        x:X:ˈɛks y:Y:wˈI z:Z:zˈi`));
    const germanName = spell(pairs(`a:A:ˈɑː b:Be:bˈeː c:Ce:ʦˈeː d:De:dˈeː e:E:ˈeː f:Ef:ˈɛf g:Ge:ɡˈeː h:Ha:hˈɑː i:I:ˈiː
        j:Jott:jˈɔt k:Ka:kˈɑː l:El:ˈɛl m:Em:ˈɛm n:En:ˈɛn o:O:ˈoː p:Pe:pˈeː q:Ku:kˈuː r:Er:ˈɛɾ s:Es:ˈɛs t:Te:tˈeː
        u:U:ˈuː v:Vau:fˈW w:We:vˈeː x:Ix:ˈɪks y:Ypsilon:ˈʏpsilɔn z:Zett:ʦˈɛt ä:Ä:ˈɛː ö:Ö:ˈøː ü:Ü:ˈyː`));
    const names = (sounds, name) => Object.fromEntries(Object.keys(sounds).map((grapheme) => [grapheme, name(grapheme)]));

    const en = {
        locale: "en-US",
        // Letter teams are matched first when words are split into tiles.
        teams: ["sh", "ch", "th", "ng", "ck", "ee", "oo", "ar", "oa", "qu"],
        // Each letter or team: example word and where it sits in that word.
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
        // The sound of each tile, used to keep every question to a single right answer (c and k sound alike).
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
        paths: {
            letters: { lowercaseFrom: 10, levels: [
                { kind: "letters", items: "s a t" }, { kind: "letters", items: "p i n" }, { kind: "letters", items: "m d g o" },
                { kind: "review" }, { kind: "letters", items: "c k e u" }, { kind: "letters", items: "r h b f" },
                { kind: "review" }, { kind: "letters", items: "l j v w" }, { kind: "letters", items: "x y z qu" },
                { kind: "review" }, { kind: "small", items: "s a t p i n m d" }, { kind: "small", items: "g o c k e u r h" },
                { kind: "small", items: "b f l j v w x y z qu" }, { kind: "letters", items: "sh ch th" },
                { kind: "letters", items: "ng ck" }, { kind: "letters", items: "ee oo ar oa" }, { kind: "review" }
            ] },
            words: { lowercaseFrom: 8, levels: [
                { kind: "words", items: "ant pin tin pan nap" }, { kind: "words", items: "map man dog pig pot" },
                { kind: "words", items: "cat cap cup nut sun net pen mug" }, { kind: "review" },
                { kind: "words", items: "rat hat hen bed bus bug fan bat" }, { kind: "words", items: "frog drum tent nest" },
                { kind: "words", items: "log leg jet van web lemon melon" }, { kind: "review" },
                { kind: "words", items: "ship shell fish chips bath" }, { kind: "words", items: "chick sock duck rock ring box fox" },
                { kind: "words", items: "bee tree sheep moon boot spoon" }, { kind: "words", items: "car star shark boat coat goat" },
                { kind: "review" }
            ] },
            stories: { lowercaseFrom: 4, levels: [
                { kind: "sentences", mode: "picture", items: "0 1 2 3 4 5" }, { kind: "story", story: "dogpig" },
                { kind: "sentences", mode: "cloze", items: "6 7 8 9 10 11" }, { kind: "story", story: "cathat" },
                { kind: "sentences", mode: "order", items: "12 13 14 15 16 17" }, { kind: "story", story: "foxbox" },
                { kind: "sentences", mode: "mix", items: "18 19 20 21 22 23" }, { kind: "story", story: "moonboat" },
                { kind: "story", story: "beetree" }, { kind: "review" }
            ] }
        },
        // Short sentences: the answer word appears once and has a picture.
        sentences: [
            sentence("A cat sat.", "cat"), sentence("A dog can dig.", "dog"), sentence("The pig is in the mud.", "pig"),
            sentence("A hen has an egg.", "hen"), sentence("The sun is hot.", "sun"), sentence("A man has a map.", "map"),
            sentence("A bug is on a log.", "bug"), sentence("The fox is in a box.", "box"), sentence("An ant can run.", "ant"),
            sentence("The bus is red.", "bus"), sentence("Mum has a cup.", "cup"), sentence("The hat is on the bed.", "hat"),
            sentence("A fish can swim.", "fish"), sentence("The duck is wet.", "duck"), sentence("A frog can hop.", "frog"),
            sentence("The bed is big.", "bed"), sentence("A rat sat on a mat.", "rat"), sentence("The jet is fast.", "jet"),
            sentence("A bee is on the tree.", "bee"), sentence("The moon is up.", "moon"), sentence("The ship is on the sea.", "ship"),
            sentence("A goat is in a boat.", "boat"), sentence("The star is far.", "star"), sentence("I can see a shark.", "shark")
        ],
        stories: {
            dogpig: { title: "Dog and Pig", cover: "dog", pages: [
                page("A dog sat.", "dog", "dog"), page("A pig sat.", "pig", "pig"),
                page("The dog and the pig nap.", "nap", "dog pig")
            ], questions: [question("Who sat first?", "dog", "pig cat"), question("Who sat with the dog?", "pig", "hen duck")] },
            cathat: { title: "The Cat and the Hat", cover: "cat", pages: [
                page("A cat has a hat.", "hat", "cat hat"), page("The hat is on the bed.", "bed", "hat bed"),
                page("A rat sat on the hat!", "rat", "rat hat"), page("The cat is sad. The rat is glad.", "sad", "cat rat")
            ], questions: [question("What did the cat have?", "hat", "cup box"), question("Who sat on the hat?", "rat", "dog pig")] },
            foxbox: { title: "A Fox in a Box", cover: "fox", pages: [
                page("A fox got in a box.", "box", "fox box"), page("A hen sat on the box.", "hen", "hen box"),
                page("The hen fell off.", "fell", "hen"), page("The fox and the hen had fun.", "fun", "fox hen")
            ], questions: [question("Where did the fox go?", "box", "bed bus"), question("Who sat on the box?", "hen", "cat duck")] },
            moonboat: { title: "The Moon Boat", cover: "boat", pages: [
                page("A goat is in a boat.", "boat", "goat boat"), page("The goat can see a shark.", "shark", "goat shark"),
                page("The shark can swim to the moon.", "moon", "shark moon"), page("The goat and the shark sleep.", "sleep", "goat moon")
            ], questions: [question("Where is the goat?", "boat", "car bus"), question("What did the goat see?", "shark", "fish duck")] },
            beetree: { title: "The Bee and the Frog", cover: "bee", pages: [
                page("A bee sat on a tree.", "tree", "bee tree"), page("The bee met a frog.", "frog", "bee frog"),
                page("The frog sat on a log.", "log", "frog log"), page("The bee and the frog had fun.", "fun", "bee frog")
            ], questions: [question("Who sat on the tree?", "bee", "ant duck"), question("Who did the bee meet?", "frog", "fish sheep")] }
        },
        // Everything the guide says. The audio generator records each line once.
        lines: {
            welcome: "Hi, I'm Finn! Let's learn to read together.",
            startQ: "Which letter does it start with?",
            endQ: "Which letter does it end with?",
            inQ: "Which letters can you hear in the middle?",
            findStart: "Which picture starts with this letter?",
            findEnd: "Which picture ends with this letter?",
            findIn: "Which picture has these letters?",
            findIt: "Can you find it? Tap the letter!",
            huntQ: "Find every letter like this one!",
            smallQ: "Which small letter goes with this big letter?",
            small: "Now let's meet the small letters!",
            build: "Let's build the word",
            missingQ: "Which letter is missing?",
            read: "Read the word. Then tap the right picture.",
            matchQ: "Which word goes with the picture?",
            sentencePicQ: "Read the sentence. Which picture fits?",
            clozeQ: "Which word is missing? Look at the picture.",
            orderQ: "Put the words in the right order.",
            questions: "Now a question about the story!",
            storyFind: "Can you find the word",
            storyStart: "Story time! Tap any word to hear it.",
            sounds: "New letters to discover!",
            words: "Let's build some words!",
            sentences: "Let's read some sentences!",
            review: "Let's practise everything you know!",
            theEnd: "The end! What a lovely story.",
            levelDone: "Hooray! You finished the level!",
            sticker: "You got a new sticker!",
            allDone: "You finished the whole path. You are a super reader!",
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
        paths: {
            letters: { lowercaseFrom: 9, levels: [
                { kind: "letters", items: "m a o" }, { kind: "letters", items: "l i s" }, { kind: "letters", items: "e r n t" },
                { kind: "review" }, { kind: "letters", items: "u d h b" }, { kind: "letters", items: "f w k p" },
                { kind: "review" }, { kind: "letters", items: "g z j v" }, { kind: "review" },
                { kind: "small", items: "m a o l i s e r" }, { kind: "small", items: "n t u d h b f w" },
                { kind: "small", items: "k p g z j v" }, { kind: "letters", items: "sch ch ei au" },
                { kind: "letters", items: "ie eu ä ö ü" }, { kind: "letters", items: "st sp qu pf" }, { kind: "review" }
            ] },
            words: { lowercaseFrom: 9, levels: [
                { kind: "words", items: "Mama Oma Lama" }, { kind: "words", items: "Esel Rose Nase Ente Nest" },
                { kind: "words", items: "Tomate Melone Note Sonne" }, { kind: "review" },
                { kind: "words", items: "Hut Bus Dose Hose Hase" }, { kind: "words", items: "Banane Hund Ball Brot Mund" },
                { kind: "words", items: "Sofa Salat Wolke Kamel Panda" }, { kind: "words", items: "Pilz Tulpe Affe Opa Papa Kanu" },
                { kind: "review" }, { kind: "words", items: "Igel Gurke Zelt Zebra Jojo Gans Vogel" },
                { kind: "words", items: "Fisch Schaf Tasche Buch Milch Kuchen" }, { kind: "words", items: "Eis Ei Haus Maus Baum Auto" },
                { kind: "words", items: "Biene Ziege Brief Eule Feuer" }, { kind: "words", items: "Bär Käse Löwe Tür Hütte Mücke" },
                { kind: "words", items: "Stern Stift Spinne Spiegel Qualle Pferd Apfel Topf" }, { kind: "review" }
            ] },
            stories: { lowercaseFrom: 4, levels: [
                { kind: "sentences", mode: "picture", items: "0 1 2 3 4 5" }, { kind: "story", story: "lotte" },
                { kind: "sentences", mode: "cloze", items: "6 7 8 9 10 11" }, { kind: "story", story: "hund" },
                { kind: "sentences", mode: "order", items: "12 13 14 15 16 17" }, { kind: "story", story: "eule" },
                { kind: "sentences", mode: "mix", items: "18 19 20 21 22 23" }, { kind: "story", story: "stern" },
                { kind: "story", story: "fisch" }, { kind: "review" }
            ] }
        },
        sentences: [
            sentence("Oma hat eine Rose.", "Rose"), sentence("Mama malt eine Sonne.", "Sonne"), sentence("Das Lama ist nett.", "Lama"),
            sentence("Der Esel ist grau.", "Esel"), sentence("Die Ente ist im Nest.", "Ente"), sentence("Opa isst eine Banane.", "Banane"),
            sentence("Der Hund hat einen Ball.", "Ball"), sentence("Der Hase sitzt im Gras.", "Hase"), sentence("Die Maus ist klein.", "Maus"),
            sentence("Das Auto ist rot.", "Auto"), sentence("Der Fisch kann schwimmen.", "Fisch"), sentence("Papa liest ein Buch.", "Buch"),
            sentence("Der Vogel singt.", "Vogel"), sentence("Der Löwe schläft.", "Löwe"), sentence("Die Kuh gibt Milch.", "Milch"),
            sentence("Das Schaf ist weiß.", "Schaf"), sentence("Die Tasche ist voll.", "Tasche"), sentence("Das Pferd läuft schnell.", "Pferd"),
            sentence("Die Biene fliegt zur Tulpe.", "Biene"), sentence("Der Bär mag Käse.", "Käse"), sentence("Die Eule sitzt im Baum.", "Eule"),
            sentence("Am Himmel ist eine Wolke.", "Wolke"), sentence("Das Zebra hat Streifen.", "Zebra"), sentence("Im Topf ist Suppe.", "Topf")
        ],
        stories: {
            lotte: { title: "Lama Lotte", cover: "llama", pages: [
                page("Lotte ist ein Lama.", "Lama", "llama"), page("Lotte mag Melone.", "Melone", "llama melon"),
                page("Oma hat eine Rose.", "Rose", "grandma rose"), page("Lotte isst die Rose!", "isst", "llama rose")
            ], questions: [question("Was mag Lotte?", "Melone", "Banane Apfel"), question("Was hat Oma?", "Rose", "Tulpe Buch")] },
            hund: { title: "Der Hund und der Ball", cover: "dog", pages: [
                page("Der Hund hat einen Ball.", "Ball", "dog ball"), page("Der Ball rollt zum Sofa.", "Sofa", "ball sofa"),
                page("Unter dem Sofa sitzt eine Maus.", "Maus", "sofa mouse"), page("Hund und Maus spielen Ball.", "Hund", "dog mouse")
            ], questions: [question("Was hat der Hund?", "Ball", "Brot Hut"), question("Wer sitzt unter dem Sofa?", "Maus", "Hase Ente")] },
            eule: { title: "Die Eule im Baum", cover: "owl", pages: [
                page("Im Baum sitzt eine Eule.", "Eule", "tree owl"), page("Die Eule sieht eine Biene.", "Biene", "owl bee"),
                page("Die Biene fliegt zum Haus.", "Haus", "bee house"), page("Die Eule schläft im Baum.", "Baum", "owl tree")
            ], questions: [question("Wo sitzt die Eule?", "Baum", "Haus Auto"), question("Was sieht die Eule?", "Biene", "Fisch Vogel")] },
            stern: { title: "Der kleine Stern", cover: "star", pages: [
                page("Am Himmel ist ein Stern.", "Stern", "star"), page("Ein Pferd sieht den Stern.", "Pferd", "horse star"),
                page("Das Pferd springt hoch.", "springt", "horse"), page("Gute Nacht, kleiner Stern!", "Nacht", "star moon")
            ], questions: [question("Was ist am Himmel?", "Stern", "Sonne Wolke"), question("Wer sieht den Stern?", "Pferd", "Kuh Esel")] },
            fisch: { title: "Der Fisch im See", cover: "fish", pages: [
                page("Im See ist ein Fisch.", "Fisch", "fish"), page("Eine Ente schwimmt zum Fisch.", "Ente", "duck fish"),
                page("Ente und Fisch spielen.", "spielen", "duck fish"), page("Dann schlafen sie.", "schlafen", "duck moon")
            ], questions: [question("Wer lebt im See?", "Fisch", "Kuh Hund"), question("Wer schwimmt zum Fisch?", "Ente", "Eule Bär")] }
        },
        lines: {
            welcome: "Hallo, ich bin Finn! Komm, wir lernen zusammen lesen.",
            startQ: "Mit welchem Buchstaben fängt das an?",
            endQ: "Mit welchem Buchstaben hört das auf?",
            inQ: "Welche Buchstaben hörst du in der Mitte?",
            findStart: "Welches Bild fängt mit diesem Buchstaben an?",
            findEnd: "Welches Bild hört mit diesem Buchstaben auf?",
            findIn: "In welchem Bild stecken diese Buchstaben?",
            findIt: "Findest du ihn? Tippe auf den Buchstaben!",
            huntQ: "Finde alle Buchstaben, die so aussehen!",
            smallQ: "Welcher kleine Buchstabe gehört zu diesem großen?",
            small: "Jetzt lernen wir die kleinen Buchstaben kennen!",
            build: "Wir bauen das Wort",
            missingQ: "Welcher Buchstabe fehlt?",
            read: "Lies das Wort. Tippe dann auf das richtige Bild.",
            matchQ: "Welches Wort passt zum Bild?",
            sentencePicQ: "Lies den Satz. Welches Bild passt?",
            clozeQ: "Welches Wort fehlt? Schau dir das Bild an.",
            orderQ: "Bring die Wörter in die richtige Reihenfolge.",
            questions: "Jetzt eine Frage zur Geschichte!",
            storyFind: "Findest du das Wort",
            storyStart: "Zeit für eine Geschichte! Tippe auf ein Wort, dann hörst du es.",
            sounds: "Neue Buchstaben warten auf dich!",
            words: "Jetzt bauen wir Wörter!",
            sentences: "Jetzt lesen wir Sätze!",
            review: "Jetzt üben wir alles, was du schon kannst!",
            theEnd: "Ende! Was für eine schöne Geschichte.",
            levelDone: "Hurra! Du hast das Level geschafft!",
            sticker: "Du hast einen neuen Sticker gewonnen!",
            allDone: "Du hast den ganzen Pfad geschafft. Du bist ein super Leser!",
            hereItIs: "Hier ist es! Tippe darauf.",
            praise1: "Ja!", praise2: "Toll gemacht!", praise3: "Super!", praise4: "Prima!",
            praise5: "Genau richtig!", praise6: "Klasse!", praise7: "Wunderbar!", praise8: "Juhu, du kannst lesen!",
            retry1: "Hoppla! Versuch es noch einmal.", retry2: "Fast! Probier es nochmal.", retry3: "Hör noch einmal hin.", retry4: "Beinahe! Noch ein Versuch."
        }
    };

    en.names = names(en.sounds, englishName);
    en.introTemplate = "This is {name}. {name}, like {word}!";
    de.names = names(de.sounds, germanName);
    de.introTemplate = "Das ist {name}. {name} wie {word}!";

    // Collectable rewards, one per level across the three paths, shown in the sticker book.
    const stickers = ["butterfly", "turtle", "koala", "unicorn", "panda", "rocket", "flamingo", "parrot", "trex",
        "rainbow", "teddy", "crown", "dragon", "otter", "peacock", "sloth", "hamster", "kangaroo", "giraffe",
        "elephant", "polarbear", "castle", "trophy", "hedgehog", "owl", "penguin", "dolphin", "frog", "monkey",
        "octopus", "whale", "chick", "snail", "sunflower", "cake", "balloon", "gem", "lion", "zebra", "medal", "fox"];

    return { en, de, stickers, paths: ["letters", "words", "stories"] };
})();
