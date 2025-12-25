// Make renderer globally accessible
let renderer;

// ------------------
// Utility Functions
// ------------------
function setCookie(name, value, days, sameSite = 'Lax') {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
        expires = "; expires=" + date.toUTCString();
    }
    let cookieString = name + "=" + (value || "") + expires + "; path=/";
    cookieString += "; SameSite=" + sameSite;
    if (sameSite === 'None') {
        cookieString += "; Secure";
    }
    document.cookie = cookieString;
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function getColorForMode(colorLight, colorDark) {
    const darkModeValue = getCookie("darkMode");
    return darkModeValue && darkModeValue.toLowerCase() === "true" ? colorDark : colorLight;
}

// -------------------------
// Ripple Effect for Menus
// -------------------------
function onMenuClick(e) {
    var dom = e.currentTarget;
    var elemRect = dom.getBoundingClientRect();
    var x = e.pageX - elemRect.left;
    var y = e.pageY - elemRect.top;
    var rippleDiv = document.createElement("div");
    var domTokenList = rippleDiv.classList;
    domTokenList.add("ripple");
    rippleDiv.setAttribute(
        "style",
        `top:${y}px; left:${x}px;`
    );
    dom.appendChild(rippleDiv);
    setTimeout(function() {
        dom.removeChild(rippleDiv);
        return /* () */ 0;
    }, 900);
    return /* () */ 0;
}

// ---------------------------
// Dark Mode and Logo Handling
// ---------------------------
function checkLogo() {
    let logoImage = document.getElementById("logo-image");
    if (document.body.classList.contains("dark-mode")) {
        logoImage.src =
            "https://raw.githubusercontent.com/djeada/Personal-Website/master/images/logo_dark.PNG";
    } else {
        logoImage.src =
            "https://raw.githubusercontent.com/djeada/Personal-Website/master/images/logo.PNG";
    }
}

// ---------------------
// GitHub Integrations
// ---------------------
// Mapping of section keys to GitHub repository base URLs.
const GITHUB_BASE_REPOS = {
    "algorithms_and_data_structures": "https://github.com/djeada/Algorithms-And-Data-Structures",
    "frontend_notes": "https://github.com/djeada/Frontend-Notes",
    "numerical_methods": "https://github.com/djeada/Numerical-Methods",
    "databases_notes": "https://github.com/djeada/Databases-Notes",
    "git_notes": "https://github.com/djeada/Git-Notes",
    "linux_notes": "https://github.com/djeada/Linux-Notes",
    "numpy_tutorials": "https://github.com/djeada/Numpy-Tutorials",
    "parallel_and_concurrent_programming": "https://github.com/djeada/Parallel-And-Concurrent-Programming",
    "statistics_notes": "https://github.com/djeada/Statistics-Notes",
    "kurs_podstaw_pythona": "https://github.com/djeada/Kurs-Podstaw-Pythona",
    "od_c_do_cpp": "https://github.com/djeada/Od-C-do-Cpp",
    "stanford_machine_learning": "https://github.com/djeada/Stanford-Machine-Learning",
    "vtk_examples": "https://github.com/djeada/Vtk-Examples"
};

// Mapping of section keys to additional path prepends within the repo.
const PATH_PREPENDS = {
    "algorithms_and_data_structures": "notes",
    "frontend_notes": "notes",
    "numerical_methods": "notes",
    "databases_notes": "notes",
    "git_notes": "notes",
    "vtk_examples": "notes",
    "linux_notes": "notes",
    "numpy_tutorials": "notes",
    "parallel_and_concurrent_programming": "notes",
    "statistics_notes": "notes",
    "kurs_podstaw_pythona": "notatki",
    "od_c_do_cpp": "notatki",
    "stanford_machine_learning": "slides",

};

// Mapping of section keys to the main branch names.
const MAIN_BRANCH = {
    "algorithms_and_data_structures": "master",
    "frontend_notes": "master",
    "numerical_methods": "master",
    "databases_notes": "main",
    "git_notes": "main",
    "linux_notes": "main",
    "numpy_tutorials": "main",
    "parallel_and_concurrent_programming": "master",
    "statistics_notes": "main",
    "kurs_podstaw_pythona": "master",
    "od_c_do_cpp": "master",
    "stanford_machine_learning": "main",
};

/**
 * Returns an object containing:
 *  - sectionKey: the key for looking up repo-specific configurations.
 *  - baseRepoUrl: the GitHub repository base URL using the section key.
 *  - filePathInRepo: the relative file path in that repository, with an additional prepended folder if configured,
 *    and with any .html file extension replaced with .md.
 *
 * The function works by:
 *   1. Removing any leading slash from the current URL's pathname.
 *   2. Splitting the path into segments.
 *   3. Searching from the end for the "articles" segment.
 *   4. Taking the segment immediately after "articles" as the section key.
 *   5. Joining the remaining segments as the file path.
 *   6. Prepending a folder from PATH_PREPENDS (if defined) and replacing the .html extension.
 *
 * If "articles" or a proper section key mapping is not found, an error message is displayed.
 */
