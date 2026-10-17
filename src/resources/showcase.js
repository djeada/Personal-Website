// Motion for the showcase pages (projects and home): the chapter bar, the reels,
// cards rising into view, counting numbers, and the hero leaning toward the pointer.
// Everything here is decoration: the pages read fully without it.
(() => {
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const watch = (elements, options, onEnter) => {
        if (!('IntersectionObserver' in window)) return elements.forEach(element => onEnter(element, true));
        const observer = new IntersectionObserver(entries => entries.forEach(entry => onEnter(entry.target, entry.isIntersecting, observer)), options);
        elements.forEach(element => observer.observe(element));
    };

    // Mark the chapter being read in the sticky bar, and keep its chip in view on narrow screens.
    const links = [...document.querySelectorAll('.pj-bar a')];
    const strip = document.querySelector('.pj-bar ul');
    watch(links.map(link => document.getElementById(link.hash.slice(1))).filter(Boolean), { rootMargin: '-40% 0px -55% 0px' }, (chapter, visible) => {
        if (!visible) return;
        links.forEach(link => {
            const current = link.hash === '#' + chapter.id;
            link.toggleAttribute('aria-current', current);
            if (current) strip.scrollLeft = link.offsetLeft - 16;
        });
    });

    // Play the reel only while it is on screen; it loads nothing until then.
    watch([...document.querySelectorAll('video[data-autoplay]')], { threshold: .35 }, (video, visible) => {
        if (calm) return;
        if (visible) video.play().catch(() => {});
        else video.pause();
    });
    if (calm) return;

    // Cards rise into place as they scroll in, a few at a time.
    document.documentElement.classList.add('pj-motion');
    const cards = [...document.querySelectorAll('.pj-chapter .pj-card, .pj-old, .pj-gallery figure, .pj-rows li, .pj-stack li, .hm-topics li')];
    cards.forEach(card => {
        card.classList.add('pj-rise');
        card.style.setProperty('--i', [...card.parentElement.children].indexOf(card) % 6);
    });
    watch(cards, { rootMargin: '0px 0px -8% 0px' }, (card, visible, observer) => {
        if (!visible) return;
        card.classList.add('is-in');
        observer?.unobserve(card);
    });

    // Numbers count up the first time they are seen. The page already holds the final value.
    watch([...document.querySelectorAll('[data-count]')], { threshold: .6 }, (element, visible, observer) => {
        if (!visible) return;
        observer?.unobserve(element);
        const target = +element.dataset.count, suffix = element.dataset.suffix || '', start = performance.now();
        const step = now => {
            const t = Math.min((now - start) / 1400, 1), eased = 1 - Math.pow(1 - t, 4);
            element.textContent = Math.round(target * eased).toLocaleString('en-US') + suffix;
            if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    });

    // The hero artwork leans toward the pointer; the AI cards light up under it.
    const hero = document.querySelector('.pj-hero'), stage = hero?.querySelector('.pj-collage, .hm-stage');
    if (stage) hero.addEventListener('pointermove', event => {
        const box = hero.getBoundingClientRect();
        stage.style.setProperty('--px', ((event.clientX - box.left) / box.width - .5).toFixed(3));
        stage.style.setProperty('--py', ((event.clientY - box.top) / box.height - .5).toFixed(3));
    });
    document.querySelectorAll('.pj-ai .pj-card').forEach(card => card.addEventListener('pointermove', event => {
        const box = card.getBoundingClientRect();
        card.style.setProperty('--mx', event.clientX - box.left + 'px');
        card.style.setProperty('--my', event.clientY - box.top + 'px');
    }));
})();
