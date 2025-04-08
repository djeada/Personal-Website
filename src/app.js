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
    "database_notes": "https://github.com/djeada/Databases-Notes",
    "git_notes": "https://github.com/djeada/Git-Notes",
    "linux_notes": "https://github.com/djeada/Linux-Notes",
    "numpy_tutorials": "https://github.com/djeada/Numpy-Tutorials",
    "parallel_and_concurrent_programming": "https://github.com/djeada/Parallel-And-Concurrent-Programming",
    "statistics_notes": "https://github.com/djeada/Statistics-Notes",
    "kurs_podstaw_pythona": "https://github.com/djeada/Kurs-Podstaw-Pythona",
    "od_c_do_cpp": "https://github.com/djeada/Od-C-do-Cpp",

};

// Mapping of section keys to additional path prepends within the repo.
// For example, if the algorithms repository has its files under a "notes" folder.
const PATH_PREPENDS = {
    "algorithms_and_data_structures": "notes",
    "frontend_notes": "notes",
    "numerical_methods": "notes",
        "database_notes": "notes",
    "git_notes": "notes",
    "linux_notes": "notes",
    "numpy_tutorials": "notes",
    "parallel_and_concurrent_programming": "notes",
    "statistics_notes": "notes",
    "kurs_podstaw_pythona": "notatki",
    "od_c_do_cpp": "notatki",

};

/**
 * Returns an object containing:
 *  - baseRepoUrl: the GitHub repository base URL found using the section key.
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

    // Replace the file extension: change .html to .md.
    filePathInRepo = filePathInRepo.replace(/\.html$/, ".md");

    return {
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
        baseRepoUrl,
        filePathInRepo
    } = result;
    // Constructs the URL to edit the file (assumes branch "master").
    const editUrl = `${baseRepoUrl}/edit/master/${filePathInRepo}`;
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


// ------------------
// PDF Download Logic
// ------------------
function handleDownloadClick() {
    const article = document.getElementById('article-body');
    if (!article) return;

    const spinner = document.getElementById('pdf-spinner-overlay');
    if (spinner) spinner.style.display = 'flex';

    // Clone and modify the article content
    const cloned = article.cloneNode(true);

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

    // Generate and download the PDF, then remove the hidden container and hide the spinner
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


// ---------------------
// Three.js Integration
// ---------------------
function initializeThreeJS() {
    let scene, camera, torus;
    let rotationSpeedX = 0.01,
        rotationSpeedY = 0.01;
    const fasterSpeed = 0.05;

    let verticalVelocity = 0;
    const gravity = -0.05;
    const jumpVelocity = 1;

    // Container element
    const container = document.getElementById('threejs-container');

    // Scene setup
    scene = new THREE.Scene();

    // Camera
    const aspectRatio = container.offsetWidth / container.offsetHeight;
    camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    camera.position.z = 10;

    // Renderer setup
    renderer = new THREE.WebGLRenderer({
        antialias: true
    });
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    renderer.setClearColor(new THREE.Color(getColorForMode('white', '#0D1117')));
    container.appendChild(renderer.domElement);

    // Torus geometry
    const torusGeometry = new THREE.TorusGeometry(1, 0.4, 16, 100);
    const torusMaterial = new THREE.MeshBasicMaterial({
        color: '#FFD700'
    });
    torus = new THREE.Mesh(torusGeometry, torusMaterial);
    scene.add(torus);

    // Double click event
    renderer.domElement.addEventListener('dblclick', () => {
        verticalVelocity = jumpVelocity;
        camera.position.z += 5;
    });

    // Animation loop
    const animate = () => {
        requestAnimationFrame(animate);

        // Vertical movement and gravity
        torus.position.y += verticalVelocity;
        verticalVelocity += gravity;
        if (torus.position.y < 0) {
            torus.position.y = 0;
            verticalVelocity = 0;
        }
        if (camera.position.z > 10) {
            camera.position.z -= 0.05;
        }

        // Rotation
        torus.rotation.x += rotationSpeedX;
        torus.rotation.y += rotationSpeedY;

        renderer.render(scene, camera);
    };
    animate();

    // Click to speed up rotation briefly
    renderer.domElement.addEventListener('click', () => {
        rotationSpeedX = fasterSpeed;
        rotationSpeedY = fasterSpeed;
        setTimeout(() => {
            rotationSpeedX = 0.01;
            rotationSpeedY = 0.01;
        }, 1000);
    });

    // Responsive canvas
    window.addEventListener('resize', () => {
        const newWidth = container.offsetWidth;
        const newHeight = container.offsetHeight;
        renderer.setSize(newWidth, newHeight);
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
    });
}

function updateThreeJSBackground() {
    if (renderer) {
        const backgroundColor = new THREE.Color(getColorForMode('white', '#0D1117'));
        renderer.setClearColor(backgroundColor);
    }
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
        updateThreeJSBackground();
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