function getArticleGithubPath() {
    let path = location.pathname;
    if (path.startsWith("/")) {
        path = path.substring(1); // remove the leading slash
    }

    const parts = path.split("/");
    // Find the last occurrence of "articles" in the URL path.
    const articlesIndex = parts.lastIndexOf("articles");
    if (articlesIndex === -1 || articlesIndex >= parts.length - 1) {
        alert("Sorry, the article base '/articles' was not found in the URL or the section key is missing.");
        return null;
    }

    // The segment immediately after "articles" is the section key.
    const sectionKey = parts[articlesIndex + 1];
    // All segments after the section key represent the file path in the repository.
    let filePathParts = parts.slice(articlesIndex + 2);
    let filePathInRepo = filePathParts.join("/");

    // Retrieve the base GitHub repo URL using the section key.
    if (!GITHUB_BASE_REPOS.hasOwnProperty(sectionKey)) {
        alert("Sorry, no GitHub repository is configured for the section: " + sectionKey);
        return null;
    }
    const baseRepoUrl = GITHUB_BASE_REPOS[sectionKey];

    // Look up the additional path prepend for this section (if available).
    if (PATH_PREPENDS.hasOwnProperty(sectionKey)) {
        const prependFolder = PATH_PREPENDS[sectionKey];
        // Prepend the additional folder to the file path.
        // If filePathInRepo is empty, then the prependFolder becomes the entire file path.
        filePathInRepo = prependFolder + (filePathInRepo ? "/" + filePathInRepo : "");
    }

    // Normalize the file extension:
    // Replace a .html extension with .md or, if no extension exists, append .md.
    if (filePathInRepo.match(/\.html$/)) {
        filePathInRepo = filePathInRepo.replace(/\.html$/, ".md");
    } else if (!/\.[^\/]+$/.test(filePathInRepo)) {
        // If there is no extension in the last segment, append .md.
        filePathInRepo += ".md";
    }

    return {
        sectionKey,
        baseRepoUrl,
        filePathInRepo
    };
}

/**
 * Opens the GitHub editor interface for the current page's corresponding file.
 */
function handleSuggestEditClick() {
    const result = getArticleGithubPath();
    if (!result) {
        return; // An error has been shown.
    }
    const {
        sectionKey,
        baseRepoUrl,
        filePathInRepo
    } = result;
    // Lookup the correct branch for the section using the MAIN_BRANCH mapping.
    const branch = MAIN_BRANCH.hasOwnProperty(sectionKey) ? MAIN_BRANCH[sectionKey] : "master";
    const editUrl = `${baseRepoUrl}/edit/${branch}/${filePathInRepo}`;
    window.open(editUrl, "_blank");
}

/**
 * Opens the new issue page for the respective GitHub repository.
 */
function handleCreateIssueClick() {
    const result = getArticleGithubPath();
    if (!result) {
        return; // An error has been shown.
    }
    const {
        baseRepoUrl
    } = result;
    const issueUrl = `${baseRepoUrl}/issues/new`;
    window.open(issueUrl, "_blank");
}


function handleDownloadClick() {
    const article = document.getElementById('article-body');
    if (!article) return;

    const spinner = document.getElementById('pdf-spinner-overlay');
    if (spinner) spinner.style.display = 'flex';

    // Clone and modify the article content
    const cloned = article.cloneNode(true);

    // ----- NEW: strip out the top "action buttons + metadata" block -----
    // Remove any .article-action-buttons divs
    cloned.querySelectorAll('.article-action-buttons').forEach(el => el.remove());

    // Remove any <p> whose text starts with "Last modified:" or "This article is written in:"
    cloned.querySelectorAll('p').forEach(p => {
        const txt = p.textContent.trim();
        if (/^Last modified:/i.test(txt) || /^This article is written in:/i.test(txt)) {
            p.remove();
        }
    });
    // --------------------------------------------------------------------

    // Remove all images
    cloned.querySelectorAll('img').forEach(img => img.remove());

    // Replace header content with your custom header markup
    cloned.querySelectorAll('header').forEach(header => {
        header.innerHTML = '<h1>Your Custom Header</h1>';
    });

    // Reserve extra space at the bottom to prevent cutting text
    cloned.style.paddingBottom = '20px';

    // Create a hidden container to hold the modified content
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '-9999px';
    container.style.left = '-9999px';
    container.appendChild(cloned);
    document.body.appendChild(container);

    // Configure html2pdf options with additional page-break setting and higher scale
    const options = {
        margin: 0.5,
        filename: 'article.pdf',
        image: {
            type: 'jpeg',
            quality: 1
        },
        html2canvas: {
            scale: 0.95,
            useCORS: true
        },
        jsPDF: {
            unit: 'in',
            format: 'letter',
            orientation: 'portrait'
        },
        pagebreak: {
            mode: 'avoid-all'
        }
    };

    // Generate and download the PDF, then clean up
    html2pdf().set(options).from(cloned).save()
        .then(() => {
            document.body.removeChild(container);
            if (spinner) spinner.style.display = 'none';
        })
        .catch(error => {
            console.error("PDF generation error:", error);
            document.body.removeChild(container);
            if (spinner) spinner.style.display = 'none';
        });
}

