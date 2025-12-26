'use strict';
const $ = selector => document.querySelector(selector);


class Line {
    constructor(sz) {
        this.valid = false;
        this.tag = null;
        this.data = new Array(sz).fill(null);
        this.lru = 0;
    }
}

class Sim {
    constructor(cfg) {
        this.cfg = cfg;
        this.ram = Array.from({
            length: cfg.ram
        }, (_, addr) => ({
            addr,
            value: Math.floor(Math.random() * 256)
        }));
        this.sets = cfg.lines / cfg.assoc;
        this.cache = Array.from({
            length: cfg.lines
        }, () => new Line(cfg.blk));
        this.clk = 1;
        this.stats = {
            hits: 0,
            misses: 0,
            prefetches: 0,
            time: 0
        };
        this.last = {
            idx: null,
            result: null,
            addr: null
        };
        this.prefetchedBlocks = [];
    }

    blockNum(addr) {
        return Math.floor(addr / this.cfg.blk);
    }
    offset(addr) {
        return addr % this.cfg.blk;
    }
    setOf(bnum) {
        return bnum % this.sets;
    }
    tagOf(bnum) {
        return Math.floor(bnum / this.sets);
    }
    linesInSet(set) {
        const start = set * this.cfg.assoc;
        return Array.from({
            length: this.cfg.assoc
        }, (_, i) => start + i);
    }

    findLine(set, tag) {
        for (let idx of this.linesInSet(set)) {
            const ln = this.cache[idx];
            if (ln.valid && ln.tag === tag) return idx;
        }
        return -1;
    }

    chooseVictim(set) {
        let oldest = Infinity,
            victim = null;
        for (let idx of this.linesInSet(set)) {
            const ln = this.cache[idx];
            if (!ln.valid) return idx;
            if (ln.lru < oldest) {
                oldest = ln.lru;
                victim = idx;
            }
        }
        return victim;
    }

    loadBlock(blockNum) {
        const set = this.setOf(blockNum);
        const idx = this.chooseVictim(set);
        const line = this.cache[idx];
        const base = blockNum * this.cfg.blk;

        for (let w = 0; w < this.cfg.blk; w++) {
            const ramWord = this.ram[base + w];
            line.data[w] = {
                addr: ramWord.addr,
                value: ramWord.value,
                offset: w
            };
        }

        line.valid = true;
        line.tag = this.tagOf(blockNum);
        line.lru = this.clk++;
        return idx;
    }

    access(addr) {
        this.last.addr = addr;
        this.prefetchedBlocks = [];

        const bnum = this.blockNum(addr);
        const set = this.setOf(bnum);
        const tag = this.tagOf(bnum);
        let idx = this.findLine(set, tag);
        const isHit = idx !== -1;

        if (isHit) {
            this.stats.hits++;
            this.stats.time += cost.H;
            this.cache[idx].lru = this.clk++;
            this.last = {
                idx,
                result: 'hit',
                addr
            };
        } else {
            this.stats.misses++;
            this.stats.time += cost.M;
            idx = this.loadBlock(bnum);
            this.last = {
                idx,
                result: 'miss',
                addr
            };

            for (let d = 1; d <= this.cfg.pf; d++) {
                const pb = bnum + d;
                if (pb * this.cfg.blk >= this.cfg.ram) break;
                if (this.findLine(this.setOf(pb), this.tagOf(pb)) === -1) {
                    this.stats.prefetches++;
                    this.stats.time += cost.P;
                    this.loadBlock(pb);
                    this.prefetchedBlocks.push(pb);
                    log(`Prefetched block ${pb}`);
                }
            }
        }


        return this.cache[idx].data[this.offset(addr)];
    }

    store(addr, newValue) {
        const word = this.access(addr);
        word.value = newValue;
        this.ram[addr].value = newValue;
        log(`Stored ${newValue} at addr ${addr}`);
    }
}


const cost = {
    H: 10,
    M: 100,
    P: 100
};
const pct = x => (x * 100).toFixed(1) + '%';

function log(msg) {
    const o = $('#logOutput');
    const e = document.createElement('div');
    e.className = 'log-entry';
    const txt = msg.toLowerCase();
    if (txt.includes('miss')) e.classList.add('miss');
    if (txt.includes('hit')) e.classList.add('hit');
    if (txt.includes('prefetch')) e.classList.add('prefetch');
    e.textContent = msg;
    o.appendChild(e);
    o.scrollTop = o.scrollHeight;
}


function buildCacheHeader(blk) {
    const thead = $('#cache thead tr');

    while (thead.children.length > 3) thead.removeChild(thead.lastChild);


    for (let off = 0; off < blk; off++) {
        const th = document.createElement('th');
        th.textContent = `Off ${off}`;
        thead.insertBefore(th, thead.lastChild);
    }
}

