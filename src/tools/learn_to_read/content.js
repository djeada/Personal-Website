window.PhonicsContent = (() => {
    "use strict";


    const pairs = (text) => Object.fromEntries(text.trim().split(/\s+/).map((pair) => {
        const [key, ...rest] = pair.split(":");
        return [key, rest.join(":")];
    }));
    const page = (text, target, pics) => ({
        text,
        target,
        pics: pics.split(" ")
    });
    const sentence = (text, answer) => ({
        text,
        answer
    });
    const question = (text, answer, others) => ({
        text,
        answer,
        others: others.split(" ")
    });

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

        teams: ["sh", "ch", "th", "ng", "ck", "ee", "oo", "ar", "oa", "qu"],

        sounds: {
            s: ["sun", "start"],
            a: ["apple", "start"],
            t: ["tiger", "start"],
            p: ["pig", "start"],
            i: ["insect", "start"],
            n: ["nest", "start"],
            m: ["mouse", "start"],
            d: ["dog", "start"],
            g: ["goat", "start"],
            o: ["octopus", "start"],
            c: ["cat", "start"],
            k: ["kite", "start"],
            e: ["egg", "start"],
            u: ["umbrella", "start"],
            r: ["rabbit", "start"],
            h: ["horse", "start"],
            b: ["bear", "start"],
            f: ["fish", "start"],
            l: ["lion", "start"],
            j: ["jellyfish", "start"],
            v: ["violin", "start"],
            w: ["whale", "start"],
            x: ["fox", "end"],
            y: ["yoyo", "start"],
            z: ["zebra", "start"],
            qu: ["queen", "start"],
            sh: ["ship", "start"],
            ch: ["chick", "start"],
            th: ["thumb", "start"],
            ng: ["ring", "end"],
            ck: ["duck", "end"],
            ee: ["bee", "in"],
            oo: ["moon", "in"],
            ar: ["car", "in"],
            oa: ["boat", "in"]
        },

        phonemes: pairs(`s:s a:æ t:t p:p i:ɪ n:n m:m d:d g:ɡ o:ɑ c:k k:k ck:k e:ɛ u:ʌ r:ɹ h:h b:b f:f
            l:l j:ʤ v:v w:w x:ks y:j z:z qu:kw sh:ʃ ch:ʧ th:θ ng:ŋ ee:i oo:u ar:ɑɹ oa:O`),

        pictures: pairs(`sun:sun apple:apple tiger:tiger pig:pig insect:insect nest:nest mouse:mouse dog:dog
            goat:goat octopus:octopus cat:cat kite:kite egg:egg umbrella:umbrella rabbit:rabbit horse:horse
            bear:bear fish:fish lion:lion jellyfish:jellyfish violin:violin whale:whale fox:fox yoyo:yoyo
            zebra:zebra queen:queen ship:ship chick:chick thumb:thumb ring:ring duck:duck bee:bee moon:moon
            car:car boat:boat ant:ant pin:pin tin:tin pan:pan nap:nap map:map man:man pot:pot cap:cap
            cup:cup nut:nut net:net pen:pen mug:mug rat:rat hat:hat hen:hen bed:bed bus:bus bug:bug fan:fan
            bat:bat frog:frog drum:drum tent:tent log:log leg:leg jet:jet van:van web:web lemon:lemon
            melon:melon shell:shell chips:chips bath:bath sock:sock rock:rock box:box tree:tree sheep:sheep
            boot:boot spoon:spoon star:star shark:shark coat:coat`),
        spelling: {
            yoyo: "yo-yo"
        },
        paths: {
            letters: {
                lowercaseFrom: 10,
                levels: [{
                        kind: "letters",
                        items: "s a t"
                    }, {
                        kind: "letters",
                        items: "p i n"
                    }, {
                        kind: "letters",
                        items: "m d g o"
                    },
                    {
                        kind: "review"
                    }, {
                        kind: "letters",
                        items: "c k e u"
                    }, {
                        kind: "letters",
                        items: "r h b f"
                    },
                    {
                        kind: "review"
                    }, {
                        kind: "letters",
                        items: "l j v w"
                    }, {
                        kind: "letters",
                        items: "x y z qu"
                    },
                    {
                        kind: "review"
                    }, {
                        kind: "small",
                        items: "s a t p i n m d"
                    }, {
                        kind: "small",
                        items: "g o c k e u r h"
                    },
                    {
                        kind: "small",
                        items: "b f l j v w x y z qu"
                    }, {
                        kind: "letters",
                        items: "sh ch th"
                    },
                    {
                        kind: "letters",
                        items: "ng ck"
                    }, {
                        kind: "letters",
                        items: "ee oo ar oa"
                    }, {
                        kind: "review"
                    }
                ]
            },
            words: {
                lowercaseFrom: 8,
                levels: [{
                        kind: "words",
                        items: "ant pin tin pan nap"
                    }, {
                        kind: "words",
                        items: "map man dog pig pot"
                    },
                    {
                        kind: "words",
                        items: "cat cap cup nut sun net pen mug"
                    }, {
                        kind: "review"
                    },
                    {
                        kind: "words",
                        items: "rat hat hen bed bus bug fan bat"
                    }, {
                        kind: "words",
                        items: "frog drum tent nest"
                    },
                    {
                        kind: "words",
                        items: "log leg jet van web lemon melon"
                    }, {
                        kind: "review"
                    },
                    {
                        kind: "words",
                        items: "ship shell fish chips bath"
                    }, {
                        kind: "words",
                        items: "chick sock duck rock ring box fox"
                    },
                    {
                        kind: "words",
                        items: "bee tree sheep moon boot spoon"
                    }, {
                        kind: "words",
                        items: "car star shark boat coat goat"
                    },
                    {
                        kind: "review"
                    }
                ]
            },
            stories: {
                lowercaseFrom: 4,
                levels: [{
                        kind: "sentences",
                        mode: "picture",
                        items: "0 1 2 3 4 5"
                    }, {
                        kind: "story",
                        story: "dogpig"
                    },
                    {
                        kind: "sentences",
                        mode: "cloze",
                        items: "6 7 8 9 10 11"
                    }, {
                        kind: "story",
                        story: "cathat"
                    },
                    {
                        kind: "sentences",
                        mode: "order",
                        items: "12 13 14 15 16 17"
                    }, {
                        kind: "story",
                        story: "foxbox"
                    },
                    {
                        kind: "sentences",
                        mode: "mix",
                        items: "18 19 20 21 22 23"
                    }, {
                        kind: "story",
                        story: "moonboat"
                    },
                    {
                        kind: "story",
                        story: "beetree"
                    }, {
                        kind: "review"
                    }
                ]
            }
        },

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
            dogpig: {
                title: "Dog and Pig",
                cover: "dog",
                pages: [
                    page("A dog sat.", "dog", "dog"), page("A pig sat.", "pig", "pig"),
                    page("The dog and the pig nap.", "nap", "dog pig")
                ],
                questions: [question("Who sat first?", "dog", "pig cat"), question("Who sat with the dog?", "pig", "hen duck")]
            },
            cathat: {
                title: "The Cat and the Hat",
                cover: "cat",
                pages: [
                    page("A cat has a hat.", "hat", "cat hat"), page("The hat is on the bed.", "bed", "hat bed"),
                    page("A rat sat on the hat!", "rat", "rat hat"), page("The cat is sad. The rat is glad.", "sad", "cat rat")
                ],
                questions: [question("What did the cat have?", "hat", "cup box"), question("Who sat on the hat?", "rat", "dog pig")]
            },
            foxbox: {
                title: "A Fox in a Box",
                cover: "fox",
                pages: [
                    page("A fox got in a box.", "box", "fox box"), page("A hen sat on the box.", "hen", "hen box"),
                    page("The hen fell off.", "fell", "hen"), page("The fox and the hen had fun.", "fun", "fox hen")
                ],
                questions: [question("Where did the fox go?", "box", "bed bus"), question("Who sat on the box?", "hen", "cat duck")]
            },
            moonboat: {
                title: "The Moon Boat",
                cover: "boat",
                pages: [
                    page("A goat is in a boat.", "boat", "goat boat"), page("The goat can see a shark.", "shark", "goat shark"),
                    page("The shark can swim to the moon.", "moon", "shark moon"), page("The goat and the shark sleep.", "sleep", "goat moon")
                ],
                questions: [question("Where is the goat?", "boat", "car bus"), question("What did the goat see?", "shark", "fish duck")]
            },
            beetree: {
                title: "The Bee and the Frog",
                cover: "bee",
                pages: [
                    page("A bee sat on a tree.", "tree", "bee tree"), page("The bee met a frog.", "frog", "bee frog"),
                    page("The frog sat on a log.", "log", "frog log"), page("The bee and the frog had fun.", "fun", "bee frog")
                ],
                questions: [question("Who sat on the tree?", "bee", "ant duck"), question("Who did the bee meet?", "frog", "fish sheep")]
            }
        },

        lines: {
            welcome: "Hi, I'm Finn! Let's learn to read together.",
            startQ: "Which letter does it start with?",
            endQ: "Which letter does it end with?",
            inQ: "Which letters can you hear in the middle?",
            findStart: "Which picture starts with this letter?",
            findEnd: "Which picture ends with this letter?",
            findIn: "Which picture has these letters?",
            findIt: "Now find the letter",
            huntQ: "Find every letter you hear!",
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
            praise1: "Yes!",
            praise2: "Great job!",
            praise3: "Well done!",
            praise4: "Super!",
            praise5: "You got it!",
            praise6: "Fantastic!",
            praise7: "Brilliant!",
            praise8: "Wow, you are a reader!",
            retry1: "Oops! Try again.",
            retry2: "Almost! Have another go.",
            retry3: "Listen again.",
            retry4: "Nearly! Try once more."
        }
    };

    const de = {
        locale: "de-DE",
        teams: ["sch", "ch", "ck", "ei", "au", "eu", "ie", "qu", "pf"],
        sounds: {
            m: ["Maus", "start"],
            a: ["Apfel", "start"],
            o: ["Oma", "start"],
            l: ["Lama", "start"],
            i: ["Igel", "start"],
            s: ["Sonne", "start"],
            e: ["Esel", "start"],
            r: ["Rose", "start"],
            n: ["Nase", "start"],
            t: ["Tiger", "start"],
            u: ["Uhr", "start"],
            d: ["Delfin", "start"],
            h: ["Hund", "start"],
            b: ["Ball", "start"],
            f: ["Fisch", "start"],
            w: ["Wal", "start"],
            k: ["Kuh", "start"],
            p: ["Pinguin", "start"],
            g: ["Gans", "start"],
            z: ["Zebra", "start"],
            j: ["Jacke", "start"],
            v: ["Vogel", "start"],
            sch: ["Schaf", "start"],
            ch: ["Buch", "end"],
            ei: ["Eis", "start"],
            au: ["Auto", "start"],
            ie: ["Biene", "in"],
            eu: ["Eule", "start"],
            "ä": ["Bär", "in"],
            "ö": ["Löwe", "in"],
            "ü": ["Tür", "in"],
            st: ["Stern", "start"],
            sp: ["Spinne", "start"],
            qu: ["Qualle", "start"],
            pf: ["Pferd", "start"]
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

        tiles: {
            Stern: ["St", "e", "r", "n"],
            Spinne: ["Sp", "i", "n", "n", "e"],
            Stift: ["St", "i", "f", "t"],
            Spiegel: ["Sp", "ie", "g", "e", "l"]
        },
        paths: {
            letters: {
                lowercaseFrom: 9,
                levels: [{
                        kind: "letters",
                        items: "m a o"
                    }, {
                        kind: "letters",
                        items: "l i s"
                    }, {
                        kind: "letters",
                        items: "e r n t"
                    },
                    {
                        kind: "review"
                    }, {
                        kind: "letters",
                        items: "u d h b"
                    }, {
                        kind: "letters",
                        items: "f w k p"
                    },
                    {
                        kind: "review"
                    }, {
                        kind: "letters",
                        items: "g z j v"
                    }, {
                        kind: "review"
                    },
                    {
                        kind: "small",
                        items: "m a o l i s e r"
                    }, {
                        kind: "small",
                        items: "n t u d h b f w"
                    },
                    {
                        kind: "small",
                        items: "k p g z j v"
                    }, {
                        kind: "letters",
                        items: "sch ch ei au"
                    },
                    {
                        kind: "letters",
                        items: "ie eu ä ö ü"
                    }, {
                        kind: "letters",
                        items: "st sp qu pf"
                    }, {
                        kind: "review"
                    }
                ]
            },
            words: {
                lowercaseFrom: 9,
                levels: [{
                        kind: "words",
                        items: "Mama Oma Lama"
                    }, {
                        kind: "words",
                        items: "Esel Rose Nase Ente Nest"
                    },
                    {
                        kind: "words",
                        items: "Tomate Melone Note Sonne"
                    }, {
                        kind: "review"
                    },
                    {
                        kind: "words",
                        items: "Hut Bus Dose Hose Hase"
                    }, {
                        kind: "words",
                        items: "Banane Hund Ball Brot Mund"
                    },
                    {
                        kind: "words",
                        items: "Sofa Salat Wolke Kamel Panda"
                    }, {
                        kind: "words",
                        items: "Pilz Tulpe Affe Opa Papa Kanu"
                    },
                    {
                        kind: "review"
                    }, {
                        kind: "words",
                        items: "Igel Gurke Zelt Zebra Jojo Gans Vogel"
                    },
                    {
                        kind: "words",
                        items: "Fisch Schaf Tasche Buch Milch Kuchen"
                    }, {
                        kind: "words",
                        items: "Eis Ei Haus Maus Baum Auto"
                    },
                    {
                        kind: "words",
                        items: "Biene Ziege Brief Eule Feuer"
                    }, {
                        kind: "words",
                        items: "Bär Käse Löwe Tür Hütte Mücke"
                    },
                    {
                        kind: "words",
                        items: "Stern Stift Spinne Spiegel Qualle Pferd Apfel Topf"
                    }, {
                        kind: "review"
                    }
                ]
            },
            stories: {
                lowercaseFrom: 4,
                levels: [{
                        kind: "sentences",
                        mode: "picture",
                        items: "0 1 2 3 4 5"
                    }, {
                        kind: "story",
                        story: "lotte"
                    },
                    {
                        kind: "sentences",
                        mode: "cloze",
                        items: "6 7 8 9 10 11"
                    }, {
                        kind: "story",
                        story: "hund"
                    },
                    {
                        kind: "sentences",
                        mode: "order",
                        items: "12 13 14 15 16 17"
                    }, {
                        kind: "story",
                        story: "eule"
                    },
                    {
                        kind: "sentences",
                        mode: "mix",
                        items: "18 19 20 21 22 23"
                    }, {
                        kind: "story",
                        story: "stern"
                    },
                    {
                        kind: "story",
                        story: "fisch"
                    }, {
                        kind: "review"
                    }
                ]
            }
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
            lotte: {
                title: "Lama Lotte",
                cover: "llama",
                pages: [
                    page("Lotte ist ein Lama.", "Lama", "llama"), page("Lotte mag Melone.", "Melone", "llama melon"),
                    page("Oma hat eine Rose.", "Rose", "grandma rose"), page("Lotte isst die Rose!", "isst", "llama rose")
                ],
                questions: [question("Was mag Lotte?", "Melone", "Banane Apfel"), question("Was hat Oma?", "Rose", "Tulpe Buch")]
            },
            hund: {
                title: "Der Hund und der Ball",
                cover: "dog",
                pages: [
                    page("Der Hund hat einen Ball.", "Ball", "dog ball"), page("Der Ball rollt zum Sofa.", "Sofa", "ball sofa"),
                    page("Unter dem Sofa sitzt eine Maus.", "Maus", "sofa mouse"), page("Hund und Maus spielen Ball.", "Hund", "dog mouse")
                ],
                questions: [question("Was hat der Hund?", "Ball", "Brot Hut"), question("Wer sitzt unter dem Sofa?", "Maus", "Hase Ente")]
            },
            eule: {
                title: "Die Eule im Baum",
                cover: "owl",
                pages: [
                    page("Im Baum sitzt eine Eule.", "Eule", "tree owl"), page("Die Eule sieht eine Biene.", "Biene", "owl bee"),
                    page("Die Biene fliegt zum Haus.", "Haus", "bee house"), page("Die Eule schläft im Baum.", "Baum", "owl tree")
                ],
                questions: [question("Wo sitzt die Eule?", "Baum", "Haus Auto"), question("Was sieht die Eule?", "Biene", "Fisch Vogel")]
            },
            stern: {
                title: "Der kleine Stern",
                cover: "star",
                pages: [
                    page("Am Himmel ist ein Stern.", "Stern", "star"), page("Ein Pferd sieht den Stern.", "Pferd", "horse star"),
                    page("Das Pferd springt hoch.", "springt", "horse"), page("Gute Nacht, kleiner Stern!", "Nacht", "star moon")
                ],
                questions: [question("Was ist am Himmel?", "Stern", "Sonne Wolke"), question("Wer sieht den Stern?", "Pferd", "Kuh Esel")]
            },
            fisch: {
                title: "Der Fisch im See",
                cover: "fish",
                pages: [
                    page("Im See ist ein Fisch.", "Fisch", "fish"), page("Eine Ente schwimmt zum Fisch.", "Ente", "duck fish"),
                    page("Ente und Fisch spielen.", "spielen", "duck fish"), page("Dann schlafen sie.", "schlafen", "duck moon")
                ],
                questions: [question("Wer lebt im See?", "Fisch", "Kuh Hund"), question("Wer schwimmt zum Fisch?", "Ente", "Eule Bär")]
            }
        },
        lines: {
            welcome: "Hallo, ich bin Finn! Komm, wir lernen zusammen lesen.",
            startQ: "Mit welchem Buchstaben fängt das an?",
            endQ: "Mit welchem Buchstaben hört das auf?",
            inQ: "Welche Buchstaben hörst du in der Mitte?",
            findStart: "Welches Bild fängt mit diesem Buchstaben an?",
            findEnd: "Welches Bild hört mit diesem Buchstaben auf?",
            findIn: "In welchem Bild stecken diese Buchstaben?",
            findIt: "Jetzt finde den Buchstaben",
            huntQ: "Finde jeden Buchstaben, den du hörst!",
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
            praise1: "Ja!",
            praise2: "Toll gemacht!",
            praise3: "Super!",
            praise4: "Prima!",
            praise5: "Genau richtig!",
            praise6: "Klasse!",
            praise7: "Wunderbar!",
            praise8: "Juhu, du kannst lesen!",
            retry1: "Hoppla! Versuch es noch einmal.",
            retry2: "Fast! Probier es nochmal.",
            retry3: "Hör noch einmal hin.",
            retry4: "Beinahe! Noch ein Versuch."
        }
    };


    const ar = {
        locale: "ar-SA",
        rtl: true,
        caseless: true,
        connected: true,
        teams: [],
        sounds: {
            "أ": ["أرنب", "start"],
            "ب": ["بطة", "start"],
            "ت": ["تفاحة", "start"],
            "ث": ["ثعلب", "start"],
            "ج": ["جمل", "start"],
            "ح": ["حصان", "start"],
            "خ": ["خروف", "start"],
            "د": ["دب", "start"],
            "ذ": ["ذرة", "start"],
            "ر": ["ريشة", "start"],
            "ز": ["زرافة", "start"],
            "س": ["سمكة", "start"],
            "ش": ["شمس", "start"],
            "ص": ["صاروخ", "start"],
            "ض": ["ضفدع", "start"],
            "ط": ["طائرة", "start"],
            "ظ": ["ظرف", "start"],
            "ع": ["عنب", "start"],
            "غ": ["غيمة", "start"],
            "ف": ["فيل", "start"],
            "ق": ["قمر", "start"],
            "ك": ["كلب", "start"],
            "ل": ["ليمون", "start"],
            "م": ["موز", "start"],
            "ن": ["نحلة", "start"],
            "ه": ["هدية", "start"],
            "و": ["وردة", "start"],
            "ي": ["يويو", "start"],
            "ة": ["شجرة", "end"],
            "ا": ["باب", "in"]
        },
        phonemes: pairs(`أ:ʔ ا:aː ب:b ت:t ث:θ ج:ʒ ح:ħ خ:x د:d ذ:ð ر:r ز:z س:s ش:ʃ ص:sˤ ض:dˤ ط:tˤ ظ:ðˤ ع:ʕ
            غ:ɣ ف:f ق:q ك:k ل:l م:m ن:n ه:h و:w ي:j ة:at`),
        pictures: pairs(`أرنب:rabbit بطة:duck تفاحة:apple ثعلب:fox جمل:camel حصان:horse خروف:sheep دب:bear ذرة:corn
            ريشة:feather زرافة:giraffe سمكة:fish شمس:sun صاروخ:rocket ضفدع:frog طائرة:jet ظرف:letter عنب:grapes
            غيمة:cloud فيل:elephant قمر:moon كلب:dog ليمون:lemon موز:banana نحلة:bee هدية:gift وردة:rose يويو:yoyo
            شجرة:tree باب:door بيت:house نمر:tiger قلم:pencil فم:mouth عش:nest نار:fire خبز:bread كرة:ball قطة:cat
            نجمة:star كتاب:book حليب:milk قارب:boat جبن:cheese خيمة:tent بقرة:cow دجاجة:hen بيضة:egg سيارة:car
            حافلة:bus ساعة:clock كعكة:cake قبعة:hat قرد:monkey ملعقة:spoon مظلة:umbrella جورب:sock دلفين:dolphin
            طماطم:tomato أسد:lion أنف:nose`),
        names: pairs(`أ:ألف ا:ألف ب:باء ت:تاء ث:ثاء ج:جيم ح:حاء خ:خاء د:دال ذ:ذال ر:راء ز:زاي س:سين ش:شين ص:صاد
            ض:ضاد ط:طاء ظ:ظاء ع:عين غ:غين ف:فاء ق:قاف ك:كاف ل:لام م:ميم ن:نون ه:هاء و:واو ي:ياء ة:تاء_مربوطة`),
        paths: {
            letters: {
                lowercaseFrom: 0,
                levels: [{
                        kind: "letters",
                        items: "أ ب ت"
                    }, {
                        kind: "letters",
                        items: "ث ج ح"
                    }, {
                        kind: "letters",
                        items: "خ د ذ"
                    },
                    {
                        kind: "review"
                    }, {
                        kind: "letters",
                        items: "ر ز س"
                    }, {
                        kind: "letters",
                        items: "ش ص ض"
                    },
                    {
                        kind: "review"
                    }, {
                        kind: "letters",
                        items: "ط ظ ع"
                    }, {
                        kind: "letters",
                        items: "غ ف ق"
                    },
                    {
                        kind: "review"
                    }, {
                        kind: "letters",
                        items: "ك ل م"
                    }, {
                        kind: "letters",
                        items: "ن ه و ي"
                    },
                    {
                        kind: "review"
                    }, {
                        kind: "small",
                        items: "أ ب ت ث ج ح خ د"
                    }, {
                        kind: "small",
                        items: "ذ ر ز س ش ص ض ط"
                    },
                    {
                        kind: "small",
                        items: "ظ ع غ ف ق ك ل م ن ه و ي"
                    }, {
                        kind: "letters",
                        items: "ة ا"
                    }, {
                        kind: "review"
                    }
                ]
            },
            words: {
                lowercaseFrom: 0,
                levels: [{
                        kind: "words",
                        items: "بيت باب دب كلب قمر"
                    }, {
                        kind: "words",
                        items: "موز نمر جمل فيل شمس"
                    },
                    {
                        kind: "words",
                        items: "قلم فم عش نار خبز"
                    }, {
                        kind: "review"
                    },
                    {
                        kind: "words",
                        items: "كرة بطة قطة وردة نجمة"
                    }, {
                        kind: "words",
                        items: "كتاب حليب قارب جبن خيمة"
                    },
                    {
                        kind: "words",
                        items: "سمكة بقرة شجرة دجاجة بيضة"
                    }, {
                        kind: "review"
                    },
                    {
                        kind: "words",
                        items: "سيارة حافلة ساعة كعكة قبعة"
                    }, {
                        kind: "words",
                        items: "زرافة ضفدع ثعلب قرد خروف"
                    },
                    {
                        kind: "words",
                        items: "ملعقة مظلة جورب دلفين طماطم"
                    }, {
                        kind: "review"
                    }
                ]
            },
            stories: {
                lowercaseFrom: 0,
                levels: [{
                        kind: "sentences",
                        mode: "picture",
                        items: "0 1 2 3 4 5"
                    }, {
                        kind: "story",
                        story: "qitta"
                    },
                    {
                        kind: "sentences",
                        mode: "cloze",
                        items: "6 7 8 9 10 11"
                    }, {
                        kind: "story",
                        story: "kalb"
                    },
                    {
                        kind: "sentences",
                        mode: "order",
                        items: "12 13 14 15 16 17"
                    }, {
                        kind: "story",
                        story: "samaka"
                    },
                    {
                        kind: "sentences",
                        mode: "mix",
                        items: "18 19 20 21 22 23"
                    }, {
                        kind: "story",
                        story: "nahla"
                    },
                    {
                        kind: "story",
                        story: "qamar"
                    }, {
                        kind: "review"
                    }
                ]
            }
        },
        sentences: [
            sentence("هذه قطة.", "قطة"), sentence("هذا كلب.", "كلب"), sentence("هذا بيت كبير.", "بيت"),
            sentence("هذه وردة حمراء.", "وردة"), sentence("هذه شمس.", "شمس"), sentence("هذا قمر.", "قمر"),
            sentence("مع سامي كرة.", "كرة"), sentence("مع ليلى كتاب.", "كتاب"), sentence("في البيت قطة.", "قطة"),
            sentence("على الشجرة عش.", "عش"), sentence("في البحر سمكة.", "سمكة"), sentence("هذه بطة صغيرة.", "بطة"),
            sentence("هذا فيل كبير.", "فيل"), sentence("عند سامي حصان.", "حصان"), sentence("عند ليلى قلم.", "قلم"),
            sentence("هذه سيارة سريعة.", "سيارة"), sentence("نحلة على وردة.", "نحلة"), sentence("قارب في البحر.", "قارب"),
            sentence("هذا أسد قوي.", "أسد"), sentence("هذه زرافة طويلة.", "زرافة"), sentence("في الكوب حليب.", "حليب"),
            sentence("هذه نجمة لامعة.", "نجمة"), sentence("في الحديقة شجرة.", "شجرة"), sentence("هذا خبز طازج.", "خبز")
        ],
        stories: {
            qitta: {
                title: "القطة والكرة",
                cover: "cat",
                pages: [
                    page("هذه قطة صغيرة.", "قطة", "cat"), page("مع القطة كرة.", "كرة", "cat ball"),
                    page("الكرة تحت السرير.", "تحت", "ball bed"), page("القطة سعيدة الآن.", "سعيدة", "cat")
                ],
                questions: [question("ماذا مع القطة؟", "كرة", "كتاب قلم"), question("من الصغيرة في القصة؟", "قطة", "فيل حصان")]
            },
            kalb: {
                title: "الكلب والبيت",
                cover: "dog",
                pages: [
                    page("هذا كلب.", "كلب", "dog"), page("الكلب يجري إلى البيت.", "يجري", "dog house"),
                    page("في البيت قطة.", "قطة", "house cat"), page("الكلب والقطة صديقان.", "صديقان", "dog cat")
                ],
                questions: [question("إلى أين يجري الكلب؟", "بيت", "قارب سيارة"), question("من في البيت؟", "قطة", "بقرة أسد")]
            },
            samaka: {
                title: "السمكة الصغيرة",
                cover: "fish",
                pages: [
                    page("في البحر سمكة.", "سمكة", "fish"), page("السمكة ترى قاربا.", "ترى", "fish boat"),
                    page("في القارب ولد.", "ولد", "boat"), page("السمكة تسبح بعيدا.", "تسبح", "fish")
                ],
                questions: [question("من في البحر؟", "سمكة", "قطة كلب"), question("ماذا رأت السمكة؟", "قارب", "سيارة حافلة")]
            },
            nahla: {
                title: "النحلة والوردة",
                cover: "bee",
                pages: [
                    page("هذه نحلة.", "نحلة", "bee"), page("النحلة تطير إلى وردة.", "تطير", "bee rose"),
                    page("الوردة حمراء وجميلة.", "حمراء", "rose"), page("النحلة تحب الوردة.", "تحب", "bee rose")
                ],
                questions: [question("من تطير إلى الوردة؟", "نحلة", "ضفدع دب"), question("إلى أين تطير النحلة؟", "وردة", "شجرة بيت")]
            },
            qamar: {
                title: "القمر والنجمة",
                cover: "moon",
                pages: [
                    page("في السماء قمر.", "قمر", "moon"), page("قرب القمر نجمة.", "نجمة", "moon star"),
                    page("الولد ينظر إلى السماء.", "ينظر", "star"), page("تصبح على خير يا قمر.", "خير", "moon")
                ],
                questions: [question("ماذا في السماء؟", "قمر", "سمكة قطة"), question("ماذا قرب القمر؟", "نجمة", "وردة كرة")]
            }
        },
        lines: {
            welcome: "مرحبا، أنا فِن! هيا نتعلم القراءة معا.",
            startQ: "بأي حرف تبدأ هذه الكلمة؟",
            endQ: "بأي حرف تنتهي هذه الكلمة؟",
            inQ: "أي حرف تسمع في وسط الكلمة؟",
            findStart: "أي صورة تبدأ بهذا الحرف؟",
            findEnd: "أي صورة تنتهي بهذا الحرف؟",
            findIn: "في أي صورة تسمع هذا الحرف؟",
            findIt: "الآن ابحث عن حرف",
            huntQ: "ابحث عن كل حرف تسمعه!",
            smallQ: "أي شكل يناسب هذا الحرف؟",
            small: "هيا نتعرف على أشكال الحروف!",
            build: "هيا نبني كلمة",
            missingQ: "أي حرف ناقص؟",
            read: "اقرأ الكلمة، ثم اضغط على الصورة الصحيحة.",
            matchQ: "أي كلمة تناسب الصورة؟",
            sentencePicQ: "اقرأ الجملة. أي صورة تناسبها؟",
            clozeQ: "أي كلمة ناقصة؟ انظر إلى الصورة.",
            orderQ: "رتب الكلمات بالترتيب الصحيح.",
            questions: "والآن سؤال عن القصة!",
            storyFind: "هل تجد كلمة",
            storyStart: "وقت القصة! اضغط على أي كلمة لتسمعها.",
            sounds: "حروف جديدة تنتظرك!",
            words: "هيا نبني كلمات!",
            sentences: "هيا نقرأ جملا!",
            review: "هيا نتدرب على كل ما تعرفه!",
            theEnd: "النهاية! يا لها من قصة جميلة.",
            levelDone: "رائع! أنهيت المستوى!",
            sticker: "حصلت على ملصق جديد!",
            allDone: "أنهيت الطريق كله. أنت قارئ رائع!",
            hereItIs: "ها هي! اضغط عليها.",
            praise1: "نعم!",
            praise2: "أحسنت!",
            praise3: "عمل رائع!",
            praise4: "ممتاز!",
            praise5: "إجابة صحيحة!",
            praise6: "رائع جدا!",
            praise7: "مدهش!",
            praise8: "أنت تقرأ بشكل رائع!",
            retry1: "حاول مرة أخرى.",
            retry2: "قريب! جرب مرة ثانية.",
            retry3: "استمع مرة أخرى.",
            retry4: "تقريبا! محاولة أخرى."
        }
    };

    ar.names = Object.fromEntries(Object.entries(ar.names).map(([letter, name]) => [letter, name.replace(/_/g, " ")]));
    ar.introTemplate = "هذا حرف {name}. {name}، مثل {word}!";

    en.names = names(en.sounds, englishName);
    en.introTemplate = "This is {name}. {name}, like {word}!";
    de.names = names(de.sounds, germanName);
    de.names.ck = germanName("ck");
    de.introTemplate = "Das ist {name}. {name} wie {word}!";


    const stickers = ["butterfly", "turtle", "koala", "unicorn", "panda", "rocket", "flamingo", "parrot", "trex",
        "rainbow", "teddy", "crown", "dragon", "otter", "peacock", "sloth", "hamster", "kangaroo", "giraffe",
        "elephant", "polarbear", "castle", "trophy", "hedgehog", "owl", "penguin", "dolphin", "frog", "monkey",
        "octopus", "whale", "chick", "snail", "sunflower", "cake", "balloon", "gem", "lion", "zebra", "medal", "fox"
    ];

    return {
        en,
        de,
        ar,
        stickers,
        languages: ["en", "de", "ar"],
        paths: ["letters", "words", "stories"]
    };
})();