function initializeThreeJS() {
    const container = document.getElementById('threejs-container');
    let darkMode = getCookie("darkMode") === "true";

    // Mobile detection
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.innerWidth <= 768;

    // Adjust quality settings for mobile
    const qualitySettings = {
        particles: isMobile ? 300 : 1200,
        stars: isMobile ? 2000 : 6000,
        shadowMap: isMobile ? 512 : 2048,
        pixelRatio: isMobile ? 1 : Math.min(window.devicePixelRatio, 2),
        antialias: !isMobile, // Disable antialiasing on mobile for performance
        fog: isMobile ? 0.004 : 0.002, // Denser fog on mobile to hide lower detail
        ringDetail: isMobile ? [16, 64] : [32, 128] // Lower geometry detail on mobile
    };

    // Enhanced color palettes for better contrast
    let bgColor = darkMode ? 0x0a0a12 : 0xf8f9fa;
    let fogColor = darkMode ? bgColor : 0xc8d0e0;
    let ringColor = darkMode ? 0x4a90e2 : 0x2c5aa0;
    let starColor = darkMode ? 0xffffff : 0x2a2a2a;

    // Scene setup with mobile-optimized fog
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(fogColor, qualitySettings.fog);

    const camera = new THREE.PerspectiveCamera(
        isMobile ? 85 : 75, // Wider FOV on mobile for better view
        container.clientWidth / container.clientHeight,
        0.1,
        2000
    );
    camera.position.set(0, 8, isMobile ? 20 : 25); // Closer camera on mobile

    // Mobile-optimized renderer settings
    const renderer = new THREE.WebGLRenderer({
        antialias: qualitySettings.antialias,
        alpha: true,
        powerPreference: isMobile ? "default" : "high-performance"
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(qualitySettings.pixelRatio);

    // Conditional shadow settings
    if (!isMobile) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    renderer.setClearColor(bgColor, 1);
    if (!isMobile) {
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
    }
    container.appendChild(renderer.domElement);

    // Mobile-optimized lighting system
    const ambient = new THREE.AmbientLight(darkMode ? 0x404040 : 0xc0c0c0, isMobile ? 0.8 : 0.6);
    scene.add(ambient);

    const sunLight = new THREE.DirectionalLight(0xffffff, isMobile ? 0.8 : 1.0);
    sunLight.position.set(20, 30, 20);

    if (!isMobile) {
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = qualitySettings.shadowMap;
        sunLight.shadow.mapSize.height = qualitySettings.shadowMap;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 100;
        sunLight.shadow.camera.left = -50;
        sunLight.shadow.camera.right = 50;
        sunLight.shadow.camera.top = 50;
        sunLight.shadow.camera.bottom = -50;
    }
    scene.add(sunLight);

    // Dynamic point light for energy visualization
    const energyLight = new THREE.PointLight(0x44aaff, 0, 100, 1.5);
    energyLight.position.set(0, 10, 0);
    scene.add(energyLight);

    // Mobile-optimized ring geometry
    const ringGeo = new THREE.TorusGeometry(4, 0.3, qualitySettings.ringDetail[0], qualitySettings.ringDetail[1]);

    // Simplified procedural surface details for mobile
    const colors = [];
    const colorCount = isMobile ? ringGeo.attributes.position.count / 4 : ringGeo.attributes.position.count;

    for (let i = 0; i < ringGeo.attributes.position.count; i++) {
        if (isMobile && i > colorCount) {
            // Use base color for remaining vertices on mobile
            colors.push(
                ((ringColor >> 16) & 0xff) / 255,
                ((ringColor >> 8) & 0xff) / 255,
                ((ringColor) & 0xff) / 255
            );
        } else {
            const stress = Math.random();
            const isCrack = stress < 0.08;
            const isWorn = stress < 0.25;

            if (isCrack) {
                colors.push(1, 0.1, 0);
            } else if (isWorn) {
                colors.push(0.8, 0.8, 0.9);
            } else {
                colors.push(
                    ((ringColor >> 16) & 0xff) / 255,
                    ((ringColor >> 8) & 0xff) / 255,
                    ((ringColor) & 0xff) / 255
                );
            }
        }
    }
    ringGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    // Mobile-optimized material properties
    const ringMat = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        metalness: isMobile ? 0.6 : 0.8,
        roughness: isMobile ? 0.4 : 0.3,
        clearcoat: isMobile ? 0.3 : 0.5,
        clearcoatRoughness: 0.1,
        reflectivity: isMobile ? 0.7 : 0.9,
        envMapIntensity: isMobile ? 0.8 : 1.0
    });

    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.castShadow = !isMobile;
    ring.receiveShadow = !isMobile;
    ring.position.set(0, 10, 0);
    scene.add(ring);

    // Physics variables with mobile adjustments
    const GRAVITY = -9.81 * 0.5;
    const GROUND_LEVEL = 2;
    const MAX_LAUNCH_VELOCITY = isMobile ? 15 : 20; // Reduced for mobile
    const MAX_HORIZONTAL_DISTANCE = isMobile ? 30 : 40;
    const VELOCITY_DAMPING_GROUND = 0.85;
    const MIN_BOUNCE_VELOCITY = 0.5;

    let ringVelocity = {
        x: 0,
        y: 0,
        z: 0
    };
    let ringPosition = {
        x: 0,
        y: 10,
        z: 0
    };
    let angularVelocity = {
        x: 0,
        y: 0,
        z: 0
    };
    let baseRotationSpeed = 0.005;
    let ringOnGround = false;

    // Mobile-optimized particle system
    const particleCount = qualitySettings.particles;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities = new Float32Array(particleCount * 3);
    const particleLife = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = THREE.MathUtils.randFloat(3.5, 4.5);
        const i3 = i * 3;

        particlePositions[i3] = Math.cos(angle) * radius;
        particlePositions[i3 + 1] = ringPosition.y - 2;
        particlePositions[i3 + 2] = Math.sin(angle) * radius;

        particleVelocities[i3] = (Math.random() - 0.5) * 0.02;
        particleVelocities[i3 + 1] = Math.random() * 0.05;
        particleVelocities[i3 + 2] = (Math.random() - 0.5) * 0.02;

        particleLife[i] = Math.random();
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
        size: isMobile ? 1.0 : 1.5,
        sizeAttenuation: true,
        color: darkMode ? 0x66aaff : 0x404040,
        transparent: true,
        opacity: darkMode ? (isMobile ? 0.6 : 0.8) : (isMobile ? 0.4 : 0.6),
        blending: THREE.SubtractiveBlending,
        depthWrite: false
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Mobile-optimized starfield
    const starCount = qualitySettings.stars;
    const starPositions = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
        const i3 = i * 3;
        starPositions[i3] = (Math.random() - 0.5) * 1000;
        starPositions[i3 + 1] = (Math.random() - 0.5) * 1000;
        starPositions[i3 + 2] = (Math.random() - 0.5) * 1000;
        starSizes[i] = Math.random() * (isMobile ? 2 : 3) + 1;
    }

    const starsGeo = new THREE.BufferGeometry();
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starsGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

    const starsMat = new THREE.PointsMaterial({
        size: isMobile ? 1.5 : 2,
        sizeAttenuation: true,
        color: starColor,
        opacity: isMobile ? 0.6 : 0.8,
        transparent: true,
        vertexColors: false
    });

    const starField = new THREE.Points(starsGeo, starsMat);
    scene.add(starField);

    // Ground plane for shadows (only on desktop)
    if (!isMobile) {
        const groundGeo = new THREE.PlaneGeometry(100, 100);
        const groundMat = new THREE.MeshLambertMaterial({
            color: darkMode ? 0x1a1a1a : 0xe0e0e0,
            transparent: true,
            opacity: 0.3
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = GROUND_LEVEL;
        ground.receiveShadow = true;
        scene.add(ground);
    }

    // Enhanced interactivity with touch support
    let isMouseDown = false;
    let isTouching = false;
    let mouseForce = {
        x: 0,
        y: 0
    };
    let cameraAutoRotate = true;
    let cameraAngle = 0;
    let energyLevel = 0;
    let keysPressed = {};
    let lastTouchTime = 0;
    let touchStartPos = {
        x: 0,
        y: 0
    };

    const clock = new THREE.Clock();
    let time = 0;

    // Touch event handlers for mobile
    renderer.domElement.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isTouching = true;
        cameraAutoRotate = false;
        const touch = e.touches[0];
        const rect = renderer.domElement.getBoundingClientRect();
        touchStartPos.x = touch.clientX - rect.left;
        touchStartPos.y = touch.clientY - rect.top;

        const currentTime = Date.now();
        if (currentTime - lastTouchTime < 300) {
            // Double tap detected
            handleDoubleTap();
        }
        lastTouchTime = currentTime;
    }, {
        passive: false
    });

    renderer.domElement.addEventListener('touchend', (e) => {
        e.preventDefault();
        isTouching = false;
        setTimeout(() => cameraAutoRotate = true, 2000);

        // Single tap launch
        if (e.changedTouches.length === 1) {
            setTimeout(() => {
                if (Date.now() - lastTouchTime > 300) {
                    handleSingleTap();
                }
            }, 300);
        }
    }, {
        passive: false
    });

    renderer.domElement.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!isTouching) return;

        const touch = e.touches[0];
        const rect = renderer.domElement.getBoundingClientRect();
        const currentX = touch.clientX - rect.left;
        const currentY = touch.clientY - rect.top;

        // Apply force based on touch movement
        mouseForce.x = ((currentX - touchStartPos.x) / rect.width) * 0.03;
        mouseForce.y = ((currentY - touchStartPos.y) / rect.height) * -0.03;
    }, {
        passive: false
    });

    // Mouse event handlers (for desktop)
    renderer.domElement.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        cameraAutoRotate = false;
    });

    renderer.domElement.addEventListener('mouseup', () => {
        isMouseDown = false;
        setTimeout(() => cameraAutoRotate = true, 2000);
    });

    renderer.domElement.addEventListener('mousemove', (e) => {
        if (!isMouseDown) return;

        const rect = renderer.domElement.getBoundingClientRect();
        mouseForce.x = ((e.clientX - rect.left) / rect.width - 0.5) * 0.05;
        mouseForce.y = ((e.clientY - rect.top) / rect.height - 0.5) * -0.05;
    });

    renderer.domElement.addEventListener('click', (e) => {
        if (!isMobile) {
            handleSingleTap();
        }
    });

    renderer.domElement.addEventListener('dblclick', (e) => {
        if (!isMobile) {
            handleDoubleTap();
        }
    });

    function handleSingleTap() {
        const impulse = Math.min(isMobile ? 10 : 12, MAX_LAUNCH_VELOCITY * 0.6);
        ringVelocity.y += impulse;
        angularVelocity.x += (Math.random() - 0.5) * 0.2;
        angularVelocity.y += (Math.random() - 0.5) * 0.2;
        energyLevel = Math.max(energyLevel, 40);
        ringOnGround = false;

        energyLight.intensity = 5;
        setTimeout(() => energyLight.intensity = 0, 200);
    }

    function handleDoubleTap() {
        ringVelocity.y = Math.min(isMobile ? 15 : 18, MAX_LAUNCH_VELOCITY * 0.9);
        angularVelocity.x = (Math.random() - 0.5) * 0.5;
        angularVelocity.y = (Math.random() - 0.5) * 0.5;
        angularVelocity.z = (Math.random() - 0.5) * 0.5;
        energyLevel = 80;
        ringOnGround = false;
    }

    // Keyboard controls (desktop only)
    if (!isMobile) {
        window.addEventListener('keydown', (e) => {
            keysPressed[e.code] = true;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    if (ringOnGround) {
                        ringVelocity.y += 6;
                        ringOnGround = false;
                    }
                    break;
                case 'KeyR':
                    resetRing();
                    break;
            }
        });

        window.addEventListener('keyup', (e) => {
            keysPressed[e.code] = false;
        });
    }

    function resetRing() {
        ringPosition = {
            x: 0,
            y: 10,
            z: 0
        };
        ringVelocity = {
            x: 0,
            y: 0,
            z: 0
        };
        angularVelocity = {
            x: 0,
            y: 0,
            z: 0
        };
        ringOnGround = false;
    }

    // Responsive resize handler
    function handleResize() {
        const width = container.clientWidth;
        const height = container.clientHeight;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);

        // Update mobile detection on resize
        const wasMobile = isMobile;
        const nowMobile = window.innerWidth <= 768;

        if (wasMobile !== nowMobile) {
            // Reload if mobile status changed
            location.reload();
        }
    }

    window.addEventListener('resize', handleResize);

    // Performance monitoring for mobile
    let frameCount = 0;
    let lastFPSCheck = performance.now();
    let lowFPSCount = 0;

    function animate() {
        requestAnimationFrame(animate);
        const deltaTime = clock.getDelta();
        time += deltaTime;

        // FPS monitoring on mobile
        if (isMobile) {
            frameCount++;
            const now = performance.now();
            if (now - lastFPSCheck >= 1000) {
                const fps = frameCount;
                frameCount = 0;
                lastFPSCheck = now;

                if (fps < 25) {
                    lowFPSCount++;
                    if (lowFPSCount >= 3) {
                        // Reduce quality further if consistently low FPS
                        particleMat.opacity *= 0.8;
                        starsMat.opacity *= 0.8;
                        lowFPSCount = 0;
                    }
                }
            }
        }

        // Handle continuous key presses for camera control (desktop only)
        if (!isMobile) {
            if (keysPressed['ArrowLeft'] || keysPressed['KeyA']) {
                cameraAngle -= deltaTime * 2;
                cameraAutoRotate = false;
            }
            if (keysPressed['ArrowRight'] || keysPressed['KeyD']) {
                cameraAngle += deltaTime * 2;
                cameraAutoRotate = false;
            }
        }

        // Theme switching
        const newDarkMode = getCookie("darkMode") === "true";
        if (newDarkMode !== darkMode) {
            darkMode = newDarkMode;
            bgColor = darkMode ? 0x0a0a12 : 0xf8f9fa;
            fogColor = darkMode ? bgColor : 0xc8d0e0;
            ringColor = darkMode ? 0x4a90e2 : 0x2c5aa0;
            starColor = darkMode ? 0xffffff : 0x2a2a2a;

            renderer.setClearColor(bgColor, 1);
            scene.fog.color.setHex(fogColor);
            ambient.color.setHex(darkMode ? 0x404040 : 0xc0c0c0);
            starsMat.color.setHex(starColor);
            if (!isMobile) {
                groundMat.color.setHex(darkMode ? 0x1a1a1a : 0xe0e0e0);
            }
        }

        // Physics simulation
        if ((isMouseDown || isTouching) && !ringOnGround) {
            ringVelocity.x += mouseForce.x;
            ringVelocity.z += mouseForce.y;
        }

        if (!ringOnGround) {
            ringVelocity.y += GRAVITY * deltaTime;
        }

        // Boundary enforcement
        const distanceFromCenter = Math.sqrt(ringPosition.x * ringPosition.x + ringPosition.z * ringPosition.z);
        if (distanceFromCenter > MAX_HORIZONTAL_DISTANCE) {
            const returnForce = 0.02;
            ringVelocity.x -= (ringPosition.x / distanceFromCenter) * returnForce;
            ringVelocity.z -= (ringPosition.z / distanceFromCenter) * returnForce;
        }

        // Velocity limits
        ringVelocity.x = Math.max(-MAX_LAUNCH_VELOCITY, Math.min(MAX_LAUNCH_VELOCITY, ringVelocity.x));
        ringVelocity.y = Math.max(-MAX_LAUNCH_VELOCITY * 1.5, Math.min(MAX_LAUNCH_VELOCITY * 1.5, ringVelocity.y));
        ringVelocity.z = Math.max(-MAX_LAUNCH_VELOCITY, Math.min(MAX_LAUNCH_VELOCITY, ringVelocity.z));

        // Update position
        if (!ringOnGround) {
            ringPosition.x += ringVelocity.x * deltaTime * 10;
            ringPosition.y += ringVelocity.y * deltaTime * 10;
            ringPosition.z += ringVelocity.z * deltaTime * 10;

            ringVelocity.x *= 0.985;
            ringVelocity.z *= 0.985;
        } else {
            ringVelocity.x *= VELOCITY_DAMPING_GROUND;
            ringVelocity.z *= VELOCITY_DAMPING_GROUND;
        }

        // Ground collision
        if (ringPosition.y <= GROUND_LEVEL + 0.3) {
            ringPosition.y = GROUND_LEVEL + 0.3;

            if (ringVelocity.y < 0) {
                if (Math.abs(ringVelocity.y) > MIN_BOUNCE_VELOCITY && !ringOnGround) {
                    ringVelocity.y *= -0.3;
                    energyLevel = Math.max(energyLevel, 15);
                } else {
                    ringVelocity.y = 0;
                    ringOnGround = true;
                }
            }
        }

        // Update angular velocity and rotation
        angularVelocity.x *= 0.995;
        angularVelocity.y *= 0.995;
        angularVelocity.z *= 0.995;

        ring.rotation.x += (angularVelocity.x + baseRotationSpeed) * deltaTime * 10;
        ring.rotation.y += (angularVelocity.y + baseRotationSpeed * 0.7) * deltaTime * 10;
        ring.rotation.z += angularVelocity.z * deltaTime * 10;

        ring.position.set(ringPosition.x, ringPosition.y, ringPosition.z);

        // Energy-based effects
        energyLevel = Math.max(0, energyLevel - deltaTime * 15);
        const energyFactor = energyLevel / 100;

        ringMat.emissive.setHSL(0.6, energyFactor * 0.8, energyFactor * 0.3);
        ringMat.emissiveIntensity = energyFactor * 2;

        energyLight.intensity = energyFactor * 3;
        energyLight.position.set(ringPosition.x, ringPosition.y + 2, ringPosition.z);

        // Particle system update (with mobile optimizations)
        const particleUpdateStep = isMobile ? 2 : 1; // Update every other particle on mobile
        for (let i = 0; i < particleCount; i += particleUpdateStep) {
            const i3 = i * 3;

            particleVelocities[i3 + 1] += 0.001;
            particlePositions[i3] += particleVelocities[i3];
            particlePositions[i3 + 1] += particleVelocities[i3 + 1];
            particlePositions[i3 + 2] += particleVelocities[i3 + 2];

            particleLife[i] -= deltaTime * 0.5;

            if (particleLife[i] <= 0 || particlePositions[i3 + 1] > ringPosition.y + 5) {
                const angle = Math.random() * Math.PI * 2;
                const radius = THREE.MathUtils.randFloat(3.2, 4.8);

                particlePositions[i3] = Math.cos(angle) * radius + ringPosition.x;
                particlePositions[i3 + 1] = ringPosition.y - 1;
                particlePositions[i3 + 2] = Math.sin(angle) * radius + ringPosition.z;

                particleVelocities[i3] = (Math.random() - 0.5) * 0.02;
                particleVelocities[i3 + 1] = Math.random() * 0.03 + energyFactor * 0.05;
                particleVelocities[i3 + 2] = (Math.random() - 0.5) * 0.02;

                particleLife[i] = 1;
            }
        }
        particles.geometry.attributes.position.needsUpdate = true;
        particleMat.opacity = 0.3 + energyFactor * 0.5;

        // Star twinkling (reduced frequency on mobile)
        if (!isMobile || frameCount % 2 === 0) {
            starsMat.opacity = 0.6 + 0.3 * Math.sin(time * 0.5) + energyFactor * 0.2;
        }

        // Camera system
        if (cameraAutoRotate) {
            cameraAngle = time * (isMobile ? 0.03 : 0.05); // Slower on mobile
        }

        const radius = (isMobile ? 20 : 25) + Math.sin(time * 0.3) * (isMobile ? 3 : 5);
        camera.position.x = Math.cos(cameraAngle) * radius;
        camera.position.z = Math.sin(cameraAngle) * radius + (isMobile ? 8 : 10);
        camera.position.y = 8 + Math.sin(time * 0.2) * 3 + (ringPosition.y - 10) * 0.2;

        camera.lookAt(ring.position);

        renderer.render(scene, camera);
    }

    animate();

    // Mobile-optimized instructions overlay
    const instructions = document.createElement('div');
    const instructionStyle = isMobile ? `
        position: absolute;
        top: 10px;
        left: 10px;
        right: 10px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 10px;
        border-radius: 6px;
        font-family: 'Arial', sans-serif;
        font-size: 11px;
        pointer-events: none;
        z-index: 1000;
        border: 1px solid rgba(255,255,255,0.2);
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        max-height: 120px;
        overflow: hidden;
    ` : `
        position: absolute;
        top: 15px;
        left: 15px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 15px;
        border-radius: 8px;
        font-family: 'Courier New', monospace;
        font-size: 13px;
        pointer-events: none;
        z-index: 1000;
        border: 1px solid rgba(255,255,255,0.2);
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;

    instructions.style.cssText = instructionStyle;

    instructions.innerHTML = isMobile ? `
        <strong style="color: #44aaff;">🎮 RING PHYSICS</strong><br>
        <span style="color: #ffaa44;">Controls:</span><br>
        • Tap: Launch ring<br>
        • Double-tap: Super jump<br>
        • Drag: Apply force in flight<br>
        <span style="color: #44ff44;">Optimized for mobile</span>
    ` : `
        <strong style="color: #44aaff;">🎮 RING PHYSICS CONTROLS</strong><br><br>
        <span style="color: #ffaa44;">Launch:</span><br>
        • Click: Launch ring<br>
        • Double-click: Super jump<br>
        • Space: Small jump (ground only)<br><br>
        <span style="color: #ffaa44;">Camera:</span><br>
        • ← → or A/D: Rotate view<br>
        • Drag: Apply force (in flight)<br><br>
        <span style="color: #ffaa44;">Reset:</span><br>
        • R: Reset position<br><br>
        <span style="color: #44ff44;">Physics: Realistic gravity & boundaries</span>
    `;

    container.appendChild(instructions);

    // Add mobile-specific reset button
    if (isMobile) {
        const resetButton = document.createElement('button');
        resetButton.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(68, 170, 255, 0.8);
            color: white;
            border: none;
            border-radius: 6px;
            padding: 8px 12px;
            font-size: 12px;
            font-weight: bold;
            z-index: 1001;
            touch-action: manipulation;
        `;
        resetButton.textContent = 'RESET';
        resetButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            resetRing();
        });
        container.appendChild(resetButton);
    }
}

