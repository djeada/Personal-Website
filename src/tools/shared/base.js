(function() {
    "use strict";

    const icons = {
        success: "OK",
        error: "!",
        info: "i",
        warning: "!"
    };

    function ensureToastContainer() {
        let container = document.getElementById("toast-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "toast-container";
            container.className = "tool-toast-container";
            document.body.appendChild(container);
        }
        return container;
    }

    function showToast(message, type = "info", timeout = 3000) {
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-message"></span>`;
        toast.querySelector(".toast-message").textContent = message;
        ensureToastContainer().appendChild(toast);
        window.setTimeout(() => toast.remove(), timeout);
        return toast;
    }

    function initCardToggles(root = document) {
        root.querySelectorAll(".card-toggle").forEach((toggle) => {
            if (toggle.dataset.toolSharedToggle === "true") return;
            toggle.dataset.toolSharedToggle = "true";
            toggle.addEventListener("click", () => {
                const expanded = toggle.getAttribute("aria-expanded") === "true";
                toggle.setAttribute("aria-expanded", String(!expanded));
            });
        });
    }

    function debounce(fn, delay = 150) {
        let timer;
        return function(...args) {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => fn.apply(this, args), delay);
        };
    }

    function fitCanvasToDisplay(canvas, draw, maxWidth = 800, maxHeight = 400) {
        const dpr = window.devicePixelRatio || 1;
        const parent = canvas.parentElement || document.body;
        const width = Math.min(parent.clientWidth || maxWidth, maxWidth);
        const height = Math.min(Math.max(window.innerHeight * 0.5, 240), maxHeight);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        const ctx = canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (typeof draw === "function") draw(ctx, width, height);
        return {
            ctx,
            width,
            height,
            dpr
        };
    }

    function getCSSColor(name, fallback = "") {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
            getComputedStyle(document.body).getPropertyValue(name).trim() ||
            fallback;
    }

    window.ToolShared = {
        debounce,
        ensureToastContainer,
        fitCanvasToDisplay,
        getCSSColor,
        initCardToggles,
        showToast
    };

    document.addEventListener("DOMContentLoaded", () => initCardToggles());
})();