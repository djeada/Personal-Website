(function(root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.DDDSentences = api;
})(typeof self !== "undefined" ? self : this, function() {
    "use strict";

    const CASES = {
        nominative: "Nominative",
        accusative: "Accusative",
        dative: "Dative",
        genitive: "Genitive"
    };
    const GENDERS = {
        m: "masculine",
        f: "feminine",
        n: "neuter",
        p: "plural"
    };
    const FORMS = {
        definite: {
            nominative: {
                m: "der",
                f: "die",
                n: "das",
                p: "die"
            },
            accusative: {
                m: "den",
                f: "die",
                n: "das",
                p: "die"
            },
            dative: {
                m: "dem",
                f: "der",
                n: "dem",
                p: "den"
            },
            genitive: {
                m: "des",
                f: "der",
                n: "des",
                p: "der"
            }
        },
        indefinite: {
            nominative: {
                m: "ein",
                f: "eine",
                n: "ein"
            },
            accusative: {
                m: "einen",
                f: "eine",
                n: "ein"
            },
            dative: {
                m: "einem",
                f: "einer",
                n: "einem"
            },
            genitive: {
                m: "eines",
                f: "einer",
                n: "eines"
            }
        }
    };
    const CHOICES = {
        definite: ["der", "die", "das", "den", "dem", "des"],
        indefinite: ["ein", "eine", "einen", "einem", "einer", "eines"]
    };




    const CONTEXTS = {
        nominative: [
            ["m", "", " Mann wartet vor der Tür.", "Mann", "The man is waiting outside the door.", "A man is waiting outside the door.", "The man is the subject: who is waiting?"],
            ["m", "", " Hund schläft auf dem Sofa.", "Hund", "The dog is sleeping on the sofa.", "A dog is sleeping on the sofa.", "The dog is the subject of schläft."],
            ["m", "Heute kommt ", " Freund zu Besuch.", "Freund", "The friend is visiting today.", "A friend is visiting today.", "The friend is the subject of kommt, even after the verb."],
            ["f", "", " Frau liest ein Buch.", "Frau", "The woman is reading a book.", "A woman is reading a book.", "The woman is the subject: who is reading?"],
            ["f", "Auf dem Tisch liegt ", " Zeitung.", "Zeitung", "The newspaper is on the table.", "A newspaper is on the table.", "The newspaper is the subject of liegt."],
            ["f", "", " Katze sitzt am Fenster.", "Katze", "The cat is sitting by the window.", "A cat is sitting by the window.", "The cat is the subject of sitzt."],
            ["n", "", " Kind spielt im Garten.", "Kind", "The child is playing in the garden.", "A child is playing in the garden.", "The child is the subject: who is playing?"],
            ["n", "Dort steht ", " Haus am See.", "Haus", "The house is by the lake.", "A house is by the lake.", "The house is the subject of steht."],
            ["n", "", " Fahrrad steht vor der Schule.", "Fahrrad", "The bicycle is outside the school.", "A bicycle is outside the school.", "The bicycle is the subject of steht."],
            ["p", "", " Kinder spielen im Park.", "Kinder", "The children are playing in the park.", null, "The children are the plural subject of spielen."],
            ["p", "", " Bücher liegen auf dem Tisch.", "Bücher", "The books are on the table.", null, "The books are the plural subject of liegen."],
            ["p", "Heute kommen ", " Gäste zum Essen.", "Gäste", "The guests are coming for a meal today.", null, "The guests are the plural subject of kommen."]
        ],
        accusative: [
            ["m", "Ich sehe ", " Mann an der Haltestelle.", "Mann", "I see the man at the bus stop.", "I see a man at the bus stop.", "The person seen is the direct object of sehen."],
            ["m", "Wir suchen ", " Schlüssel.", "Schlüssel", "We are looking for the key.", "We are looking for a key.", "suchen takes a direct object in the accusative."],
            ["m", "Sie hat ", " Hund.", "Hund", "She has the dog.", "She has a dog.", "haben takes a direct object in the accusative."],
            ["f", "Er kauft ", " Zeitung am Bahnhof.", "Zeitung", "He buys the newspaper at the station.", "He buys a newspaper at the station.", "The thing bought is the direct object of kaufen."],
            ["f", "Ich öffne ", " Tür.", "Tür", "I open the door.", "I open a door.", "The door is the direct object of öffnen."],
            ["f", "Wir brauchen ", " Tasche.", "Tasche", "We need the bag.", "We need a bag.", "brauchen takes a direct object in the accusative."],
            ["n", "Sie liest ", " Buch.", "Buch", "She is reading the book.", "She is reading a book.", "The thing read is the direct object of lesen."],
            ["n", "Ich kaufe ", " Fahrrad.", "Fahrrad", "I buy the bicycle.", "I buy a bicycle.", "The bicycle is the direct object of kaufen."],
            ["n", "Wir sehen ", " Haus am Fluss.", "Haus", "We see the house by the river.", "We see a house by the river.", "The house is the direct object of sehen."],
            ["p", "Ich besuche ", " Freunde am Wochenende.", "Freunde", "I visit the friends at the weekend.", null, "besuchen takes a direct object in the accusative."],
            ["p", "Sie kauft ", " Äpfel auf dem Markt.", "Äpfel", "She buys the apples at the market.", null, "The apples are the plural direct object of kaufen."],
            ["p", "Wir lesen ", " Briefe.", "Briefe", "We are reading the letters.", null, "The letters are the plural direct object of lesen."]
        ],
        dative: [
            ["m", "Ich helfe ", " Mann beim Tragen.", "Mann", "I help the man carry things.", "I help a man carry things.", "helfen always takes the dative."],
            ["m", "Sie spricht mit ", " Lehrer.", "Lehrer", "She is talking with the teacher.", "She is talking with a teacher.", "The preposition mit always takes the dative."],
            ["m", "Wir fahren mit ", " Bus zur Schule.", "Bus", "We take the bus to school.", "We take a bus to school.", "The preposition mit always takes the dative."],
            ["f", "Er dankt ", " Frau für die Hilfe.", "Frau", "He thanks the woman for her help.", "He thanks a woman for her help.", "danken takes the dative for the person thanked."],
            ["f", "Ich fahre mit ", " Freundin nach Berlin.", "Freundin", "I am travelling to Berlin with the friend.", "I am travelling to Berlin with a friend.", "The preposition mit always takes the dative."],
            ["f", "Das Paket kommt aus ", " Stadt in Österreich.", "Stadt", "The parcel comes from the town in Austria.", "The parcel comes from a town in Austria.", "The preposition aus always takes the dative."],
            ["n", "Sie hilft ", " Kind bei den Hausaufgaben.", "Kind", "She helps the child with homework.", "She helps a child with homework.", "helfen always takes the dative."],
            ["n", "Er fährt mit ", " Fahrrad zur Arbeit.", "Fahrrad", "He rides the bicycle to work.", "He rides a bicycle to work.", "The preposition mit always takes the dative."],
            ["n", "Wir wohnen in ", " Haus am See.", "Haus", "We live in the house by the lake.", "We live in a house by the lake.", "in takes the dative here because it describes a location: where do we live?"],
            ["p", "Ich spiele mit ", " Kindern im Garten.", "Kinder", "I play with the children in the garden.", null, "mit takes the dative. Dative plurals usually add -n: Kinder → Kindern."],
            ["p", "Sie spricht mit ", " Freunden.", "Freunde", "She is talking with the friends.", null, "mit takes the dative. The plural Freunde becomes Freunden."],
            ["p", "Wir fahren mit ", " Autos zum See.", "Autos", "We drive to the lake in the cars.", null, "mit takes the dative. Plurals ending in -s do not add another -n."]
        ],
        genitive: [
            ["m", "Das Auto ", " Mannes steht draußen.", "Mann", "The man's car is outside.", "A man's car is outside.", "The genitive shows whose car it is. Mann also takes the ending -es."],
            ["m", "Die Tasche ", " Lehrers liegt hier.", "Lehrer", "The teacher's bag is here.", "A teacher's bag is here.", "The genitive shows possession. Lehrer also takes the ending -s."],
            ["m", "Das Fell ", " Hundes ist weich.", "Hund", "The dog's fur is soft.", "A dog's fur is soft.", "The genitive shows whose fur it is. Hund also takes the ending -es."],
            ["f", "Das Fahrrad ", " Frau steht im Hof.", "Frau", "The woman's bicycle is in the courtyard.", "A woman's bicycle is in the courtyard.", "The genitive shows whose bicycle it is. Feminine nouns do not add a genitive ending."],
            ["f", "Die Fenster ", " Schule sind offen.", "Schule", "The windows of the school are open.", "The windows of a school are open.", "The genitive links the windows to the school."],
            ["f", "Das Ende ", " Geschichte überrascht mich.", "Geschichte", "The ending of the story surprises me.", "The ending of a story surprises me.", "The genitive links the ending to the story."],
            ["n", "Das Spielzeug ", " Kindes liegt auf dem Boden.", "Kind", "The child's toy is on the floor.", "A child's toy is on the floor.", "The genitive shows whose toy it is. Kind also takes the ending -es."],
            ["n", "Die Tür ", " Hauses ist blau.", "Haus", "The door of the house is blue.", "The door of a house is blue.", "The genitive links the door to the house. Haus also takes the ending -es."],
            ["n", "Der Titel ", " Buches ist lang.", "Buch", "The title of the book is long.", "The title of a book is long.", "The genitive links the title to the book. Buch also takes the ending -es."],
            ["p", "Die Fahrräder ", " Kinder stehen im Hof.", "Kinder", "The children's bicycles are in the courtyard.", null, "The genitive shows whose bicycles they are. The plural article is der."],
            ["p", "Die Seiten ", " Bücher sind vergilbt.", "Bücher", "The pages of the books have yellowed.", null, "The genitive links the pages to the books. The plural article is der."],
            ["p", "Die Namen ", " Gäste stehen auf der Liste.", "Gäste", "The guests' names are on the list.", null, "The genitive shows whose names are listed. The plural article is der."]
        ]
    };

    const exercises = [];
    Object.entries(CONTEXTS).forEach(([grammaticalCase, rows]) => {
        rows.forEach(([gender, before, after, noun, definite, indefinite, reason], index) => {
            ["definite", "indefinite"].forEach((family) => {
                if (family === "indefinite" && gender === "p") return;
                exercises.push({
                    id: `sentence:${family}:${grammaticalCase}:${index}`,
                    family,
                    case: grammaticalCase,
                    gender,
                    before,
                    after,
                    noun,
                    answer: FORMS[family][grammaticalCase][gender],
                    translation: family === "definite" ? definite : indefinite,
                    reason
                });
            });
        });
    });

    function pool(family = "definite", grammaticalCase = "all") {
        return exercises.filter((entry) => (family === "mixed" || entry.family === family) &&
            (grammaticalCase === "all" || entry.case === grammaticalCase));
    }

    function shuffle(items, random) {
        const result = items.slice();
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }


    function deck(entries, random = Math.random) {
        const cases = shuffle(Object.keys(CASES), random).map((grammaticalCase) => {
            const groups = new Map();
            entries.filter((entry) => entry.case === grammaticalCase).forEach((entry) => {
                const key = `${entry.family}:${entry.gender}`;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(entry);
            });
            const queues = shuffle(Array.from(groups.values()), random).map((group) => shuffle(group, random));
            const result = [];
            while (queues.some((queue) => queue.length)) {
                queues.forEach((queue) => {
                    if (queue.length) result.push(queue.shift());
                });
            }
            return result;
        });
        const result = [];
        while (cases.some((queue) => queue.length)) {
            cases.forEach((queue) => {
                if (queue.length) result.push(queue.shift());
            });
        }
        return result;
    }

    function choices(family) {
        return family === "mixed" ? [...CHOICES.definite, ...CHOICES.indefinite] : CHOICES[family].slice();
    }

    function displayAnswer(entry) {
        return entry.before ? entry.answer : entry.answer[0].toUpperCase() + entry.answer.slice(1);
    }

    function sentence(entry) {
        return entry.before + displayAnswer(entry) + entry.after;
    }

    function explain(entry) {
        const form = entry.after.trim().split(/[\s.,!?]/)[0];
        const base = FORMS[entry.family].nominative[entry.gender];
        return `${CASES[entry.case]} · ${GENDERS[entry.gender]} · ${entry.family}. ${entry.reason} ${base} ${entry.noun} → ${entry.answer} ${form}.`;
    }

    return {
        CASES,
        GENDERS,
        FORMS,
        exercises,
        pool,
        deck,
        choices,
        displayAnswer,
        sentence,
        explain
    };
});