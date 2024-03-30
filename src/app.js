let renderer; // Make renderer globally accessible

// Utility Functions
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

// Ripple Effect for Menu Click
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
        "top:" + (String(y) + ("px; left:" + (String(x) + "px;")))
    );
    dom.appendChild(rippleDiv);
    setTimeout(function() {
        dom.removeChild(rippleDiv);
        return /* () */ 0;
    }, 900);
    return /* () */ 0;
}

// Dark Mode and Logo Handling
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

// Main Function
function main() {
    const darkModeButton = document.getElementById("dark-mode-button");

    darkModeButton.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
        setCookie("darkMode", document.body.classList.contains("dark-mode"), 365, "Lax");
        checkLogo();
        updateThreeJSBackground(); // Update Three.js background color

    });

    if (getCookie("darkMode") === "true") {
        document.body.classList.add("dark-mode");
    }

    checkLogo();

    // Initialize Three.js if the container is present
    if (document.getElementById('threejs-container')) {
        initializeThreeJS();
    }
}

function initializeThreeJS() {
    let scene, camera, torus;
    let rotationSpeedX = 0.01,
        rotationSpeedY = 0.01;
    const fasterSpeed = 0.05;

    let verticalVelocity = 0;
    const gravity = -0.05;
    const jumpVelocity = 1;


    // Get the container element
    const container = document.getElementById('threejs-container');

    // Scene setup
    scene = new THREE.Scene();

    // Camera setup
    const aspectRatio = container.offsetWidth / container.offsetHeight;
    camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    camera.position.z = 10; // Adjust as needed

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
    }); // Dark gold color
    torus = new THREE.Mesh(torusGeometry, torusMaterial);
    scene.add(torus);

    // Double click event to move torus up
    renderer.domElement.addEventListener('dblclick', () => {
        verticalVelocity = jumpVelocity;
        camera.position.z += 5; // Zoom out when double clicked
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
    // Click event to speed up rotation
    renderer.domElement.addEventListener('click', () => {
        rotationSpeedX = fasterSpeed;
        rotationSpeedY = fasterSpeed;

        setTimeout(() => {
            rotationSpeedX = 0.01;
            rotationSpeedY = 0.01;
        }, 1000); // Reset speed after 1000 milliseconds (1 second)
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
// Run the main function when the document is loaded
document.addEventListener("DOMContentLoaded", main);