let renderer;




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
        return 0;
    }, 900);
    return 0;
}




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


function getArticleGithubPath() {
    let path = location.pathname;
    if (path.startsWith("/")) {
        path = path.substring(1);
    }

    const parts = path.split("/");

    const articlesIndex = parts.lastIndexOf("articles");
    if (articlesIndex === -1 || articlesIndex >= parts.length - 1) {
        alert("Sorry, the article base '/articles' was not found in the URL or the section key is missing.");
        return null;
    }


    const sectionKey = parts[articlesIndex + 1];

    let filePathParts = parts.slice(articlesIndex + 2);
    let filePathInRepo = filePathParts.join("/");


    if (!GITHUB_BASE_REPOS.hasOwnProperty(sectionKey)) {
        alert("Sorry, no GitHub repository is configured for the section: " + sectionKey);
        return null;
    }
    const baseRepoUrl = GITHUB_BASE_REPOS[sectionKey];


    if (PATH_PREPENDS.hasOwnProperty(sectionKey)) {
        const prependFolder = PATH_PREPENDS[sectionKey];


        filePathInRepo = prependFolder + (filePathInRepo ? "/" + filePathInRepo : "");
    }



    if (filePathInRepo.match(/\.html$/)) {
        filePathInRepo = filePathInRepo.replace(/\.html$/, ".md");
    } else if (!/\.[^\/]+$/.test(filePathInRepo)) {

        filePathInRepo += ".md";
    }

    return {
        sectionKey,
        baseRepoUrl,
        filePathInRepo
    };
}


function handleSuggestEditClick() {
    const result = getArticleGithubPath();
    if (!result) {
        return;
    }
    const {
        sectionKey,
        baseRepoUrl,
        filePathInRepo
    } = result;

    const branch = MAIN_BRANCH.hasOwnProperty(sectionKey) ? MAIN_BRANCH[sectionKey] : "master";
    const editUrl = `${baseRepoUrl}/edit/${branch}/${filePathInRepo}`;
    window.open(editUrl, "_blank");
}


