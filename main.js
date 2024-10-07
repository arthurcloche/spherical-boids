import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Boid, behaviors, getRandomPointOnUnitSphere } from "./Boids.js";

//boids
let boids = [];
let curr = 0;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.01,
  1000
);
camera.position.z = 300;

const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const radius = 80;

const geometry = new THREE.SphereGeometry(radius * 0.95, 32, 32);
const material = new THREE.MeshStandardMaterial({
  // color: "yellow",
  emissive: "#588157",
  roughness: 1,
});

const sphere = new THREE.Mesh(geometry, material);
scene.add(sphere);

const light = new THREE.PointLight(0xffffff);
light.position.set(10, 100, -100);
camera.add(light);
scene.add(camera);

const controls = new OrbitControls(camera, renderer.domElement);

const count = 100;
boids = [];

for (let i = 0; i < count; i++) {
  const color = i === 0 ? "#dda15e" : "#a3b18a";
  const pos = getRandomPointOnUnitSphere().setLength(radius);
  const vel = null;
  const b = new Boid(radius, color, pos, vel);
  boids.push(b);
  scene.add(b.object3D);
}

boids[0].maxSpeed *= 1.2;

// Add resize event listener
window.addEventListener("resize", onWindowResize, false);

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  update();
  draw();
}

function update() {
  if (controls) controls.update();

  const b0 = boids[0];
  b0.wander();
  b0.update();

  for (let i = 1; i < boids.length; i++) {
    const b = boids[i];

    switch (behaviors[curr]) {
      default:
      case "wander": {
        b.wander();
        break;
      }
      case "seek": {
        b.seek(b0.position);
        b.wander({ intensity: 0.8 });
        break;
      }
      case "flee": {
        b.flee(b0.position);
        b.wander({ intensity: 0.8 });
        break;
      }
      case "arrive": {
        b.arrive(b0.position);
        b.wander({ angle: 0.1, intensity: 0.05 });
        break;
      }
      case "seek-sequence": {
        b.seek(boids[i - 1].position);
        break;
      }
      // case "WASD": {
      //   b.arrive(b0.position);
      //   break;
      // }
    }

    b.update();
  }
}

function makeUI() {
  const uiContainer = document.querySelector(".ui");
  const label = document.querySelector("label");
  const select = document.createElement("select");

  behaviors.forEach((behavior, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = behavior;
    select.appendChild(option);
  });

  uiContainer.replaceChild(select, document.querySelector("button"));

  select.addEventListener("change", (event) => {
    curr = parseInt(event.target.value);
  });
}

function draw() {
  renderer.render(scene, camera);
}
makeUI();
animate();