// -------------------------
// Scroll Reveal Animations
// -------------------------
function initScrollReveal() {
    const revealElements = document.querySelectorAll('.reveal, .reveal-stagger');
    
    if (!revealElements.length) return;

    // Skip animations if user prefers reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        revealElements.forEach(el => {
            el.classList.add('revealed');
        });
        return;
    }

    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -50px 0px',
        threshold: 0.1
    };

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                // Optionally unobserve after revealing for performance
                revealObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    revealElements.forEach(el => {
        revealObserver.observe(el);
    });
}

// Add reveal classes to home page content sections
function setupHomePageReveals() {
    const homeContent = document.getElementById('home-page-content');
    if (!homeContent) return;

    // Add reveal class to main sections
    const headers = homeContent.querySelectorAll(':scope > header');
    const sections = homeContent.querySelectorAll(':scope > section, :scope > .blog-section, :scope > .video-container, :scope > .threejs-wrapper');
    const paragraphs = homeContent.querySelectorAll(':scope > p');
    const lists = homeContent.querySelectorAll(':scope > ul');

    headers.forEach(el => el.classList.add('reveal'));
    sections.forEach(el => el.classList.add('reveal'));
    paragraphs.forEach(el => el.classList.add('reveal'));
    lists.forEach(el => el.classList.add('reveal'));

    // Add stagger to blog sections for cascading effect
    const blogSections = homeContent.querySelectorAll('.blog-section');
    blogSections.forEach(section => {
        section.classList.add('reveal');
        const ul = section.querySelector('ul');
        if (ul) {
            ul.classList.add('reveal-stagger');
        }
    });

    // Add reveal to video container and threejs wrapper
    const videoContainer = homeContent.querySelector('.video-container');
    if (videoContainer) videoContainer.classList.add('reveal');

    const threejsWrapper = homeContent.querySelector('.threejs-wrapper');
    if (threejsWrapper) threejsWrapper.classList.add('reveal');
}


