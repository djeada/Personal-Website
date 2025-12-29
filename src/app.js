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
        particles: isMobile ? 400 : 1800,
        trailParticles: isMobile ? 150 : 500,
        nebulaParticles: isMobile ? 300 : 1000,
        stars: isMobile ? 3000 : 8000,
        shadowMap: isMobile ? 512 : 2048,
        pixelRatio: isMobile ? 1 : Math.min(window.devicePixelRatio, 2),
        antialias: !isMobile,
        fog: isMobile ? 0.003 : 0.0015,
        ringDetail: isMobile ? [24, 96] : [48, 192]
    };

    const colorSchemes = {
        dark: {
            bg: 0x030308,
            fog: 0x050510,
            ringPrimary: 0x00ccff,
            ringSecondary: 0xff00aa,
            ringAccent: 0xffaa00,
            star: 0xffffff,
            nebula1: 0x4400ff,
            nebula2: 0xff0066,
            nebula3: 0x00ffaa,
            energy: 0x00ffff,
            trail: 0x8844ff
        },
        light: {
            bg: 0x1a1a2e,
            fog: 0x16213e,
            ringPrimary: 0x00d4ff,
            ringSecondary: 0xff2d95,
            ringAccent: 0xffa500,
            star: 0xffffff,
            nebula1: 0x7b2cbf,
            nebula2: 0xe94560,
            nebula3: 0x0ead69,
            energy: 0x00d4ff,
            trail: 0x9d4edd
        }
    };

    let colors = darkMode ? colorSchemes.dark : colorSchemes.light;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(colors.fog, qualitySettings.fog);

    const camera = new THREE.PerspectiveCamera(
        isMobile ? 80 : 70,
        container.clientWidth / container.clientHeight,
        0.1,
        2000
    );
    camera.position.set(0, 8, isMobile ? 22 : 28);

    const renderer = new THREE.WebGLRenderer({
        antialias: qualitySettings.antialias,
        alpha: true,
        powerPreference: isMobile ? "default" : "high-performance"
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(qualitySettings.pixelRatio);

    if (!isMobile) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    renderer.setClearColor(colors.bg, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0x222244, isMobile ? 0.6 : 0.4);
    scene.add(ambient);

    const sunLight = new THREE.DirectionalLight(0xffffff, isMobile ? 0.7 : 0.9);
    sunLight.position.set(25, 40, 25);
    if (!isMobile) {
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = qualitySettings.shadowMap;
        sunLight.shadow.mapSize.height = qualitySettings.shadowMap;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 120;
        sunLight.shadow.camera.left = -60;
        sunLight.shadow.camera.right = 60;
        sunLight.shadow.camera.top = 60;
        sunLight.shadow.camera.bottom = -60;
    }
    scene.add(sunLight);

    const energyLight = new THREE.PointLight(colors.energy, 0, 80, 1.5);
    energyLight.position.set(0, 10, 0);
    scene.add(energyLight);

    const cosmicLight1 = new THREE.PointLight(colors.nebula1, 0.4, 150);
    cosmicLight1.position.set(-30, 20, -20);
    scene.add(cosmicLight1);

    const cosmicLight2 = new THREE.PointLight(colors.nebula2, 0.3, 150);
    cosmicLight2.position.set(30, -10, 25);
    scene.add(cosmicLight2);

    const ringGroup = new THREE.Group();
    ringGroup.position.set(0, 10, 0);
    scene.add(ringGroup);

    const mainRingGeo = new THREE.TorusGeometry(4, 0.35, qualitySettings.ringDetail[0], qualitySettings.ringDetail[1]);
    const mainRingMat = new THREE.MeshPhysicalMaterial({
        color: colors.ringPrimary,
        metalness: 0.95,
        roughness: 0.08,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
        reflectivity: 1.0,
        envMapIntensity: 1.5,
        emissive: colors.ringPrimary,
        emissiveIntensity: 0.1
    });
    const mainRing = new THREE.Mesh(mainRingGeo, mainRingMat);
    mainRing.castShadow = !isMobile;
    mainRing.receiveShadow = !isMobile;
    ringGroup.add(mainRing);

    const innerGlowGeo = new THREE.TorusGeometry(3.5, 0.12, 16, qualitySettings.ringDetail[1]);
    const innerGlowMat = new THREE.MeshBasicMaterial({
        color: colors.ringSecondary,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
    });
    const innerGlow = new THREE.Mesh(innerGlowGeo, innerGlowMat);
    ringGroup.add(innerGlow);

    const outerGlowGeo = new THREE.TorusGeometry(4.6, 0.08, 12, qualitySettings.ringDetail[1]);
    const outerGlowMat = new THREE.MeshBasicMaterial({
        color: colors.ringAccent,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending
    });
    const outerGlow = new THREE.Mesh(outerGlowGeo, outerGlowMat);
    ringGroup.add(outerGlow);

    const coreGeo = new THREE.SphereGeometry(0.6, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    ringGroup.add(core);

    const coreGlowGeo = new THREE.SphereGeometry(1.0, 24, 24);
    const coreGlowMat = new THREE.MeshBasicMaterial({
        color: colors.energy,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
    });
    const coreGlow = new THREE.Mesh(coreGlowGeo, coreGlowMat);
    ringGroup.add(coreGlow);

    const coreOuterGlowGeo = new THREE.SphereGeometry(1.8, 16, 16);
    const coreOuterGlowMat = new THREE.MeshBasicMaterial({
        color: colors.energy,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide
    });
    const coreOuterGlow = new THREE.Mesh(coreOuterGlowGeo, coreOuterGlowMat);
    ringGroup.add(coreOuterGlow);

    const coreHaloGeo = new THREE.SphereGeometry(2.5, 12, 12);
    const coreHaloMat = new THREE.MeshBasicMaterial({
        color: colors.energy,
        transparent: true,
        opacity: 0.08,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide
    });
    const coreHalo = new THREE.Mesh(coreHaloGeo, coreHaloMat);
    ringGroup.add(coreHalo);


    const GRAVITY = -9.81 * 0.6;
    const GROUND_LEVEL = 1;
    const MAX_LAUNCH_VELOCITY = isMobile ? 18 : 25;
    const MAX_HORIZONTAL_DISTANCE = isMobile ? 35 : 50;
    const VELOCITY_DAMPING_GROUND = 0.82;
    const MIN_BOUNCE_VELOCITY = 0.4;

    let ringVelocity = { x: 0, y: 0, z: 0 };
    let ringPosition = { x: 0, y: 10, z: 0 };
    let angularVelocity = { x: 0, y: 0, z: 0 };
    let baseRotationSpeed = 0.008;
    let ringOnGround = false;
    let impactIntensity = 0;
    let launchFlash = 0;

    const trailPositions = [];
    const maxTrailLength = isMobile ? 30 : 60;

    const particleCount = qualitySettings.particles;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const particleVelocities = new Float32Array(particleCount * 3);
    const particleLife = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = THREE.MathUtils.randFloat(3.2, 5.0);
        const i3 = i * 3;

        particlePositions[i3] = Math.cos(angle) * radius;
        particlePositions[i3 + 1] = ringPosition.y + (Math.random() - 0.5) * 3;
        particlePositions[i3 + 2] = Math.sin(angle) * radius;

        particleVelocities[i3] = (Math.random() - 0.5) * 0.04;
        particleVelocities[i3 + 1] = Math.random() * 0.08;
        particleVelocities[i3 + 2] = (Math.random() - 0.5) * 0.04;

        const colorChoice = Math.random();
        if (colorChoice < 0.4) {
            const c = new THREE.Color(colors.energy);
            particleColors[i3] = c.r;
            particleColors[i3 + 1] = c.g;
            particleColors[i3 + 2] = c.b;
        } else if (colorChoice < 0.7) {
            const c = new THREE.Color(colors.ringSecondary);
            particleColors[i3] = c.r;
            particleColors[i3 + 1] = c.g;
            particleColors[i3 + 2] = c.b;
        } else {
            const c = new THREE.Color(colors.ringAccent);
            particleColors[i3] = c.r;
            particleColors[i3 + 1] = c.g;
            particleColors[i3 + 2] = c.b;
        }

        particleLife[i] = Math.random();
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const particleMat = new THREE.PointsMaterial({
        size: isMobile ? 2.0 : 3.0,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    const nebulaCount = qualitySettings.nebulaParticles;
    const nebulaPositions = new Float32Array(nebulaCount * 3);
    const nebulaColors = new Float32Array(nebulaCount * 3);
    const nebulaSizes = new Float32Array(nebulaCount);
    const nebulaData = [];

    for (let i = 0; i < nebulaCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = 40 + Math.random() * 80;
        
        nebulaPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        nebulaPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.5;
        nebulaPositions[i * 3 + 2] = radius * Math.cos(phi);
        
        const colorChoice = Math.random();
        let c;
        if (colorChoice < 0.33) c = new THREE.Color(colors.nebula1);
        else if (colorChoice < 0.66) c = new THREE.Color(colors.nebula2);
        else c = new THREE.Color(colors.nebula3);
        
        nebulaColors[i * 3] = c.r;
        nebulaColors[i * 3 + 1] = c.g;
        nebulaColors[i * 3 + 2] = c.b;
        
        nebulaSizes[i] = Math.random() * 8 + 4;
        nebulaData.push({ speed: (Math.random() - 0.5) * 0.002, phase: Math.random() * Math.PI * 2 });
    }

    const nebulaGeo = new THREE.BufferGeometry();
    nebulaGeo.setAttribute('position', new THREE.BufferAttribute(nebulaPositions, 3));
    nebulaGeo.setAttribute('color', new THREE.BufferAttribute(nebulaColors, 3));

    const nebulaMat = new THREE.PointsMaterial({
        size: isMobile ? 6 : 10,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: darkMode ? 0.4 : 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const nebula = new THREE.Points(nebulaGeo, nebulaMat);
    scene.add(nebula);

    const trailCount = qualitySettings.trailParticles;
    const trailParticlePositions = new Float32Array(trailCount * 3);
    const trailParticleColors = new Float32Array(trailCount * 3);
    const trailParticleData = [];

    for (let i = 0; i < trailCount; i++) {
        trailParticlePositions[i * 3] = 0;
        trailParticlePositions[i * 3 + 1] = -1000;
        trailParticlePositions[i * 3 + 2] = 0;
        
        const c = new THREE.Color(colors.trail);
        trailParticleColors[i * 3] = c.r;
        trailParticleColors[i * 3 + 1] = c.g;
        trailParticleColors[i * 3 + 2] = c.b;
        
        trailParticleData.push({ life: 0, maxLife: 0 });
    }

    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailParticlePositions, 3));
    trailGeo.setAttribute('color', new THREE.BufferAttribute(trailParticleColors, 3));

    const trailMat = new THREE.PointsMaterial({
        size: isMobile ? 3 : 5,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const trailParticles = new THREE.Points(trailGeo, trailMat);
    scene.add(trailParticles);

    const starCount = qualitySettings.stars;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starBaseColors = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    const starTwinklePhases = new Float32Array(starCount);
    const starTwinkleSpeeds = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
        const i3 = i * 3;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = 150 + Math.random() * 850;
        
        starPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        starPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        starPositions[i3 + 2] = radius * Math.cos(phi);
        
        const baseBrightness = 0.4 + Math.random() * 0.6;
        starTwinklePhases[i] = Math.random() * Math.PI * 2;
        starTwinkleSpeeds[i] = 0.5 + Math.random() * 2.5;
        
        const tint = Math.random();
        let r, g, b;
        if (tint < 0.08) {
            r = baseBrightness;
            g = baseBrightness * 0.6;
            b = baseBrightness * 0.4;
        } else if (tint < 0.16) {
            r = baseBrightness;
            g = baseBrightness * 0.9;
            b = baseBrightness * 0.7;
        } else if (tint < 0.28) {
            r = baseBrightness * 0.7;
            g = baseBrightness * 0.85;
            b = baseBrightness;
        } else if (tint < 0.35) {
            r = baseBrightness * 0.8;
            g = baseBrightness * 0.8;
            b = baseBrightness;
        } else {
            r = baseBrightness;
            g = baseBrightness;
            b = baseBrightness;
        }
        
        starColors[i3] = r;
        starColors[i3 + 1] = g;
        starColors[i3 + 2] = b;
        starBaseColors[i3] = r;
        starBaseColors[i3 + 1] = g;
        starBaseColors[i3 + 2] = b;
        
        const sizeRand = Math.random();
        if (sizeRand < 0.02) {
            starSizes[i] = (isMobile ? 4.0 : 6.0) + Math.random() * 2;
        } else if (sizeRand < 0.1) {
            starSizes[i] = (isMobile ? 2.5 : 4.0) + Math.random() * 1.5;
        } else {
            starSizes[i] = Math.random() * (isMobile ? 2.0 : 3.0) + 0.5;
        }
    }

    const starsGeo = new THREE.BufferGeometry();
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starsGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    starsGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

    const starsMat = new THREE.PointsMaterial({
        size: isMobile ? 2.2 : 3.0,
        sizeAttenuation: true,
        vertexColors: true,
        opacity: 0.95,
        transparent: true,
        blending: THREE.AdditiveBlending
    });

    const starField = new THREE.Points(starsGeo, starsMat);
    scene.add(starField);

    let groundMat;
    const groundGeo = new THREE.PlaneGeometry(150, 150, 32, 32);
    groundMat = new THREE.MeshPhysicalMaterial({
        color: 0x0a0a15,
        metalness: 0.3,
        roughness: 0.7,
        transparent: true,
        opacity: 0.5,
        emissive: 0x111122,
        emissiveIntensity: 0.2
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = GROUND_LEVEL;
    if (!isMobile) ground.receiveShadow = true;
    scene.add(ground);

    const impactRingGeo = new THREE.RingGeometry(0.1, 1, 32);
    const impactRingMat = new THREE.MeshBasicMaterial({
        color: colors.energy,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    const impactRing = new THREE.Mesh(impactRingGeo, impactRingMat);
    impactRing.rotation.x = -Math.PI / 2;
    impactRing.position.y = GROUND_LEVEL + 0.05;
    scene.add(impactRing);

    let isMouseDown = false;
    let isTouching = false;
    let mouseForce = { x: 0, y: 0 };
    let cameraAutoRotate = true;
    let cameraAngle = 0;
    let energyLevel = 0;
    let keysPressed = {};
    let lastTouchTime = 0;
    let touchStartPos = {
        x: 0,
        y: 0
    };
    
    let isDraggingRing = false;
    let dragStartPos = { x: 0, y: 0 };
    let lastDragPos = { x: 0, y: 0 };
    let dragDelta = { x: 0, y: 0 };
    let userRotationSpeed = 1.0;
    let cameraDistance = isMobile ? 22 : 28;
    let targetCameraDistance = cameraDistance;
    let cameraVerticalAngle = 0.3;
    let targetCameraVerticalAngle = cameraVerticalAngle;
    let rightMouseDown = false;
    let middleMouseDown = false;

    const clock = new THREE.Clock();
    let time = 0;


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


        mouseForce.x = ((currentX - touchStartPos.x) / rect.width) * 0.03;
        mouseForce.y = ((currentY - touchStartPos.y) / rect.height) * -0.03;
    }, {
        passive: false
    });


    renderer.domElement.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    renderer.domElement.addEventListener('mousedown', (e) => {
        cameraAutoRotate = false;
        dragStartPos = { x: e.clientX, y: e.clientY };
        lastDragPos = { x: e.clientX, y: e.clientY };
        
        if (e.button === 0) {
            if (e.shiftKey) {
                isDraggingRing = true;
            } else {
                isMouseDown = true;
            }
        } else if (e.button === 2) {
            rightMouseDown = true;
        } else if (e.button === 1) {
            middleMouseDown = true;
            e.preventDefault();
        }
    });

    renderer.domElement.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            isMouseDown = false;
            isDraggingRing = false;
        } else if (e.button === 2) {
            rightMouseDown = false;
        } else if (e.button === 1) {
            middleMouseDown = false;
        }
        dragDelta = { x: 0, y: 0 };
        setTimeout(() => cameraAutoRotate = true, 3000);
    });

    renderer.domElement.addEventListener('mouseleave', () => {
        isMouseDown = false;
        isDraggingRing = false;
        rightMouseDown = false;
        middleMouseDown = false;
    });

    renderer.domElement.addEventListener('mousemove', (e) => {
        const deltaX = e.clientX - lastDragPos.x;
        const deltaY = e.clientY - lastDragPos.y;
        lastDragPos = { x: e.clientX, y: e.clientY };
        
        if (rightMouseDown) {
            cameraAngle += deltaX * 0.01;
            targetCameraVerticalAngle = Math.max(-0.5, Math.min(1.2, targetCameraVerticalAngle - deltaY * 0.005));
            return;
        }
        
        if (isDraggingRing) {
            angularVelocity.y += deltaX * 0.002;
            angularVelocity.x += deltaY * 0.002;
            return;
        }
        
        if (isMouseDown) {
            const rect = renderer.domElement.getBoundingClientRect();
            mouseForce.x = ((e.clientX - rect.left) / rect.width - 0.5) * 0.08;
            mouseForce.y = ((e.clientY - rect.top) / rect.height - 0.5) * -0.08;
        }
    });

    renderer.domElement.addEventListener('wheel', (e) => {
        e.preventDefault();
        targetCameraDistance = Math.max(10, Math.min(60, targetCameraDistance + e.deltaY * 0.03));
        cameraAutoRotate = false;
        setTimeout(() => cameraAutoRotate = true, 2000);
    }, { passive: false });

    renderer.domElement.addEventListener('click', (e) => {
        if (!isMobile && !isDraggingRing && Math.abs(e.clientX - dragStartPos.x) < 5 && Math.abs(e.clientY - dragStartPos.y) < 5) {
            handleSingleTap();
        }
    });

    renderer.domElement.addEventListener('dblclick', (e) => {
        if (!isMobile) {
            handleDoubleTap();
        }
    });

    function handleSingleTap() {
        const impulse = Math.min(isMobile ? 12 : 15, MAX_LAUNCH_VELOCITY * 0.7);
        ringVelocity.y += impulse;
        angularVelocity.x += (Math.random() - 0.5) * 0.3;
        angularVelocity.y += (Math.random() - 0.5) * 0.3;
        angularVelocity.z += (Math.random() - 0.5) * 0.15;
        energyLevel = Math.max(energyLevel, 50);
        launchFlash = 1.0;
        ringOnGround = false;

        energyLight.intensity = 8;
        setTimeout(() => { if (energyLevel < 30) energyLight.intensity = 0; }, 150);
    }

    function handleDoubleTap() {
        ringVelocity.y = Math.min(isMobile ? 20 : 25, MAX_LAUNCH_VELOCITY);
        angularVelocity.x = (Math.random() - 0.5) * 0.8;
        angularVelocity.y = (Math.random() - 0.5) * 0.8;
        angularVelocity.z = (Math.random() - 0.5) * 0.6;
        energyLevel = 100;
        launchFlash = 1.5;
        ringOnGround = false;
        
        for (let i = 0; i < trailCount; i++) {
            const angle = (i / trailCount) * Math.PI * 2;
            const radius = 4 + Math.random() * 2;
            trailParticlePositions[i * 3] = ringPosition.x + Math.cos(angle) * radius;
            trailParticlePositions[i * 3 + 1] = ringPosition.y;
            trailParticlePositions[i * 3 + 2] = ringPosition.z + Math.sin(angle) * radius;
            trailParticleData[i].life = 1.0;
            trailParticleData[i].maxLife = 1.0;
        }
        trailParticles.geometry.attributes.position.needsUpdate = true;
    }

    if (!isMobile) {
        window.addEventListener('keydown', (e) => {
            keysPressed[e.code] = true;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    if (ringOnGround) {
                        ringVelocity.y += 8;
                        energyLevel = Math.max(energyLevel, 30);
                        launchFlash = 0.5;
                        ringOnGround = false;
                    }
                    break;
                case 'KeyR':
                    resetRing();
                    break;
                case 'KeyW':
                case 'ArrowUp':
                    if (!ringOnGround) {
                        ringVelocity.z -= 0.5;
                    }
                    break;
                case 'KeyS':
                case 'ArrowDown':
                    if (!ringOnGround) {
                        ringVelocity.z += 0.5;
                    }
                    break;
                case 'KeyQ':
                    angularVelocity.y -= 0.1;
                    break;
                case 'KeyE':
                    angularVelocity.y += 0.1;
                    break;
                case 'Equal':
                case 'NumpadAdd':
                    userRotationSpeed = Math.min(3.0, userRotationSpeed + 0.2);
                    break;
                case 'Minus':
                case 'NumpadSubtract':
                    userRotationSpeed = Math.max(0.1, userRotationSpeed - 0.2);
                    break;
            }
        });

        window.addEventListener('keyup', (e) => {
            keysPressed[e.code] = false;
        });
    }

    function resetRing() {
        ringPosition = { x: 0, y: 10, z: 0 };
        ringVelocity = { x: 0, y: 0, z: 0 };
        angularVelocity = { x: 0, y: 0, z: 0 };
        ringOnGround = false;
        energyLevel = 0;
        impactIntensity = 0;
        launchFlash = 0;
        userRotationSpeed = 1.0;
        targetCameraDistance = isMobile ? 22 : 28;
        targetCameraVerticalAngle = 0.3;
    }

    function handleResize() {
        const width = container.clientWidth;
        const height = container.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);

        const wasMobile = isMobile;
        const nowMobile = window.innerWidth <= 768;
        if (wasMobile !== nowMobile) {
            location.reload();
        }
    }

    window.addEventListener('resize', handleResize);

    let frameCount = 0;
    let lastFPSCheck = performance.now();
    let lowFPSCount = 0;
    let trailSpawnTimer = 0;

    function animate() {
        requestAnimationFrame(animate);
        const deltaTime = Math.min(clock.getDelta(), 0.1);
        time += deltaTime;
        frameCount++;

        if (isMobile && frameCount % 60 === 0) {
            const now = performance.now();
            if (now - lastFPSCheck < 1200) {
                const fps = 60000 / (now - lastFPSCheck);
                if (fps < 25) {
                    lowFPSCount++;
                    if (lowFPSCount >= 2) {
                        particleMat.opacity *= 0.9;
                        nebulaMat.opacity *= 0.9;
                        lowFPSCount = 0;
                    }
                }
            }
            lastFPSCheck = now;
        }

        if (!isMobile) {
            if (keysPressed['ArrowLeft'] || keysPressed['KeyA']) {
                cameraAngle -= deltaTime * 2.5;
                cameraAutoRotate = false;
            }
            if (keysPressed['ArrowRight'] || keysPressed['KeyD']) {
                cameraAngle += deltaTime * 2.5;
                cameraAutoRotate = false;
            }
        }

        const newDarkMode = getCookie("darkMode") === "true";
        if (newDarkMode !== darkMode) {
            darkMode = newDarkMode;
            colors = darkMode ? colorSchemes.dark : colorSchemes.light;
            
            renderer.setClearColor(colors.bg, 1);
            scene.fog.color.setHex(colors.fog);
            
            mainRingMat.color.setHex(colors.ringPrimary);
            mainRingMat.emissive.setHex(colors.ringPrimary);
            innerGlowMat.color.setHex(colors.ringSecondary);
            outerGlowMat.color.setHex(colors.ringAccent);
            coreGlowMat.color.setHex(colors.energy);
            coreOuterGlowMat.color.setHex(colors.energy);
            coreHaloMat.color.setHex(colors.energy);
            energyLight.color.setHex(colors.energy);
            cosmicLight1.color.setHex(colors.nebula1);
            cosmicLight2.color.setHex(colors.nebula2);
            impactRingMat.color.setHex(colors.energy);
        }


        if ((isMouseDown || isTouching) && !ringOnGround) {
            ringVelocity.x += mouseForce.x * 1.2;
            ringVelocity.z += mouseForce.y * 1.2;
        }

        if (!ringOnGround) {
            ringVelocity.y += GRAVITY * deltaTime;
        }

        const distanceFromCenter = Math.sqrt(ringPosition.x * ringPosition.x + ringPosition.z * ringPosition.z);
        if (distanceFromCenter > MAX_HORIZONTAL_DISTANCE) {
            const returnForce = 0.03;
            ringVelocity.x -= (ringPosition.x / distanceFromCenter) * returnForce;
            ringVelocity.z -= (ringPosition.z / distanceFromCenter) * returnForce;
        }

        ringVelocity.x = Math.max(-MAX_LAUNCH_VELOCITY, Math.min(MAX_LAUNCH_VELOCITY, ringVelocity.x));
        ringVelocity.y = Math.max(-MAX_LAUNCH_VELOCITY * 1.5, Math.min(MAX_LAUNCH_VELOCITY * 1.5, ringVelocity.y));
        ringVelocity.z = Math.max(-MAX_LAUNCH_VELOCITY, Math.min(MAX_LAUNCH_VELOCITY, ringVelocity.z));

        const speed = Math.sqrt(ringVelocity.x ** 2 + ringVelocity.y ** 2 + ringVelocity.z ** 2);

        if (!ringOnGround) {
            ringPosition.x += ringVelocity.x * deltaTime * 10;
            ringPosition.y += ringVelocity.y * deltaTime * 10;
            ringPosition.z += ringVelocity.z * deltaTime * 10;

            ringVelocity.x *= 0.988;
            ringVelocity.z *= 0.988;
            
            trailSpawnTimer += deltaTime;
            if (trailSpawnTimer > 0.02 && speed > 2) {
                trailSpawnTimer = 0;
                for (let i = 0; i < trailCount; i++) {
                    if (trailParticleData[i].life <= 0) {
                        const offset = (Math.random() - 0.5) * 3;
                        trailParticlePositions[i * 3] = ringPosition.x + offset;
                        trailParticlePositions[i * 3 + 1] = ringPosition.y + (Math.random() - 0.5) * 2;
                        trailParticlePositions[i * 3 + 2] = ringPosition.z + offset;
                        trailParticleData[i].life = 0.8 + Math.random() * 0.4;
                        trailParticleData[i].maxLife = trailParticleData[i].life;
                        break;
                    }
                }
            }
        } else {
            ringVelocity.x *= VELOCITY_DAMPING_GROUND;
            ringVelocity.z *= VELOCITY_DAMPING_GROUND;
        }

        if (ringPosition.y <= GROUND_LEVEL + 0.35) {
            ringPosition.y = GROUND_LEVEL + 0.35;

            if (ringVelocity.y < 0) {
                const impactSpeed = Math.abs(ringVelocity.y);
                if (impactSpeed > MIN_BOUNCE_VELOCITY && !ringOnGround) {
                    ringVelocity.y *= -0.35;
                    impactIntensity = Math.min(1.0, impactSpeed / 15);
                    energyLevel = Math.max(energyLevel, impactIntensity * 40);
                    
                    impactRing.position.x = ringPosition.x;
                    impactRing.position.z = ringPosition.z;
                    impactRing.scale.set(0.5, 0.5, 0.5);
                    impactRingMat.opacity = impactIntensity * 0.8;
                } else {
                    ringVelocity.y = 0;
                    ringOnGround = true;
                }
            }
        }

        impactIntensity = Math.max(0, impactIntensity - deltaTime * 3);
        if (impactIntensity > 0) {
            const scale = 1 + (1 - impactIntensity) * 15;
            impactRing.scale.set(scale, scale, scale);
            impactRingMat.opacity = impactIntensity * 0.6;
        }

        launchFlash = Math.max(0, launchFlash - deltaTime * 4);

        angularVelocity.x *= 0.993;
        angularVelocity.y *= 0.993;
        angularVelocity.z *= 0.993;

        const rotSpeed = (baseRotationSpeed + speed * 0.002) * userRotationSpeed;
        ringGroup.rotation.x += (angularVelocity.x + rotSpeed) * deltaTime * 10;
        ringGroup.rotation.y += (angularVelocity.y + rotSpeed * 0.8) * deltaTime * 10;
        ringGroup.rotation.z += angularVelocity.z * deltaTime * 10;

        ringGroup.position.set(ringPosition.x, ringPosition.y, ringPosition.z);

        innerGlow.rotation.z = time * 0.5 * userRotationSpeed;
        outerGlow.rotation.z = -time * 0.3 * userRotationSpeed;

        energyLevel = Math.max(0, energyLevel - deltaTime * 12);
        const energyFactor = energyLevel / 100;
        const speedFactor = Math.min(1, speed / 20);
        const combinedEnergy = Math.max(energyFactor, speedFactor * 0.5, launchFlash * 0.8);

        const basePulse = 1 + Math.sin(time * 4) * 0.05;
        const energyPulse = basePulse + Math.sin(time * 8) * 0.08 * combinedEnergy;
        core.scale.setScalar(energyPulse);
        coreGlow.scale.setScalar(energyPulse * 1.6);
        coreOuterGlow.scale.setScalar(energyPulse * 1.8 + Math.sin(time * 3) * 0.1);
        coreHalo.scale.setScalar(1 + Math.sin(time * 2) * 0.15 + combinedEnergy * 0.3);
        
        coreGlowMat.opacity = 0.4 + combinedEnergy * 0.3 + Math.sin(time * 5) * 0.1;
        coreOuterGlowMat.opacity = 0.15 + combinedEnergy * 0.2;
        coreHaloMat.opacity = 0.05 + combinedEnergy * 0.08;

        mainRingMat.emissiveIntensity = 0.1 + combinedEnergy * 0.6 + launchFlash * 0.5;
        innerGlowMat.opacity = 0.4 + combinedEnergy * 0.4;
        outerGlowMat.opacity = 0.3 + combinedEnergy * 0.4;

        energyLight.intensity = combinedEnergy * 5 + launchFlash * 3;
        energyLight.position.set(ringPosition.x, ringPosition.y, ringPosition.z);

        cosmicLight1.position.x = -30 + Math.sin(time * 0.3) * 10;
        cosmicLight1.position.y = 20 + Math.sin(time * 0.2) * 5;
        cosmicLight2.position.x = 30 + Math.cos(time * 0.25) * 10;
        cosmicLight2.position.z = 25 + Math.sin(time * 0.35) * 8;

        const particleUpdateStep = isMobile ? 2 : 1;
        for (let i = 0; i < particleCount; i += particleUpdateStep) {
            const i3 = i * 3;

            particleVelocities[i3 + 1] += 0.002 * (1 + combinedEnergy);
            particlePositions[i3] += particleVelocities[i3];
            particlePositions[i3 + 1] += particleVelocities[i3 + 1];
            particlePositions[i3 + 2] += particleVelocities[i3 + 2];

            particleLife[i] -= deltaTime * 0.4;

            if (particleLife[i] <= 0 || particlePositions[i3 + 1] > ringPosition.y + 8) {
                const angle = Math.random() * Math.PI * 2;
                const radius = THREE.MathUtils.randFloat(3.0, 5.5);

                particlePositions[i3] = Math.cos(angle) * radius + ringPosition.x;
                particlePositions[i3 + 1] = ringPosition.y + (Math.random() - 0.5) * 2;
                particlePositions[i3 + 2] = Math.sin(angle) * radius + ringPosition.z;

                particleVelocities[i3] = (Math.random() - 0.5) * 0.03;
                particleVelocities[i3 + 1] = Math.random() * 0.04 + combinedEnergy * 0.08;
                particleVelocities[i3 + 2] = (Math.random() - 0.5) * 0.03;

                particleLife[i] = 0.8 + Math.random() * 0.4;
            }
        }
        particles.geometry.attributes.position.needsUpdate = true;
        particleMat.opacity = 0.6 + combinedEnergy * 0.3;

        for (let i = 0; i < trailCount; i++) {
            if (trailParticleData[i].life > 0) {
                trailParticleData[i].life -= deltaTime;
                const lifeRatio = trailParticleData[i].life / trailParticleData[i].maxLife;
                trailParticlePositions[i * 3 + 1] -= deltaTime * 0.5;
                
                const c = new THREE.Color(colors.trail);
                c.multiplyScalar(lifeRatio);
                trailParticleColors[i * 3] = c.r;
                trailParticleColors[i * 3 + 1] = c.g;
                trailParticleColors[i * 3 + 2] = c.b;
            }
        }
        trailParticles.geometry.attributes.position.needsUpdate = true;
        trailParticles.geometry.attributes.color.needsUpdate = true;
        trailMat.opacity = 0.5 + combinedEnergy * 0.3;

        if (!isMobile || frameCount % 3 === 0) {
            for (let i = 0; i < nebulaCount; i++) {
                const data = nebulaData[i];
                nebulaPositions[i * 3] += Math.sin(time * 0.1 + data.phase) * 0.02;
                nebulaPositions[i * 3 + 1] += Math.cos(time * 0.08 + data.phase) * 0.01;
            }
            nebula.geometry.attributes.position.needsUpdate = true;
        }
        nebula.rotation.y = time * 0.01;
        nebula.rotation.x = Math.sin(time * 0.05) * 0.1;

        if ((!isMobile && frameCount % 3 === 0) || (isMobile && frameCount % 10 === 0)) {
            const twinkleUpdateCount = isMobile ? Math.floor(starCount / 25) : Math.floor(starCount / 10);
            for (let i = 0; i < twinkleUpdateCount; i++) {
                const idx = (frameCount * 7 + i * 13) % starCount;
                const twinkle = 0.7 + 0.3 * Math.sin(time * starTwinkleSpeeds[idx] + starTwinklePhases[idx]);
                const i3 = idx * 3;
                starColors[i3] = starBaseColors[i3] * twinkle;
                starColors[i3 + 1] = starBaseColors[i3 + 1] * twinkle;
                starColors[i3 + 2] = starBaseColors[i3 + 2] * twinkle;
            }
            starsGeo.attributes.color.needsUpdate = true;
        }

        starField.rotation.y = time * 0.002;
        starField.rotation.x = time * 0.0008;

        cameraDistance += (targetCameraDistance - cameraDistance) * 0.05;
        cameraVerticalAngle += (targetCameraVerticalAngle - cameraVerticalAngle) * 0.05;

        if (cameraAutoRotate) {
            cameraAngle += deltaTime * (isMobile ? 0.04 : 0.06);
        }

        const camRadius = cameraDistance + Math.sin(time * 0.3) * (isMobile ? 2 : 3);
        const baseHeight = 8 + Math.sin(time * 0.2) * 2;
        const camHeight = baseHeight + cameraVerticalAngle * 15 + (ringPosition.y - 10) * 0.25;
        camera.position.x = Math.cos(cameraAngle) * camRadius + ringPosition.x * 0.3;
        camera.position.z = Math.sin(cameraAngle) * camRadius + (isMobile ? 5 : 8) + ringPosition.z * 0.3;
        camera.position.y = camHeight;

        camera.lookAt(ringGroup.position);

        renderer.render(scene, camera);
    }

    animate();

    const instructions = document.createElement('div');
    const instructionStyle = `
        position: absolute;
        ${isMobile ? 'bottom: 12px; left: 12px; right: 12px;' : 'bottom: 20px; left: 20px;'}
        background: linear-gradient(135deg, rgba(0,15,40,0.92) 0%, rgba(0,5,20,0.95) 100%);
        color: #e0e8ff;
        padding: ${isMobile ? '10px 14px' : '16px 22px'};
        border-radius: 14px;
        font-family: 'Segoe UI', system-ui, sans-serif;
        font-size: ${isMobile ? '11px' : '12px'};
        pointer-events: none;
        z-index: 1000;
        border: 1px solid rgba(0,200,255,0.25);
        box-shadow: 0 8px 32px rgba(0,100,200,0.3), inset 0 1px 0 rgba(255,255,255,0.1);
        backdrop-filter: blur(12px);
        max-width: ${isMobile ? 'auto' : '340px'};
    `;

    instructions.style.cssText = instructionStyle;

    instructions.innerHTML = isMobile ? `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="font-size: 20px;">🌌</span>
            <strong style="color: #00ccff; font-size: 13px; letter-spacing: 1px;">COSMIC RING</strong>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px; font-size: 10px; opacity: 0.9;">
            <span style="color: #ff66aa;">👆 Tap to launch</span>
            <span style="color: #ffaa44;">👆👆 Double-tap superjump</span>
            <span style="color: #66ffaa;">↕️ Drag for force</span>
        </div>
    ` : `
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px;">
            <span style="font-size: 28px;">🌌</span>
            <div>
                <strong style="color: #00ccff; font-size: 15px; letter-spacing: 1.5px;">COSMIC PHYSICS RING</strong>
                <div style="font-size: 10px; color: #8899bb; margin-top: 2px;">Interactive 3D Simulation</div>
            </div>
        </div>
        <div style="display: grid; gap: 4px; font-size: 11px; opacity: 0.95;">
            <div><span style="color: #ff66aa;">🖱️ Click</span> Launch ring upward</div>
            <div><span style="color: #ffaa44;">🖱️🖱️ Double-click</span> Super launch</div>
            <div><span style="color: #66ffaa;">↔️ Left-drag</span> Apply force in flight</div>
            <div><span style="color: #88ddff;">🖱️ Right-drag</span> Rotate camera view</div>
            <div><span style="color: #ddaaff;">⇧+Drag</span> Rotate ring manually</div>
            <div><span style="color: #aaddcc;">🖲️ Scroll</span> Zoom in/out</div>
            <div><span style="color: #88aaff;">⌨️ A/D</span> Rotate camera</div>
            <div><span style="color: #ffcc88;">⌨️ Q/E</span> Spin ring left/right</div>
            <div><span style="color: #aabbcc;">⌨️ +/-</span> Speed up/down</div>
            <div><span style="color: #ff8888;">⌨️ R</span> Reset all</div>
        </div>
    `;

    container.appendChild(instructions);

    if (isMobile) {
        const resetButton = document.createElement('button');
        resetButton.style.cssText = `
            position: absolute;
            top: 12px;
            right: 12px;
            background: linear-gradient(135deg, rgba(0,180,255,0.9) 0%, rgba(0,100,200,0.9) 100%);
            color: white;
            border: none;
            border-radius: 10px;
            padding: 10px 16px;
            font-size: 12px;
            font-weight: bold;
            z-index: 1001;
            touch-action: manipulation;
            box-shadow: 0 4px 15px rgba(0,150,255,0.4);
            letter-spacing: 1px;
        `;
        resetButton.textContent = '↻ RESET';
        resetButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            resetRing();
        });
        container.appendChild(resetButton);
    }
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