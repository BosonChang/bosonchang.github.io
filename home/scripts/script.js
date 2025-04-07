import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.setZ(15);

const renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 20, 20);
scene.add(directionalLight);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let isCrystalHovered = false;

let rotationVelocity = 0;
const rotationDamping = 0.95;

let isDragging = false;
let previousMouseX = 0;
let previousMouseY = 0;
const dragSpeed = 0.005;

let clickStartTime = 0;
let clickStartX = 0;
let clickStartY = 0;

const modelsPath = '/home/3d-models/';
const crystal = new THREE.Group();
crystal.position.y = 5;
scene.add(crystal);

const dragRotationGroup = new THREE.Group();
crystal.add(dragRotationGroup);

const textureLoader = new THREE.TextureLoader();
textureLoader.load('/home/bg-img/hand.jpg', function (texture) {
    scene.background = texture;
});

const loader = new OBJLoader();

function loadModels() {
    loader.load(modelsPath + 'Inner Crystal.obj', (object) => {
        object.traverse((child) => {
            if (child.isMesh) {
                child.material = new THREE.MeshStandardMaterial({
                    color: 0x8000ff,
                    emissive: 0x400080,
                    emissiveIntensity: 1,
                    metalness: 0.2,
                    roughness: 0.4
                });
            }
        });
        dragRotationGroup.add(object);
    });

    loader.load(modelsPath + 'Outer Crystal.obj', (object2) => {
        object2.traverse((child) => {
            if (child.isMesh) {
                child.material = new THREE.MeshStandardMaterial({
                    color: 0x000000
                });
            }
        });
        dragRotationGroup.add(object2);
    });
}

// === Scroll Blocking Handlers ===
function preventScroll(e) {
    e.preventDefault();
}

// Disable scroll initially
document.body.style.overflow = 'hidden';
window.addEventListener('wheel', preventScroll);
window.addEventListener('touchmove', preventScroll);
window.addEventListener('keydown', (e) => {
    const keys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', ' '];
    if (keys.includes(e.key)) {
        e.preventDefault();
    }
});

window.addEventListener('mousedown', (event) => {
    previousMouseX = event.clientX;
    previousMouseY = event.clientY;

    clickStartTime = Date.now();
    clickStartX = event.clientX;
    clickStartY = event.clientY;

    const clickMouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(clickMouse, camera);
    const intersects = raycaster.intersectObjects(dragRotationGroup.children, true);

    if (intersects.length > 0) {
        isDragging = true;
    } else {
        isDragging = false;
        shakeTime = shakeDuration;
    }
});

window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    if (!isDragging) return;

    const deltaX = event.clientX - previousMouseX;
    const deltaY = event.clientY - previousMouseY;

    dragRotationGroup.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), deltaX * dragSpeed);
    dragRotationGroup.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), deltaY * dragSpeed);

    previousMouseX = event.clientX;
    previousMouseY = event.clientY;
});

window.addEventListener('mouseup', (event) => {
    const timeDiff = Date.now() - clickStartTime;
    const distanceMoved = Math.hypot(event.clientX - clickStartX, event.clientY - clickStartY);

    isDragging = false;

    if (timeDiff < 300 && distanceMoved < 5) {
        const clickMouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );
        raycaster.setFromCamera(clickMouse, camera);
        const intersects = raycaster.intersectObjects(dragRotationGroup.children, true);

        if (intersects.length > 0) {
            scrollToSection();
        }
    }
});

window.addEventListener('wheel', (event) => {
    const delta = event.deltaY;
    rotationVelocity += -delta * 0.0003;
    rotationVelocity = THREE.MathUtils.clamp(rotationVelocity, -0.2, 0.2);
});

let targetScale = 1;

let shakeTime = 0;
const shakeDuration = 0.4;
const shakeIntensity = 1;
const cameraOriginalPosition = camera.position.clone();

function animate() {
    requestAnimationFrame(animate);

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(dragRotationGroup.children, true);

    if (intersects.length > 0) {
        isCrystalHovered = true;
        targetScale = 1.3;
    } else {
        isCrystalHovered = false;
        targetScale = 1;
    }

    const currentScale = crystal.scale.x;
    const lerpedScale = THREE.MathUtils.lerp(currentScale, targetScale, 0.1);
    crystal.scale.set(lerpedScale, lerpedScale, lerpedScale);

    if (!isDragging) {
        crystal.rotation.y += 0.01;
        crystal.rotation.y += rotationVelocity;
        rotationVelocity *= rotationDamping;
    }

    if (!isDragging) {
        dragRotationGroup.quaternion.slerp(new THREE.Quaternion(), 0.05);
    }

    if (shakeTime > 0) {
        shakeTime -= 0.016;
        const shakeX = (Math.random() - 0.5) * shakeIntensity;
        const shakeY = (Math.random() - 0.5) * shakeIntensity;
        const shakeZ = (Math.random() - 0.5) * shakeIntensity;
        camera.position.set(
            cameraOriginalPosition.x + shakeX,
            cameraOriginalPosition.y + shakeY,
            cameraOriginalPosition.z + shakeZ
        );
    } else {
        camera.position.copy(cameraOriginalPosition);
    }

    renderer.render(scene, camera);
}

function scrollToSection() {
    const target = document.getElementById("crystal-target");
    if (target) {
        // Offset for fixed navbar
        const navbar = document.querySelector('.navbar'); // Replace with your actual selector
        const offset = navbar ? navbar.offsetHeight : 60;

        const top = target.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({
            top: top - offset,
            behavior: "smooth"
        });

        // Re-enable scroll
        document.body.style.overflow = 'auto';
        window.removeEventListener('wheel', preventScroll);
        window.removeEventListener('touchmove', preventScroll);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const bg = document.getElementById('bg');
    if (bg) {
        bg.appendChild(renderer.domElement);
        loadModels();
        animate();
    } else {
        console.error('Element #bg not found');
    }
});