// --------------
// Main Function
// --------------
function main() {
    // Dark Mode Setup
    const darkModeButton = document.getElementById("dark-mode-button");
    darkModeButton.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
        setCookie("darkMode", document.body.classList.contains("dark-mode"), 365, "Lax");
        checkLogo();
    });

    if (getCookie("darkMode") === "true") {
        document.body.classList.add("dark-mode");
    }
    checkLogo();

    // Setup scroll reveal animations for home page
    setupHomePageReveals();
    initScrollReveal();

    // Initialize Three.js if container is present
    if (document.getElementById('threejs-container')) {
        initializeThreeJS();
    }

    // Attach event listeners to our action buttons (if they exist)
    const suggestEditButton = document.querySelector('.btn-suggest-edit');
    if (suggestEditButton) {
        suggestEditButton.addEventListener('click', handleSuggestEditClick);
    }

    const createIssueButton = document.querySelector('.btn-create-issue');
    if (createIssueButton) {
        createIssueButton.addEventListener('click', handleCreateIssueClick);
    }

    const downloadButton = document.querySelector('.btn-download');
    if (downloadButton) {
        downloadButton.addEventListener('click', handleDownloadClick);
    }

    // Initialize article UX enhancements
    initTableOfContentsHighlight();
    initTableOfContentsToggle();
    initReadingProgress();
    initBackToTop();

    // Enhanced mobile nav UX: overlay, focus trap, and close interactions
    const navToggle = document.getElementById('navbar-toggle');
    const navMenu = navToggle ? navToggle.nextElementSibling : null; // <ul>
    if (navToggle && navMenu && navMenu.tagName === 'UL') {
        // Ensure ARIA linkage
        if (!navMenu.id) {
            navMenu.id = 'main-menu';
        }
        navToggle.setAttribute('aria-controls', navMenu.id);

        // Create overlay once
        let overlay = document.querySelector('.nav-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'nav-overlay';
            document.body.appendChild(overlay);
        }

        const updateOpenState = () => {
            const open = navToggle.checked;
            document.body.classList.toggle('nav-open', open);
            document.body.style.overflow = open ? 'hidden' : '';
            navMenu.setAttribute('aria-hidden', open ? 'false' : 'true');
            navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            if (open) {
                // Move focus to first focusable in menu for accessibility
                const firstFocusable = navMenu.querySelector('a, button, input, [tabindex]:not([tabindex="-1"])');
                if (firstFocusable) firstFocusable.focus({
                    preventScroll: true
                });
            }
        };

        updateOpenState();

        navToggle.addEventListener('change', updateOpenState);
        overlay.addEventListener('click', () => {
            navToggle.checked = false;
            updateOpenState();
        });

        // Close with ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && navToggle.checked) {
                navToggle.checked = false;
                updateOpenState();
                navToggle.focus();
            }
        });

        // Basic focus trap when open
        document.addEventListener('keydown', (e) => {
            if (!navToggle.checked || e.key !== 'Tab') return;
            const focusables = navMenu.querySelectorAll('a, button, input, [tabindex]:not([tabindex="-1"])');
            if (!focusables.length) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });

        // Close on navigation link click (improves UX on mobile)
        navMenu.addEventListener('click', (e) => {
            const target = e.target;
            if (target && target.closest('a')) {
                navToggle.checked = false;
                updateOpenState();
            }
        });
    }
}

