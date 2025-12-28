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
    
    let darkMode = getCookie("darkMode") === "true";

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.innerWidth <= 768;

    const qualitySettings = {
        particles: isMobile ? 300 : 1500,
        stars: isMobile ? 2000 : 6000,
        orbitParticles: isMobile ? 150 : 500,
        pixelRatio: isMobile ? 1 : Math.min(window.devicePixelRatio, 2),
        antialias: !isMobile,
        ringDetail: isMobile ? [20, 80] : [48, 192]
    };

    const colorSchemes = {
        dark: {
            bg: 0x050510,
            primary: 0x00d4ff,
            secondary: 0xff006a,
            accent: 0xffaa00,
            glow: 0x4488ff,
            star: 0xffffff,
            nebula1: 0x1a0033,
            nebula2: 0x000033
        },
        light: {
            bg: 0xf0f4f8,
            primary: 0x0066cc,
            secondary: 0xcc0055,
            accent: 0xdd8800,
            glow: 0x3366aa,
            star: 0x333344,
            nebula1: 0xe8e0f0,
            nebula2: 0xe0e8f0
        }
    };

    let colors = darkMode ? colorSchemes.dark : colorSchemes.light;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(colors.bg);

    const camera = new THREE.PerspectiveCamera(
        isMobile ? 70 : 60,
        container.clientWidth / container.clientHeight,
        0.1,
        2000
    );
    camera.position.set(0, 5, isMobile ? 18 : 22);

    const renderer = new THREE.WebGLRenderer({
        antialias: qualitySettings.antialias,
        alpha: true,
        powerPreference: isMobile ? "default" : "high-performance"
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(qualitySettings.pixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = darkMode ? 1.5 : 1.0;
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, darkMode ? 0.3 : 0.5);
    scene.add(ambient);

    const mainLight = new THREE.DirectionalLight(0xffffff, darkMode ? 0.8 : 1.0);
    mainLight.position.set(10, 20, 15);
    scene.add(mainLight);

    const coreLight = new THREE.PointLight(colors.primary, 2, 30);
    coreLight.position.set(0, 0, 0);
    scene.add(coreLight);

    const accentLight1 = new THREE.PointLight(colors.secondary, 1, 25);
    accentLight1.position.set(8, 3, 0);
    scene.add(accentLight1);

    const accentLight2 = new THREE.PointLight(colors.accent, 1, 25);
    accentLight2.position.set(-8, -3, 0);
    scene.add(accentLight2);

    const ringGroup = new THREE.Group();
    scene.add(ringGroup);

    const mainRingGeo = new THREE.TorusGeometry(5, 0.4, qualitySettings.ringDetail[0], qualitySettings.ringDetail[1]);
    const mainRingMat = new THREE.MeshPhysicalMaterial({
        color: colors.primary,
        metalness: 0.9,
        roughness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        reflectivity: 1.0,
        envMapIntensity: 1.5,
        emissive: colors.primary,
        emissiveIntensity: 0.15
    });
    const mainRing = new THREE.Mesh(mainRingGeo, mainRingMat);
    ringGroup.add(mainRing);

    const innerRingGeo = new THREE.TorusGeometry(4.2, 0.15, 16, qualitySettings.ringDetail[1]);
    const innerRingMat = new THREE.MeshPhysicalMaterial({
        color: colors.secondary,
        metalness: 0.95,
        roughness: 0.05,
        emissive: colors.secondary,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.9
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    ringGroup.add(innerRing);

    const outerRingGeo = new THREE.TorusGeometry(5.8, 0.08, 12, qualitySettings.ringDetail[1]);
    const outerRingMat = new THREE.MeshPhysicalMaterial({
        color: colors.accent,
        metalness: 0.9,
        roughness: 0.1,
        emissive: colors.accent,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.8
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    ringGroup.add(outerRing);

    const coreGeo = new THREE.SphereGeometry(1.2, 32, 32);
    const coreMat = new THREE.MeshPhysicalMaterial({
        color: colors.glow,
        emissive: colors.glow,
        emissiveIntensity: 0.8,
        metalness: 0.3,
        roughness: 0.2,
        transparent: true,
        opacity: 0.9
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    ringGroup.add(core);

    const glowGeo = new THREE.SphereGeometry(2, 24, 24);
    const glowMat = new THREE.MeshBasicMaterial({
        color: colors.primary,
        transparent: true,
        opacity: 0.15,
        side: THREE.BackSide
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    ringGroup.add(glow);

    const orbitRings = [];
    const orbitConfigs = [
        { radius: 7, speed: 0.3, tilt: Math.PI / 6, color: colors.primary, opacity: 0.4 },
        { radius: 8.5, speed: -0.2, tilt: -Math.PI / 4, color: colors.secondary, opacity: 0.3 },
        { radius: 10, speed: 0.15, tilt: Math.PI / 3, color: colors.accent, opacity: 0.25 }
    ];

    orbitConfigs.forEach(config => {
        const orbitGeo = new THREE.RingGeometry(config.radius - 0.02, config.radius + 0.02, 128);
        const orbitMat = new THREE.MeshBasicMaterial({
            color: config.color,
            transparent: true,
            opacity: config.opacity,
            side: THREE.DoubleSide
        });
        const orbitMesh = new THREE.Mesh(orbitGeo, orbitMat);
        orbitMesh.rotation.x = config.tilt;
        orbitMesh.userData = { speed: config.speed, baseTilt: config.tilt };
        orbitRings.push(orbitMesh);
        scene.add(orbitMesh);
    });

    const particleCount = qualitySettings.particles;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    const particleData = [];

    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 4 + Math.random() * 3;
        const height = (Math.random() - 0.5) * 2;
        
        particlePositions[i * 3] = Math.cos(angle) * radius;
        particlePositions[i * 3 + 1] = height;
        particlePositions[i * 3 + 2] = Math.sin(angle) * radius;
        
        const colorChoice = Math.random();
        let color;
        if (colorChoice < 0.4) {
            color = new THREE.Color(colors.primary);
        } else if (colorChoice < 0.7) {
            color = new THREE.Color(colors.secondary);
        } else {
            color = new THREE.Color(colors.accent);
        }
        
        particleColors[i * 3] = color.r;
        particleColors[i * 3 + 1] = color.g;
        particleColors[i * 3 + 2] = color.b;
        
        particleSizes[i] = Math.random() * 3 + 1;
        
        particleData.push({
            angle: angle,
            radius: radius,
            baseHeight: height,
            speed: 0.2 + Math.random() * 0.5,
            verticalSpeed: (Math.random() - 0.5) * 0.5,
            phase: Math.random() * Math.PI * 2
        });
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
    particleGeo.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));

    const particleMat = new THREE.PointsMaterial({
        size: isMobile ? 2.5 : 3.5,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    const orbitParticleCount = qualitySettings.orbitParticles;
    const orbitParticlePositions = new Float32Array(orbitParticleCount * 3);
    const orbitParticleColors = new Float32Array(orbitParticleCount * 3);
    const orbitParticleData = [];

    for (let i = 0; i < orbitParticleCount; i++) {
        const orbitIndex = Math.floor(Math.random() * orbitConfigs.length);
        const config = orbitConfigs[orbitIndex];
        const angle = Math.random() * Math.PI * 2;
        
        const x = Math.cos(angle) * config.radius;
        const y = Math.sin(angle) * config.radius * Math.sin(config.tilt);
        const z = Math.sin(angle) * config.radius * Math.cos(config.tilt);
        
        orbitParticlePositions[i * 3] = x;
        orbitParticlePositions[i * 3 + 1] = y;
        orbitParticlePositions[i * 3 + 2] = z;
        
        const color = new THREE.Color(config.color);
        orbitParticleColors[i * 3] = color.r;
        orbitParticleColors[i * 3 + 1] = color.g;
        orbitParticleColors[i * 3 + 2] = color.b;
        
        orbitParticleData.push({
            orbitIndex: orbitIndex,
            angle: angle,
            speed: config.speed * (0.8 + Math.random() * 0.4)
        });
    }

    const orbitParticleGeo = new THREE.BufferGeometry();
    orbitParticleGeo.setAttribute('position', new THREE.BufferAttribute(orbitParticlePositions, 3));
    orbitParticleGeo.setAttribute('color', new THREE.BufferAttribute(orbitParticleColors, 3));

    const orbitParticleMat = new THREE.PointsMaterial({
        size: isMobile ? 4 : 6,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    
    const orbitParticles = new THREE.Points(orbitParticleGeo, orbitParticleMat);
    scene.add(orbitParticles);

    const starCount = qualitySettings.stars;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = 200 + Math.random() * 800;
        
        starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        starPositions[i * 3 + 2] = radius * Math.cos(phi);
        
        const brightness = 0.5 + Math.random() * 0.5;
        const tint = Math.random();
        if (tint < 0.1) {
            starColors[i * 3] = brightness;
            starColors[i * 3 + 1] = brightness * 0.7;
            starColors[i * 3 + 2] = brightness * 0.5;
        } else if (tint < 0.2) {
            starColors[i * 3] = brightness * 0.7;
            starColors[i * 3 + 1] = brightness * 0.8;
            starColors[i * 3 + 2] = brightness;
        } else {
            starColors[i * 3] = brightness;
            starColors[i * 3 + 1] = brightness;
            starColors[i * 3 + 2] = brightness;
        }
        
        starSizes[i] = Math.random() * 2 + 0.5;
    }

    const starsGeo = new THREE.BufferGeometry();
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starsGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    starsGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

    const starsMat = new THREE.PointsMaterial({
        size: isMobile ? 1.5 : 2,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: darkMode ? 0.9 : 0.4,
        blending: darkMode ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    
    const starField = new THREE.Points(starsGeo, starsMat);
    scene.add(starField);

    let mouseX = 0;
    let mouseY = 0;
    let targetRotationX = 0;
    let targetRotationY = 0;
    let currentRotationX = 0;
    let currentRotationY = 0;
    let isInteracting = false;
    let energyLevel = 0;
    let pulsePhase = 0;
    let cameraAngle = 0;
    let autoRotate = true;

    const clock = new THREE.Clock();
    let time = 0;

    function handleMouseMove(e) {
        const rect = container.getBoundingClientRect();
        mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        mouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        
        if (isInteracting) {
            targetRotationY = mouseX * Math.PI * 0.5;
            targetRotationX = mouseY * Math.PI * 0.3;
        }
    }

    function handleTouchMove(e) {
        if (e.touches.length > 0) {
            const rect = container.getBoundingClientRect();
            const touch = e.touches[0];
            mouseX = ((touch.clientX - rect.left) / rect.width - 0.5) * 2;
            mouseY = ((touch.clientY - rect.top) / rect.height - 0.5) * 2;
            
            if (isInteracting) {
                targetRotationY = mouseX * Math.PI * 0.5;
                targetRotationX = mouseY * Math.PI * 0.3;
            }
        }
    }

    function handleInteractionStart(e) {
        isInteracting = true;
        autoRotate = false;
        energyLevel = Math.min(1, energyLevel + 0.3);
    }

    function handleInteractionEnd() {
        isInteracting = false;
        setTimeout(() => { autoRotate = true; }, 3000);
    }

    function handleClick() {
        energyLevel = Math.min(1, energyLevel + 0.5);
        pulsePhase = 0;
    }

    function handleDoubleClick() {
        energyLevel = 1;
        pulsePhase = 0;
    }

    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('mousedown', handleInteractionStart);
    renderer.domElement.addEventListener('mouseup', handleInteractionEnd);
    renderer.domElement.addEventListener('mouseleave', handleInteractionEnd);
    renderer.domElement.addEventListener('click', handleClick);
    renderer.domElement.addEventListener('dblclick', handleDoubleClick);

    renderer.domElement.addEventListener('touchstart', (e) => {
        handleInteractionStart(e);
    }, { passive: true });
    renderer.domElement.addEventListener('touchmove', handleTouchMove, { passive: true });

    let lastClickTime = 0;
    renderer.domElement.addEventListener('touchend', (e) => {
        handleInteractionEnd();
        const now = Date.now();
        if (now - lastClickTime < 300) {
            handleDoubleClick();
        } else {
            handleClick();
        }
        lastClickTime = now;
    }, { passive: true });

    function handleResize() {
        const width = container.clientWidth;
        const height = container.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }

    window.addEventListener('resize', handleResize);

    function updateColors() {
        const newDarkMode = getCookie("darkMode") === "true";
        if (newDarkMode !== darkMode) {
            darkMode = newDarkMode;
            colors = darkMode ? colorSchemes.dark : colorSchemes.light;
            
            scene.background = new THREE.Color(colors.bg);
            renderer.toneMappingExposure = darkMode ? 1.5 : 1.0;
            
            mainRingMat.color.setHex(colors.primary);
            mainRingMat.emissive.setHex(colors.primary);
            innerRingMat.color.setHex(colors.secondary);
            innerRingMat.emissive.setHex(colors.secondary);
            outerRingMat.color.setHex(colors.accent);
            outerRingMat.emissive.setHex(colors.accent);
            coreMat.color.setHex(colors.glow);
            coreMat.emissive.setHex(colors.glow);
            glowMat.color.setHex(colors.primary);
            coreLight.color.setHex(colors.primary);
            accentLight1.color.setHex(colors.secondary);
            accentLight2.color.setHex(colors.accent);
            
            starsMat.opacity = darkMode ? 0.9 : 0.4;
            starsMat.blending = darkMode ? THREE.AdditiveBlending : THREE.NormalBlending;
        }
    }

    function animate() {
        requestAnimationFrame(animate);
        
        const deltaTime = clock.getDelta();
        time += deltaTime;

        updateColors();

        energyLevel = Math.max(0, energyLevel - deltaTime * 0.15);
        pulsePhase += deltaTime * 8;

        const pulse = 1 + Math.sin(pulsePhase) * 0.1 * energyLevel;
        const breathe = 1 + Math.sin(time * 2) * 0.02;

        if (autoRotate) {
            cameraAngle += deltaTime * 0.1;
            targetRotationY = Math.sin(time * 0.3) * 0.3;
            targetRotationX = Math.sin(time * 0.2) * 0.1;
        }

        currentRotationX += (targetRotationX - currentRotationX) * 0.05;
        currentRotationY += (targetRotationY - currentRotationY) * 0.05;

        ringGroup.rotation.x = currentRotationX + time * 0.1;
        ringGroup.rotation.y = currentRotationY + time * 0.15;
        ringGroup.rotation.z = Math.sin(time * 0.5) * 0.05;

        innerRing.rotation.z = time * 0.5;
        outerRing.rotation.z = -time * 0.3;

        core.scale.setScalar(pulse * breathe);
        glow.scale.setScalar(pulse * breathe * 1.5);
        glowMat.opacity = 0.1 + energyLevel * 0.2 + Math.sin(time * 3) * 0.05;

        mainRingMat.emissiveIntensity = 0.15 + energyLevel * 0.5 + Math.sin(time * 4) * 0.05;
        innerRingMat.emissiveIntensity = 0.3 + energyLevel * 0.4;
        outerRingMat.emissiveIntensity = 0.4 + energyLevel * 0.3;
        coreMat.emissiveIntensity = 0.8 + energyLevel * 0.5 + Math.sin(time * 5) * 0.1;

        coreLight.intensity = 2 + energyLevel * 3 + Math.sin(time * 4) * 0.5;

        orbitRings.forEach((ring, index) => {
            ring.rotation.z += ring.userData.speed * deltaTime;
            ring.rotation.x = ring.userData.baseTilt + Math.sin(time * 0.5 + index) * 0.1;
        });

        const positions = particles.geometry.attributes.position.array;
        const particleStep = isMobile ? 2 : 1;
        for (let i = 0; i < particleCount; i += particleStep) {
            const data = particleData[i];
            data.angle += data.speed * deltaTime;
            
            const radiusMod = data.radius + Math.sin(time * 2 + data.phase) * 0.5;
            positions[i * 3] = Math.cos(data.angle) * radiusMod;
            positions[i * 3 + 1] = data.baseHeight + Math.sin(time * data.verticalSpeed + data.phase) * 1.5;
            positions[i * 3 + 2] = Math.sin(data.angle) * radiusMod;
        }
        particles.geometry.attributes.position.needsUpdate = true;
        particles.rotation.y = time * 0.05;

        const orbitPositions = orbitParticles.geometry.attributes.position.array;
        const orbitStep = isMobile ? 2 : 1;
        for (let i = 0; i < orbitParticleCount; i += orbitStep) {
            const data = orbitParticleData[i];
            const config = orbitConfigs[data.orbitIndex];
            data.angle += data.speed * deltaTime;
            
            const cosA = Math.cos(data.angle);
            const sinA = Math.sin(data.angle);
            const cosT = Math.cos(config.tilt);
            const sinT = Math.sin(config.tilt);
            
            const x = cosA * config.radius;
            const y = sinA * config.radius * sinT;
            const z = sinA * config.radius * cosT;
            
            orbitPositions[i * 3] = x;
            orbitPositions[i * 3 + 1] = y;
            orbitPositions[i * 3 + 2] = z;
        }
        orbitParticles.geometry.attributes.position.needsUpdate = true;


        starField.rotation.y = time * 0.002;
        starField.rotation.x = time * 0.001;

        const camRadius = (isMobile ? 18 : 22) + Math.sin(time * 0.3) * 2;
        const camHeight = 5 + Math.sin(time * 0.2) * 2 + mouseY * 3;
        camera.position.x = Math.cos(cameraAngle) * camRadius + mouseX * 5;
        camera.position.z = Math.sin(cameraAngle) * camRadius;
        camera.position.y = camHeight;
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
    }

    animate();

    const instructions = document.createElement('div');
    const instructionStyle = `
        position: absolute;
        ${isMobile ? 'bottom: 15px; left: 15px; right: 15px;' : 'bottom: 20px; left: 20px;'}
        background: linear-gradient(135deg, rgba(0,20,40,0.9) 0%, rgba(0,10,30,0.95) 100%);
        color: #fff;
        padding: ${isMobile ? '12px 16px' : '16px 20px'};
        border-radius: 12px;
        font-family: 'Segoe UI', system-ui, sans-serif;
        font-size: ${isMobile ? '12px' : '13px'};
        pointer-events: none;
        z-index: 1000;
        border: 1px solid rgba(0,180,255,0.3);
        box-shadow: 0 8px 32px rgba(0,100,200,0.2), inset 0 1px 0 rgba(255,255,255,0.1);
        backdrop-filter: blur(10px);
        max-width: ${isMobile ? 'auto' : '280px'};
    `;
    instructions.style.cssText = instructionStyle;

    instructions.innerHTML = isMobile ? `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="font-size: 18px;">✨</span>
            <strong style="color: #00d4ff; font-size: 14px;">COSMIC RING</strong>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; font-size: 11px; opacity: 0.9;">
            <span>👆 Drag to rotate</span>
            <span>👆👆 Double-tap for energy burst</span>
        </div>
    ` : `
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
            <span style="font-size: 24px;">✨</span>
            <strong style="color: #00d4ff; font-size: 16px; letter-spacing: 1px;">COSMIC RING</strong>
        </div>
        <div style="display: grid; gap: 6px; font-size: 12px; opacity: 0.9;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: #ff006a;">⟡</span>
                <span>Click & drag to control rotation</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: #ffaa00;">⟡</span>
                <span>Click to add energy</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: #00ff88;">⟡</span>
                <span>Double-click for energy burst</span>
            </div>
        </div>
    `;

    container.appendChild(instructions);
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