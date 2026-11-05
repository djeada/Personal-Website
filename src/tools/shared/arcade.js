(function() {
    "use strict";

    function attach(frame, button) {
        let active = false;
        let userExited = false;
        const doc = document;
        const nativeElement = () => doc.fullscreenElement || doc.webkitFullscreenElement || null;
        const label = button.querySelector(".arcade-btn-label");

        function apply(on) {
            active = on;
            frame.classList.toggle("is-fullscreen", on);
            doc.body.classList.toggle("arcade-locked", on);
            button.setAttribute("aria-pressed", String(on));
            button.setAttribute("aria-label", on ? "Exit full screen" : "Full screen");
            if (label) label.textContent = on ? "Exit" : "Full screen";
            if (on) window.scrollTo(0, 0);
        }

        async function enter() {
            if (active) return;
            apply(true);
            const request = frame.requestFullscreen || frame.webkitRequestFullscreen;
            if (!request) return;
            try {
                await request.call(frame, { navigationUI: "hide" });
            } catch (e) {}
        }

        function exit(byUser) {
            if (byUser) userExited = true;
            apply(false);
            if (nativeElement()) {
                const leave = doc.exitFullscreen || doc.webkitExitFullscreen;
                try {
                    const result = leave.call(doc);
                    if (result && result.catch) result.catch(() => {});
                } catch (e) {}
            }
        }

        function toggle() {
            if (active) exit(true);
            else {
                userExited = false;
                enter();
            }
        }

        function autoEnter() {
            if (active || userExited) return;
            if (window.matchMedia("(pointer: coarse)").matches) enter();
        }

        function onNativeChange() {
            if (active && !nativeElement()) {
                userExited = true;
                apply(false);
            }
        }

        doc.addEventListener("fullscreenchange", onNativeChange);
        doc.addEventListener("webkitfullscreenchange", onNativeChange);
        button.addEventListener("click", () => {
            toggle();
            button.blur();
        });

        return {
            enter,
            exit,
            toggle,
            autoEnter,
            get active() {
                return active;
            }
        };
    }

    window.ArcadeFullscreen = { attach };
})();