// -------------------------
// Article UX Enhancements
// -------------------------

// Add toggle functionality for table of contents on mobile
function initTableOfContentsToggle() {
    const toc = document.getElementById('table-of-contents');
    if (!toc) return;

    // Find or create the h2 header
    let tocHeader = toc.querySelector(':scope > h2');
    if (!tocHeader) {
        // If no h2 exists, create one
        tocHeader = document.createElement('h2');
        tocHeader.textContent = 'Table of Contents';
        toc.insertBefore(tocHeader, toc.firstChild);
    }

    // Check if toggle button already exists
    let toggleButton = document.getElementById('table-of-contents-toggle');
    let toggleHandler = null;
    let resizeHandler = null;
    
    const setupMobileToggle = () => {
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile && !toggleButton) {
            // Create toggle button for mobile
            toggleButton = document.createElement('button');
            toggleButton.id = 'table-of-contents-toggle';
            toggleButton.setAttribute('aria-label', 'Toggle table of contents');
            toggleButton.setAttribute('aria-expanded', 'false');
            toggleButton.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            `;

            // Add toggle button to header
            tocHeader.appendChild(toggleButton);

            // Start collapsed on mobile
            toc.classList.add('collapsed');

            // Toggle functionality
            toggleHandler = () => {
                const isCollapsed = toc.classList.contains('collapsed');
                toc.classList.toggle('collapsed');
                toggleButton.setAttribute('aria-expanded', isCollapsed ? 'true' : 'false');
            };

            // Make header clickable
            tocHeader.style.cursor = 'pointer';
            tocHeader.addEventListener('click', toggleHandler);
        } else if (!isMobile && toggleButton) {
            // Remove mobile-specific elements when resizing to desktop
            toc.classList.remove('collapsed');
            if (toggleHandler) {
                tocHeader.removeEventListener('click', toggleHandler);
                toggleHandler = null;
            }
            toggleButton.remove();
            toggleButton = null;
            tocHeader.style.cursor = '';
        }
    };

    // Setup on load
    setupMobileToggle();

    // Handle window resize - use a single persistent handler
    resizeHandler = () => {
        setupMobileToggle();
    };
    window.addEventListener('resize', resizeHandler);
}

// Highlight active section in table of contents
function initTableOfContentsHighlight() {
    const toc = document.getElementById('table-of-contents');
    if (!toc) return;

    const tocLinks = toc.querySelectorAll('a[href^="#"]');
    if (!tocLinks.length) return;

    const headings = Array.from(tocLinks).map(link => {
        const id = link.getAttribute('href').substring(1);
        return document.getElementById(id);
    }).filter(Boolean);

    if (!headings.length) return;

    const observerOptions = {
        rootMargin: '-20% 0px -35% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1]
    };

    let activeLink = null;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                const newActiveLink = toc.querySelector(`a[href="#${id}"]`);
                
                if (newActiveLink && newActiveLink !== activeLink) {
                    // Remove active class from all links
                    tocLinks.forEach(link => link.classList.remove('active'));
                    // Add active class to current link
                    newActiveLink.classList.add('active');
                    activeLink = newActiveLink;

                    // Scroll TOC to show active link
                    if (toc.scrollHeight > toc.clientHeight) {
                        const linkTop = newActiveLink.offsetTop;
                        const linkHeight = newActiveLink.offsetHeight;
                        const tocHeight = toc.clientHeight;
                        const tocScroll = toc.scrollTop;

                        if (linkTop < tocScroll || linkTop + linkHeight > tocScroll + tocHeight) {
                            newActiveLink.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                        }
                    }
                }
            }
        });
    }, observerOptions);

    headings.forEach(heading => observer.observe(heading));
}

// Add reading progress indicator
function initReadingProgress() {
    const articleBody = document.getElementById('article-body');
    if (!articleBody) return;

    // Create progress bar
    const progressBar = document.createElement('div');
    progressBar.id = 'reading-progress';
    document.body.appendChild(progressBar);

    // Update progress on scroll
    const updateProgress = () => {
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight - windowHeight;
        const scrolled = window.scrollY;
        const progress = (scrolled / documentHeight) * 100;
        progressBar.style.width = Math.min(progress, 100) + '%';
    };

    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
}

// Add back to top button
function initBackToTop() {
    const articleBody = document.getElementById('article-body');
    if (!articleBody) return;

    const backToTopBtn = document.createElement('button');
    backToTopBtn.id = 'back-to-top';
    backToTopBtn.setAttribute('aria-label', 'Back to top');
    backToTopBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="19" x2="12" y2="5"></line>
            <polyline points="5 12 12 5 19 12"></polyline>
        </svg>
    `;

    document.body.appendChild(backToTopBtn);

    // Show/hide button based on scroll position
    const toggleButton = () => {
        if (window.scrollY > 400) {
            backToTopBtn.style.display = 'flex';
        } else {
            backToTopBtn.style.display = 'none';
        }
    };

    window.addEventListener('scroll', toggleButton, { passive: true });

    // Smooth scroll to top
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    toggleButton();
}

// -------------------------
// Main Initialization
// -------------------------

// Run `main` after DOM is ready
document.addEventListener("DOMContentLoaded", main);