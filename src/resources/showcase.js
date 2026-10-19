(() => {
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const watch = (elements, options, onEnter) => {
        if (!('IntersectionObserver' in window)) return elements.forEach(element => onEnter(element, true));
        const observer = new IntersectionObserver(entries => entries.forEach(entry => onEnter(entry.target, entry.isIntersecting, observer)), options);
        elements.forEach(element => observer.observe(element));
    };


    const links = [...document.querySelectorAll('.pj-bar a')];
    const strip = document.querySelector('.pj-bar ul');
    watch(links.map(link => document.getElementById(link.hash.slice(1))).filter(Boolean), {
        rootMargin: '-40% 0px -55% 0px'
    }, (chapter, visible) => {
        if (!visible) return;
        links.forEach(link => {
            const current = link.hash === '#' + chapter.id;
            link.toggleAttribute('aria-current', current);
            if (current) strip.scrollLeft = link.offsetLeft - 16;
        });
    });


    watch([...document.querySelectorAll('video[data-autoplay]')], {
        threshold: .35
    }, (video, visible) => {
        if (calm) return;
        if (visible) video.play().catch(() => {});
        else video.pause();
    });
    if (calm) return;


    document.documentElement.classList.add('pj-motion');
    const cards = [...document.querySelectorAll('.pj-chapter .pj-card, .pj-old, .pj-gallery figure, .pj-rows li, .pj-stack li')];
    cards.forEach(card => {
        card.classList.add('pj-rise');
        card.style.setProperty('--i', [...card.parentElement.children].indexOf(card) % 6);
    });
    watch(cards, {
        rootMargin: '0px 0px -8% 0px'
    }, (card, visible, observer) => {
        if (!visible) return;
        card.classList.add('is-in');
        observer?.unobserve(card);
    });


    watch([...document.querySelectorAll('[data-count]')], {
        threshold: .6
    }, (element, visible, observer) => {
        if (!visible) return;
        observer?.unobserve(element);
        const target = +element.dataset.count,
            suffix = element.dataset.suffix || '',
            start = performance.now();
        const step = now => {
            const t = Math.min((now - start) / 1400, 1),
                eased = 1 - Math.pow(1 - t, 4);
            element.textContent = Math.round(target * eased).toLocaleString('en-US') + suffix;
            if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    });
})();