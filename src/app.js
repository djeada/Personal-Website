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

};

// Mapping of section keys to additional path prepends within the repo.
const PATH_PREPENDS = {
    "algorithms_and_data_structures": "notes",
    "frontend_notes": "notes",
    "numerical_methods": "notes",
    "databases_notes": "notes",
    "git_notes": "notes",
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
    let bgColor = darkMode ? 0x0a0a12 : 0xf0f0f0;
    let fogColor = bgColor;
    let ringColor = darkMode ? 0x3a5f79 : 0x336699;
    let starColor = darkMode ? 0xdddddd : 0x444444;

    // Scene, camera, fog, renderer (unchanged)…
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(fogColor, 0.003);
    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 4, 20);
    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.setClearColor(bgColor, 1);
    container.appendChild(renderer.domElement);

    // Lights (unchanged)…
    const ambient = new THREE.AmbientLight(darkMode ? 0x444444 : 0xaaaaaa, 1.2);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);
    const flameLight = new THREE.PointLight(0xff3300, 4.0, 80, 2);
    flameLight.position.set(-2, 6, 0);
    scene.add(flameLight);

    // Ring (unchanged)…
    const ringGeo = new THREE.TorusGeometry(3, 0.5, 64, 200);
    // …vertex-color crack setup as before…
    const colors = [];
    for (let i = 0; i < ringGeo.attributes.position.count; i++) {
        const isCrack = Math.random() < 0.12;
        colors.push(
            isCrack ? 1 : ((ringColor >> 16) & 0xff) / 255,
            isCrack ? 0.2 : ((ringColor >> 8) & 0xff) / 255,
            isCrack ? 0 : ((ringColor) & 0xff) / 255
        );
    }
    ringGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const ringMat = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        emissive: 0xff3300,
        emissiveIntensity: 1.2,
        metalness: 0.7,
        roughness: 0.5,
        transmission: 0.1,
        clearcoat: 0.3
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.castShadow = ring.receiveShadow = true;
    ring.position.set(0, 5, 0);
    scene.add(ring);

    // ── Fiery pool hugging the ring’s underside ──
    const emberCount = 800;
    const emberPos = new Float32Array(emberCount * 3);
    for (let i = 0; i < emberCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        // around the *outer* radius of the torus (≈3), not its hole
        const radius = THREE.MathUtils.randFloat(2.8, 3.2);
        emberPos[i * 3] = Math.cos(angle) * radius;
        // place *below* the ring’s bottom (ring.y=5, half-thickness=0.5 → bottom=4.5)
        emberPos[i * 3 + 1] = THREE.MathUtils.randFloat(3.5, 4.3);
        emberPos[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const emberGeo = new THREE.BufferGeometry();
    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
    const emberMat = new THREE.PointsMaterial({
        size: 0.8,
        sizeAttenuation: false,
        color: 0xff6600,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const embers = new THREE.Points(emberGeo, emberMat);
    scene.add(embers);


    // Starfield (unchanged)…
    const starCount = 4000;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        starPos[i * 3] = (Math.random() - 0.5) * 800;
        starPos[i * 3 + 1] = (Math.random() - 0.5) * 800;
        starPos[i * 3 + 2] = (Math.random() - 0.5) * 800;
    }
    const starsGeo = new THREE.BufferGeometry();
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starsMat = new THREE.PointsMaterial({
        size: 2.5,
        sizeAttenuation: false,
        color: starColor,
        opacity: 0.7,
        transparent: true
    });
    const starField = new THREE.Points(starsGeo, starsMat);
    scene.add(starField);

    // Interaction & animation (unchanged, aside from ember motion):
    let rotationSpeed = 0.02;
    let verticalVelocity = 0,
        gravity = -0.03,
        jumpVelocity = 1;
    const clock = new THREE.Clock();

    renderer.domElement.addEventListener('click', () => {
        rotationSpeed = 0.1;
        setTimeout(() => rotationSpeed = 0.02, 600);
    });
    renderer.domElement.addEventListener('dblclick', () => {
        verticalVelocity = jumpVelocity;
    });
    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });

    function animate() {
        requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        // Palette switch + flame flicker (unchanged)…
        const newDM = getCookie("darkMode") === "true";
        if (newDM !== darkMode) {
            darkMode = newDM;
            bgColor = darkMode ? 0x0a0a12 : 0xf0f0f0;
            fogColor = bgColor;
            ringColor = darkMode ? 0x3a5f79 : 0x336699;
            starColor = darkMode ? 0xdddddd : 0x444444;
            renderer.setClearColor(bgColor, 1);
            scene.fog.color.setHex(fogColor);
            ambient.color.setHex(darkMode ? 0x444444 : 0xaaaaaa);
            flameLight.color.setHex(darkMode ? 0xff2200 : 0xff3300);
            ring.material.color.setHex(ringColor);
            starsMat.color.setHex(starColor);
        }
        flameLight.intensity = 4.0 * (1 + 0.4 * Math.sin(t * 25 + Math.random() * 0.3));

        // Ring physics/wobble/hue (unchanged)…
        ring.position.y += verticalVelocity;
        verticalVelocity += gravity;
        if (ring.position.y < 5) {
            ring.position.y = 5;
            verticalVelocity = 0;
        }
        ring.rotation.x += rotationSpeed;
        ring.rotation.y += rotationSpeed * 0.8;
        const wob = 1 + 0.05 * Math.sin(t * 3);
        ring.scale.set(wob, wob, wob);
        ring.material.color.setHSL((t * 0.08) % 1, 0.7, 0.5);

        // Ember “fire” rising from below
        const epos = embers.geometry.attributes.position.array;
        for (let i = 0; i < emberCount; i++) {
            epos[i * 3 + 1] += 0.03 + 0.015 * Math.sin(t * 20 + i);
            // once they fly too high, respawn just under the ring
            if (epos[i * 3 + 1] > 6) {
                epos[i * 3 + 1] = THREE.MathUtils.randFloat(3.5, 4.3);
            }
        }
        embers.geometry.attributes.position.needsUpdate = true;

        // Stars twinkle (unchanged)…
        starField.material.opacity = 0.7 + 0.2 * Math.sin(t * 0.2);

        // Camera orbit & bob (unchanged)…
        const radius = 20;
        camera.position.x = Math.cos(t * 0.03) * radius;
        camera.position.z = Math.sin(t * 0.03) * radius + 5;
        camera.position.y = 4 + Math.sin(t * 0.6) * 1.5;
        camera.lookAt(ring.position);

        renderer.render(scene, camera);
    }
    animate();
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
}

// Run `main` after DOM is ready
document.addEventListener("DOMContentLoaded", main);