const ui = {

    table(sim) {
        const tbody = $('#cache tbody');
        tbody.innerHTML = '';

        sim.cache.forEach((line, idx) => {
            const tr = document.createElement('tr');

            if (sim.last.idx === idx) tr.classList.add(sim.last.result);



            const rowData = [
                idx,
                line.valid ? 'V' : '',
                line.valid ? line.tag : ''
            ];


            for (let off = 0; off < sim.cfg.blk; off++) {
                const word = line.data[off];
                rowData.push(
                    word ?
                    `${word.value} @ ${word.addr}` :
                    '–'
                );
            }


            rowData.push(line.valid ? line.lru : '');


            tr.innerHTML = rowData
                .map(cell => `<td>${cell}</td>`)
                .join('');
            tbody.appendChild(tr);
        });
    },

    stats(sim) {
        $('#hits').textContent = sim.stats.hits;
        $('#misses').textContent = sim.stats.misses;
        $('#prefetches').textContent = sim.stats.prefetches;
        $('#rate').textContent = (sim.stats.hits + sim.stats.misses) ?
            pct(sim.stats.hits / (sim.stats.hits + sim.stats.misses)) :
            '0%';
        $('#time').textContent = sim.stats.time + ' ns';
    },

    ram(sim) {
        const c = $('#ramView');
        c.innerHTML = '';
        sim.ram.forEach(w => {
            const cell = document.createElement('div');
            cell.classList.add('ram-cell');
            if (w.addr === sim.last.addr) cell.classList.add(sim.last.result);
            if (sim.prefetchedBlocks.includes(sim.blockNum(w.addr))) cell.classList.add('prefetch');
            if (w.addr % sim.cfg.blk === 0) cell.classList.add('block-boundary');
            cell.title = `addr ${w.addr} → value ${w.value}`;
            const lbl = document.createElement('div');
            lbl.className = 'addr';
            lbl.textContent = w.addr;
            cell.append(lbl, document.createTextNode(w.value));
            c.appendChild(cell);
        });
    }
};


let chart;

function newChart() {
    if (chart) chart.destroy();
    const ctx = $('#chart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Hits',
                data: [],
                borderWidth: 2,
                pointRadius: 0
            }, {
                label: 'Misses',
                data: [],
                borderWidth: 2,
                pointRadius: 0
            }]
        },
        options: {
            animation: false,
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Access'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Cumulative'
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

function pushChart(step, sim) {
    chart.data.labels.push(step);
    chart.data.datasets[0].data.push(sim.stats.hits);
    chart.data.datasets[1].data.push(sim.stats.misses);
    chart.update();
}


let sim, seq = [],
    idx = 0,
    timer = null;

function cfg() {
    const ram = +$('#ramSize').value;
    const blk = +$('#blkSize').value;
    const lines = +$('#lines').value;
    const assoc = +$('#assoc').value;
    const pf = +$('#pfDist').value;
    if (lines % assoc) {
        alert('Lines must be a multiple of associativity');
        throw new Error('Invalid associativity');
    }
    return {
        ram,
        blk,
        lines,
        assoc,
        pf
    };
}

function buildSeq() {
    const mode = $('#pattern').value;
    const len = Math.min(+$('#ramSize').value, 256);
    const stride = +$('#stride').value;
    let arr = [];
    switch (mode) {
        case 'sequential':
            arr = [...Array(len).keys()];
            break;
        case 'reverse':
            arr = [...Array(len).keys()].reverse();
            break;
        case 'strided':
            for (let i = 0; i < len; i += stride) arr.push(i);
            break;
        case 'random':
            arr = [...Array(len).keys()];
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            break;
    }
    log(`Pattern '${mode}' created (${arr.length} accesses)`);
    return arr;
}

function hardReset() {
    clearInterval(timer);
    newChart();
    sim = new Sim(cfg());
    seq = buildSeq();
    idx = 0;
    ui.table(sim);
    ui.stats(sim);
    ui.ram(sim);
    $('#play').disabled = false;
    $('#pause').disabled = true;
    $('#step').disabled = false;
}

function step() {
    if (idx >= seq.length) {
        log('Sequence complete');
        clearInterval(timer);
        $('#play').disabled = true;
        $('#pause').disabled = true;
        $('#step').disabled = true;
        return;
    }
    const addr = seq[idx++];
    log('► ' + addr);
    const word = sim.access(addr);
    log(`   ${sim.last.result.toUpperCase()}, value ${word.value}`);
    ui.table(sim);
    ui.stats(sim);
    ui.ram(sim);
    pushChart(idx, sim);
}

function play() {
    timer = setInterval(step, 400);
    $('#play').disabled = true;
    $('#pause').disabled = false;
    $('#step').disabled = true;
}

function pause() {
    clearInterval(timer);
    $('#pause').disabled = true;
    $('#play').disabled = false;
    $('#step').disabled = false;
}


['#ramSize', '#blkSize', '#lines', '#assoc', '#pfDist'].forEach(s =>
    $(s).addEventListener('change', hardReset)
);
$('#pattern').addEventListener('change', e => {
    $('#strideWrapper').classList.toggle('hidden', e.target.value !== 'strided');
    hardReset();
});
$('#stride').addEventListener('change', hardReset);
$('#regen').addEventListener('click', hardReset);
$('#play').addEventListener('click', play);
$('#pause').addEventListener('click', pause);
$('#step').addEventListener('click', step);
window.addEventListener('load', hardReset);