function handleCreateIssueClick() {
    const result = getArticleGithubPath();
    if (!result) {
        return;
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


    const cloned = article.cloneNode(true);



    cloned.querySelectorAll('.article-action-buttons').forEach(el => el.remove());


    cloned.querySelectorAll('p').forEach(p => {
        const txt = p.textContent.trim();
        if (/^Last modified:/i.test(txt) || /^This article is written in:/i.test(txt)) {
            p.remove();
        }
    });



    cloned.querySelectorAll('img').forEach(img => img.remove());


    cloned.querySelectorAll('header').forEach(header => {
        header.innerHTML = '<h1>Your Custom Header</h1>';
    });


    cloned.style.paddingBottom = '20px';


    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '-9999px';
    container.style.left = '-9999px';
    container.appendChild(cloned);
    document.body.appendChild(container);


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
    if (!container) return;
    
    // Check if Three.js is available
    if (typeof THREE === 'undefined') {
        console.warn('Three.js not loaded, skipping 3D visualization');
        return;
    }
    
    let darkMode = getCookie("darkMode") === "true";

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.innerWidth <= 768;

    // Quality settings optimized for performance
    const quality = {
        ringSegments: isMobile ? 80 : 128,
        tubeSegments: isMobile ? 24 : 48,
        particles: isMobile ? 400 : 1500,
        stars: isMobile ? 800 : 3000,
        pixelRatio: isMobile ? 1 : Math.min(window.devicePixelRatio, 2)
    };

    // Color palettes for light/dark modes
    const palette = {
        bg: darkMode ? 0x050510 : 0xf0f4f8,
        primary: darkMode ? 0x6366f1 : 0x3b82f6,      // Indigo/Blue
        secondary: darkMode ? 0x8b5cf6 : 0x6366f1,    // Purple
        accent: darkMode ? 0x06b6d4 : 0x0ea5e9,       // Cyan
        glow: darkMode ? 0x818cf8 : 0x60a5fa,         // Lighter glow
        particles: darkMode ? 0xc4b5fd : 0x93c5fd,    // Light purple/blue particles
        stars: darkMode ? 0xffffff : 0x475569
    };

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.bg);

    // Camera
    const camera = new THREE.PerspectiveCamera(
        isMobile ? 70 : 60,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    );
    camera.position.set(0, 0, isMobile ? 18 : 22);

    // Renderer with enhanced settings
    const renderer = new THREE.WebGLRenderer({
        antialias: !isMobile,
        alpha: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(quality.pixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = darkMode ? 1.2 : 1.0;
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, darkMode ? 0.3 : 0.5);
    scene.add(ambientLight);

    const mainLight = new THREE.PointLight(palette.glow, 2, 50, 1.5);
    mainLight.position.set(0, 0, 0);
    scene.add(mainLight);

    const rimLight1 = new THREE.PointLight(palette.primary, 1.5, 30, 2);
    rimLight1.position.set(10, 5, -5);
    scene.add(rimLight1);

    const rimLight2 = new THREE.PointLight(palette.secondary, 1.5, 30, 2);
    rimLight2.position.set(-10, -5, -5);
    scene.add(rimLight2);

    // Create ring group for synchronized rotation
    const ringGroup = new THREE.Group();
    scene.add(ringGroup);

    // Ring configurations - multiple interlocking rings
    const ringConfigs = [
        { radius: 5, tube: 0.18, color: palette.primary, rotAxis: 'y', speed: 0.3, tiltX: 0, tiltZ: 0 },
        { radius: 5.5, tube: 0.12, color: palette.secondary, rotAxis: 'x', speed: -0.25, tiltX: Math.PI / 4, tiltZ: 0 },
        { radius: 6, tube: 0.08, color: palette.accent, rotAxis: 'z', speed: 0.2, tiltX: Math.PI / 3, tiltZ: Math.PI / 6 }
    ];

    const rings = [];

    ringConfigs.forEach((config, index) => {
        const geometry = new THREE.TorusGeometry(
            config.radius,
            config.tube,
            quality.tubeSegments,
            quality.ringSegments
        );

        // Create gradient-like effect with vertex colors
        const colors = [];
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const angle = Math.atan2(y, x);
            const t = (angle + Math.PI) / (2 * Math.PI);
            
            // Gradient between primary and secondary colors
            const c1 = new THREE.Color(config.color);
            const c2 = new THREE.Color(palette.glow);
            c1.lerp(c2, 0.3 + 0.4 * Math.sin(t * Math.PI * 4));
            colors.push(c1.r, c1.g, c1.b);
        }
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const material = new THREE.MeshPhysicalMaterial({
            vertexColors: true,
            metalness: 0.9,
            roughness: 0.1,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            reflectivity: 1.0,
            envMapIntensity: 1.5,
            emissive: config.color,
            emissiveIntensity: darkMode ? 0.15 : 0.08
        });

        const ring = new THREE.Mesh(geometry, material);
        ring.rotation.x = config.tiltX;
        ring.rotation.z = config.tiltZ;
        ring.userData = { config, baseRotation: { x: ring.rotation.x, y: ring.rotation.y, z: ring.rotation.z } };
        rings.push(ring);
        ringGroup.add(ring);
    });

    // Central glowing core
    const coreGeometry = new THREE.SphereGeometry(1.5, 32, 32);
    const coreMaterial = new THREE.MeshBasicMaterial({
        color: palette.glow,
        transparent: true,
        opacity: darkMode ? 0.4 : 0.25
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    ringGroup.add(core);

    // Inner pulsing core
    const innerCoreGeometry = new THREE.SphereGeometry(0.8, 24, 24);
    const innerCoreMaterial = new THREE.MeshBasicMaterial({
        color: palette.primary,
        transparent: true,
        opacity: darkMode ? 0.7 : 0.5
    });
    const innerCore = new THREE.Mesh(innerCoreGeometry, innerCoreMaterial);
    ringGroup.add(innerCore);

    // Orbital particles system
    const particleCount = quality.particles;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const particleSpeeds = new Float32Array(particleCount);
    const particleOrbitRadii = new Float32Array(particleCount);
    const particleOrbitPhases = new Float32Array(particleCount);
    const particleOrbitTilts = new Float32Array(particleCount * 2);

    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const orbitRadius = 3 + Math.random() * 5;
        const phase = Math.random() * Math.PI * 2;
        const tiltX = (Math.random() - 0.5) * Math.PI;
        const tiltY = (Math.random() - 0.5) * Math.PI;
        
        particleOrbitRadii[i] = orbitRadius;
        particleOrbitPhases[i] = phase;
        particleOrbitTilts[i * 2] = tiltX;
        particleOrbitTilts[i * 2 + 1] = tiltY;
        particleSpeeds[i] = 0.2 + Math.random() * 0.5;

        // Initial positions
        particlePositions[i3] = Math.cos(phase) * orbitRadius;
        particlePositions[i3 + 1] = Math.sin(phase) * orbitRadius * Math.sin(tiltX);
        particlePositions[i3 + 2] = Math.sin(phase) * orbitRadius * Math.cos(tiltX);

        // Colors with gradient - use explicit HSL manipulation for compatibility
        const color = new THREE.Color(palette.particles);
        const hsl = { h: 0, s: 0, l: 0 };
        color.getHSL(hsl);
        color.setHSL(
            hsl.h + (Math.random() * 0.1 - 0.05),
            hsl.s,
            hsl.l + (Math.random() * 0.2 - 0.1)
        );
        particleColors[i3] = color.r;
        particleColors[i3 + 1] = color.g;
        particleColors[i3 + 2] = color.b;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const particleMaterial = new THREE.PointsMaterial({
        size: isMobile ? 0.08 : 0.12,
        vertexColors: true,
        transparent: true,
        opacity: darkMode ? 0.9 : 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // Star field background
    const starCount = quality.stars;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
        const i3 = i * 3;
        // Distribute stars in a sphere around the scene
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 80 + Math.random() * 120;
        
        starPositions[i3] = r * Math.sin(phi) * Math.cos(theta);
        starPositions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        starPositions[i3 + 2] = r * Math.cos(phi);

        const brightness = 0.5 + Math.random() * 0.5;
        const starColor = new THREE.Color(palette.stars);
        starColors[i3] = starColor.r * brightness;
        starColors[i3 + 1] = starColor.g * brightness;
        starColors[i3 + 2] = starColor.b * brightness;
    }

    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMaterial = new THREE.PointsMaterial({
        size: isMobile ? 0.8 : 1.2,
        vertexColors: true,
        transparent: true,
        opacity: darkMode ? 0.8 : 0.4,
        sizeAttenuation: true
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // Interaction state
    let mouseX = 0, mouseY = 0;
    let targetRotationX = 0, targetRotationY = 0;
    let interactionIntensity = 0;
    let isInteracting = false;
    const clock = new THREE.Clock();

    // Mouse/touch interaction handlers
    const handlePointerMove = (clientX, clientY) => {
        const rect = container.getBoundingClientRect();
        mouseX = ((clientX - rect.left) / rect.width - 0.5) * 2;
        mouseY = ((clientY - rect.top) / rect.height - 0.5) * 2;
        targetRotationY = mouseX * 0.5;
        targetRotationX = mouseY * 0.3;
        interactionIntensity = Math.min(1, interactionIntensity + 0.1);
    };

    const handlePointerStart = () => {
        isInteracting = true;
        interactionIntensity = Math.min(1, interactionIntensity + 0.3);
    };

    const handlePointerEnd = () => {
        isInteracting = false;
    };

    container.addEventListener('mousemove', (e) => handlePointerMove(e.clientX, e.clientY));
    container.addEventListener('mouseenter', handlePointerStart);
    container.addEventListener('mouseleave', handlePointerEnd);
    
    container.addEventListener('touchstart', (e) => {
        handlePointerStart();
        if (e.touches.length > 0) {
            handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });
    
    container.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
            handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });
    
    container.addEventListener('touchend', handlePointerEnd, { passive: true });

    // Handle resize
    const handleResize = () => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Animation loop
    const animate = () => {
        requestAnimationFrame(animate);
        const time = clock.getElapsedTime();
        const delta = clock.getDelta();

        // Check for dark mode changes
        const newDarkMode = getCookie("darkMode") === "true";
        if (newDarkMode !== darkMode) {
            darkMode = newDarkMode;
            scene.background = new THREE.Color(darkMode ? 0x050510 : 0xf0f4f8);
            renderer.toneMappingExposure = darkMode ? 1.2 : 1.0;
            coreMaterial.opacity = darkMode ? 0.4 : 0.25;
            innerCoreMaterial.opacity = darkMode ? 0.7 : 0.5;
            particleMaterial.opacity = darkMode ? 0.9 : 0.7;
            starMaterial.opacity = darkMode ? 0.8 : 0.4;
            rings.forEach(ring => {
                ring.material.emissiveIntensity = darkMode ? 0.15 : 0.08;
            });
        }

        // Smooth interaction decay
        if (!isInteracting) {
            interactionIntensity *= 0.95;
            targetRotationX *= 0.98;
            targetRotationY *= 0.98;
        }

        // Rotate rings with individual patterns
        rings.forEach((ring, index) => {
            const config = ring.userData.config;
            const baseSpeed = config.speed * (1 + interactionIntensity * 0.5);
            
            if (config.rotAxis === 'y') {
                ring.rotation.y += baseSpeed * delta * 2;
            } else if (config.rotAxis === 'x') {
                ring.rotation.x = ring.userData.baseRotation.x + time * baseSpeed;
            } else {
                ring.rotation.z = ring.userData.baseRotation.z + time * baseSpeed;
            }

            // Add subtle wobble based on interaction
            ring.rotation.x += Math.sin(time * 2 + index) * 0.002 * interactionIntensity;
            ring.rotation.z += Math.cos(time * 1.5 + index) * 0.002 * interactionIntensity;
        });

        // Animate ring group based on mouse
        ringGroup.rotation.x += (targetRotationX - ringGroup.rotation.x) * 0.05;
        ringGroup.rotation.y += (targetRotationY - ringGroup.rotation.y) * 0.05;

        // Pulsing core animation
        const pulse = 1 + Math.sin(time * 3) * 0.15;
        core.scale.setScalar(pulse);
        innerCore.scale.setScalar(0.8 + Math.sin(time * 4 + 1) * 0.1);
        
        coreMaterial.opacity = (darkMode ? 0.4 : 0.25) * (0.8 + Math.sin(time * 2) * 0.2);
        mainLight.intensity = 2 + Math.sin(time * 3) * 0.5 + interactionIntensity * 2;

        // Update orbital particles
        const positions = particles.geometry.attributes.position.array;
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            const speed = particleSpeeds[i] * (1 + interactionIntensity * 0.5);
            particleOrbitPhases[i] += speed * delta;
            
            const phase = particleOrbitPhases[i];
            const radius = particleOrbitRadii[i] + Math.sin(time * 2 + i) * 0.3;
            const tiltX = particleOrbitTilts[i * 2];
            const tiltY = particleOrbitTilts[i * 2 + 1];
            
            // Calculate 3D orbital position
            const x = Math.cos(phase) * radius;
            const y = Math.sin(phase) * radius * Math.sin(tiltX);
            const z = Math.sin(phase) * radius * Math.cos(tiltX);
            
            // Apply secondary rotation
            positions[i3] = x * Math.cos(tiltY) - z * Math.sin(tiltY);
            positions[i3 + 1] = y;
            positions[i3 + 2] = x * Math.sin(tiltY) + z * Math.cos(tiltY);
        }
        particles.geometry.attributes.position.needsUpdate = true;

        // Gentle star rotation
        stars.rotation.y += 0.0001;
        stars.rotation.x += 0.00005;

        // Camera subtle movement
        camera.position.x = Math.sin(time * 0.2) * 2;
        camera.position.y = Math.cos(time * 0.15) * 1.5;
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
    };

    animate();

    // Add interaction hint
    const hint = document.createElement('div');
    hint.style.cssText = `
        position: absolute;
        bottom: 15px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.6);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 12px;
        pointer-events: none;
        opacity: 0.8;
        backdrop-filter: blur(4px);
        transition: opacity 0.5s ease;
        z-index: 10;
    `;
    hint.setAttribute('aria-label', isMobile ? 'Touch to interact with the 3D ring' : 'Move mouse to interact with the 3D ring');
    hint.textContent = isMobile ? '👆 Touch to interact' : '🖱️ Move mouse to interact';
    container.appendChild(hint);

    // Fade out hint after interaction
    const fadeHint = () => {
        hint.style.opacity = '0';
        setTimeout(() => hint.remove(), 500);
    };
    container.addEventListener('mousemove', fadeHint, { once: true });
    container.addEventListener('touchstart', fadeHint, { once: true });
    setTimeout(fadeHint, 5000); // Auto-fade after 5 seconds
}




function initScrollReveal() {
    const revealElements = document.querySelectorAll('.reveal, .reveal-stagger');

    if (!revealElements.length) return;


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

                revealObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    revealElements.forEach(el => {
        revealObserver.observe(el);
    });
}


function setupHomePageReveals() {
    const homeContent = document.getElementById('home-page-content');
    if (!homeContent) return;


    const headers = homeContent.querySelectorAll(':scope > header');
    const sections = homeContent.querySelectorAll(':scope > section, :scope > .blog-section, :scope > .video-container, :scope > .threejs-wrapper');
    const paragraphs = homeContent.querySelectorAll(':scope > p');
    const lists = homeContent.querySelectorAll(':scope > ul');

    headers.forEach(el => el.classList.add('reveal'));
    sections.forEach(el => el.classList.add('reveal'));
    paragraphs.forEach(el => el.classList.add('reveal'));
    lists.forEach(el => el.classList.add('reveal'));


    const blogSections = homeContent.querySelectorAll('.blog-section');
    blogSections.forEach(section => {
        section.classList.add('reveal');
        const ul = section.querySelector('ul');
        if (ul) {
            ul.classList.add('reveal-stagger');
        }
    });


    const videoContainer = homeContent.querySelector('.video-container');
    if (videoContainer) videoContainer.classList.add('reveal');

    const threejsWrapper = homeContent.querySelector('.threejs-wrapper');
    if (threejsWrapper) threejsWrapper.classList.add('reveal');
}





function main() {

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


    setupHomePageReveals();
    initScrollReveal();


    if (document.getElementById('threejs-container')) {
        initializeThreeJS();
    }


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


    initTableOfContentsHighlight();
    initTableOfContentsToggle();
    initReadingProgress();
    initBackToTop();


    const navToggle = document.getElementById('navbar-toggle');
    const navMenu = navToggle ? navToggle.nextElementSibling : null;
    if (navToggle && navMenu && navMenu.tagName === 'UL') {

        if (!navMenu.id) {
            navMenu.id = 'main-menu';
        }
        navToggle.setAttribute('aria-controls', navMenu.id);


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


        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && navToggle.checked) {
                navToggle.checked = false;
                updateOpenState();
                navToggle.focus();
            }
        });


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


        navMenu.addEventListener('click', (e) => {
            const target = e.target;
            if (target && target.closest('a')) {
                navToggle.checked = false;
                updateOpenState();
            }
        });
    }
}






function initTableOfContentsToggle() {
    const toc = document.getElementById('table-of-contents');
    if (!toc) return;


    let tocHeader = toc.querySelector(':scope > h2');
    if (!tocHeader) {

        tocHeader = document.createElement('h2');
        tocHeader.textContent = 'Table of Contents';
        toc.insertBefore(tocHeader, toc.firstChild);
    }


    let toggleButton = document.getElementById('table-of-contents-toggle');
    let toggleHandler = null;
    let resizeHandler = null;

    const setupMobileToggle = () => {
        const isMobile = window.innerWidth <= 768;

        if (isMobile && !toggleButton) {

            toggleButton = document.createElement('button');
            toggleButton.id = 'table-of-contents-toggle';
            toggleButton.setAttribute('aria-label', 'Toggle table of contents');
            toggleButton.setAttribute('aria-expanded', 'false');
            toggleButton.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            `;


            tocHeader.appendChild(toggleButton);


            toc.classList.add('collapsed');


            toggleHandler = () => {
                const isCollapsed = toc.classList.contains('collapsed');
                toc.classList.toggle('collapsed');
                toggleButton.setAttribute('aria-expanded', isCollapsed ? 'true' : 'false');
            };


            tocHeader.style.cursor = 'pointer';
            tocHeader.addEventListener('click', toggleHandler);
        } else if (!isMobile && toggleButton) {

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


    setupMobileToggle();


    resizeHandler = () => {
        setupMobileToggle();
    };
    window.addEventListener('resize', resizeHandler);
}


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

                    tocLinks.forEach(link => link.classList.remove('active'));

                    newActiveLink.classList.add('active');
                    activeLink = newActiveLink;


                    if (toc.scrollHeight > toc.clientHeight) {
                        const linkTop = newActiveLink.offsetTop;
                        const linkHeight = newActiveLink.offsetHeight;
                        const tocHeight = toc.clientHeight;
                        const tocScroll = toc.scrollTop;

                        if (linkTop < tocScroll || linkTop + linkHeight > tocScroll + tocHeight) {
                            newActiveLink.scrollIntoView({
                                block: 'nearest',
                                behavior: 'smooth'
                            });
                        }
                    }
                }
            }
        });
    }, observerOptions);

    headings.forEach(heading => observer.observe(heading));
}


function initReadingProgress() {
    const articleBody = document.getElementById('article-body');
    if (!articleBody) return;


    const progressBar = document.createElement('div');
    progressBar.id = 'reading-progress';
    document.body.appendChild(progressBar);


    const updateProgress = () => {
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight - windowHeight;
        const scrolled = window.scrollY;
        const progress = (scrolled / documentHeight) * 100;
        progressBar.style.width = Math.min(progress, 100) + '%';
    };

    window.addEventListener('scroll', updateProgress, {
        passive: true
    });
    updateProgress();
}


function initBackToTop() {
    const articleBody = document.getElementById('article-body');
    if (!articleBody) return;

    const backToTopBtn = document.createElement('button');
    backToTopBtn.id = 'back-to-top';
    backToTopBtn.setAttribute('aria-label', 'Back to top');
    backToTopBtn.title = 'Back to top';
    backToTopBtn.textContent = '↑';

    document.body.appendChild(backToTopBtn);


    const toggleButton = () => {
        if (window.scrollY > 400) {
            backToTopBtn.style.display = 'flex';
        } else {
            backToTopBtn.style.display = 'none';
        }
    };

    window.addEventListener('scroll', toggleButton, {
        passive: true
    });


    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    toggleButton();
}






document.addEventListener("DOMContentLoaded", main);