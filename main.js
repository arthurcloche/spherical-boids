import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Boid, behaviors, getRandomPointOnUnitSphere } from "./Boids.js";
import { MeshSurfaceConstraint } from "./Surface.js";

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

// Geometry options with metadata
const geometries = {
  "Torus Knot (2,3)": {
    create: () =>
      new THREE.TorusKnotGeometry(radius * 0.6, radius * 0.18, 300, 48, 2, 3),
    smooth: true,
  },
  "Torus Knot (3,2)": {
    create: () =>
      new THREE.TorusKnotGeometry(radius * 0.6, radius * 0.15, 300, 48, 3, 2),
    smooth: true,
  },
  "Torus Knot (5,3)": {
    create: () =>
      new THREE.TorusKnotGeometry(radius * 0.6, radius * 0.12, 300, 48, 5, 3),
    smooth: true,
  },
  Sphere: {
    create: () => new THREE.SphereGeometry(radius, 64, 32),
    smooth: true,
  },
  Torus: {
    create: () => new THREE.TorusGeometry(radius * 0.7, radius * 0.3, 32, 64),
    smooth: true,
  },
  Icosahedron: {
    create: () => new THREE.IcosahedronGeometry(radius, 3),
    smooth: true,
  },
  Octahedron: {
    create: () => new THREE.OctahedronGeometry(radius, 3),
    smooth: true,
  },
  Dodecahedron: {
    create: () => new THREE.DodecahedronGeometry(radius, 2),
    smooth: true,
  },
  "Smooth Cube": {
    create: () => {
      // Create a subdivided icosahedron and scale it to be cube-like
      const geo = new THREE.IcosahedronGeometry(radius, 2);
      // Scale to make it more cube-like
      geo.scale(1.0, 0.9, 0.9);
      return geo;
    },
    smooth: true,
  },
  "Rounded Cylinder": {
    create: () => {
      // Create a capsule-like shape
      const geo = new THREE.CapsuleGeometry(radius * 0.5, radius * 0.8, 20, 32);
      return geo;
    },
    smooth: true,
  },
  Ellipsoid: {
    create: () => {
      const geo = new THREE.SphereGeometry(radius, 32, 16);
      geo.scale(1.0, 0.7, 1.3);
      return geo;
    },
    smooth: true,
  },
};

let currentGeometry = "Torus Knot (2,3)";
let geometry = geometries[currentGeometry].create();
const material = new THREE.MeshStandardMaterial({
  emissive: "#588157",
  roughness: 1,
});

let surfaceMesh = new THREE.Mesh(geometry, material);
geometry.computeBoundingSphere();
surfaceMesh.castShadow = false;
surfaceMesh.receiveShadow = false;
scene.add(surfaceMesh);

// Build surface constraint for boids
let surface = new MeshSurfaceConstraint(surfaceMesh);

function samplePointOnMesh(mesh) {
  // BVH-accelerated raycasting is enabled globally in Surface.js
  const raycaster = new THREE.Raycaster();
  const R = mesh.geometry.boundingSphere?.radius || radius;
  for (let i = 0; i < 30; i++) {
    const dir = getRandomPointOnUnitSphere();
    const origin = dir.clone().multiplyScalar(R * 3);
    raycaster.ray.origin.copy(origin);
    raycaster.ray.direction.copy(dir).multiplyScalar(-1).normalize();
    const hits = raycaster.intersectObject(mesh, false);
    if (hits && hits.length) return hits[0].point.clone();
  }
  return null;
}

const light = new THREE.PointLight(0xffffff);
light.position.set(10, 100, -100);
camera.add(light);
scene.add(camera);

const controls = new OrbitControls(camera, renderer.domElement);

// Function to switch geometry
function switchGeometry(geometryName) {
  // Remove old mesh and surface
  scene.remove(surfaceMesh);
  if (surface) surface.dispose();

  // Remove old boids
  for (let boid of boids) {
    scene.remove(boid.object3D);
  }

  // Create new geometry
  currentGeometry = geometryName;
  const geoConfig = geometries[currentGeometry];
  geometry = geoConfig.create();
  geometry.computeBoundingSphere();

  surfaceMesh = new THREE.Mesh(geometry, material);
  surfaceMesh.castShadow = false;
  surfaceMesh.receiveShadow = false;
  scene.add(surfaceMesh);

  // Create new surface constraint
  surface = new MeshSurfaceConstraint(surfaceMesh);

  // Recreate boids
  createBoids();

  // Update info display
  updateInfo();
}

function createBoids() {
  boids = [];
  const count = 100;

  for (let i = 0; i < count; i++) {
    const color = i === 0 ? "#dda15e" : "#a3b18a";

    // Try multiple times to get a valid surface point
    let hit = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const sampled = samplePointOnMesh(surfaceMesh);
      if (sampled) {
        const normal = surface.normalAt(sampled);
        hit = { point: sampled, normal: normal };
        break;
      }
      // Fallback: try projecting from random point
      const posGuess = getRandomPointOnUnitSphere().setLength(
        radius * (0.5 + Math.random())
      );
      hit = surface.projectPoint(posGuess, null, 500);
      if (hit) break;
    }

    if (!hit) {
      console.warn(`Failed to find surface for boid ${i}, skipping`);
      continue;
    }

    // Add offset from surface for gliding
    const surfaceOffset = 3.0;
    const pos = hit.point
      .clone()
      .addScaledVector(hit.normal.normalize(), surfaceOffset);

    // Initialize with small random tangent velocity
    const tangentVel = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5
    );
    // Remove normal component to keep velocity tangent to surface
    const normalComponent = tangentVel.dot(hit.normal) / hit.normal.lengthSq();
    tangentVel.addScaledVector(hit.normal, -normalComponent);
    tangentVel.multiplyScalar(0.1); // Start with small velocity

    const b = new Boid(radius, color, pos, tangentVel, surface);
    b.up = hit.normal.clone();
    boids.push(b);
    scene.add(b.object3D);
  }

  if (boids.length > 0) {
    boids[0].maxSpeed *= 1.2;
    boids[0].maxSteer *= 1.5;
  }
}

// Initialize boids
createBoids();

// Add resize event listener
window.addEventListener("resize", onWindowResize, false);

// Create info display
const infoDiv = document.createElement("div");
infoDiv.style.position = "absolute";
infoDiv.style.top = "10px";
infoDiv.style.left = "10px";
infoDiv.style.color = "white";
infoDiv.style.fontFamily = "monospace";
infoDiv.style.fontSize = "14px";
infoDiv.style.backgroundColor = "rgba(0,0,0,0.5)";
infoDiv.style.padding = "10px";
infoDiv.style.borderRadius = "5px";
infoDiv.innerHTML = `
  <div>Geometry: ${currentGeometry}</div>
  <div>Behavior: ${behaviors[curr]}</div>
  <div style="margin-top: 10px;">Controls:</div>
  <div>G - Cycle geometries</div>
  <div>1-9,0 - Select geometry</div>
  <div>Space - Change behavior</div>
`;
document.body.appendChild(infoDiv);

// Update info display
function updateInfo() {
  infoDiv.innerHTML = `
    <div>Geometry: ${currentGeometry}</div>
    <div>Behavior: ${behaviors[curr]}</div>
    <div style="margin-top: 10px;">Controls:</div>
    <div>G - Cycle geometries</div>
    <div>1-9,0 - Select geometry</div>
    <div>Space - Change behavior</div>
  `;
}

// Add keyboard controls for geometry switching
const geometryKeys = Object.keys(geometries);
let currentGeometryIndex = 0;

window.addEventListener("keydown", (event) => {
  switch (event.key) {
    case " ":
      // Space - cycle behaviors
      event.preventDefault();
      curr = (curr + 1) % behaviors.length;
      console.log(`Behavior: ${behaviors[curr]}`);
      updateInfo();
      break;
    case "g":
    case "G":
      // Cycle through geometries
      currentGeometryIndex = (currentGeometryIndex + 1) % geometryKeys.length;
      const newGeometry = geometryKeys[currentGeometryIndex];
      console.log(`Switching to: ${newGeometry}`);
      switchGeometry(newGeometry);
      break;
    case "1":
      switchGeometry("Sphere");
      break;
    case "2":
      switchGeometry("Torus");
      break;
    case "3":
      switchGeometry("Torus Knot (2,3)");
      break;
    case "4":
      switchGeometry("Torus Knot (3,2)");
      break;
    case "5":
      switchGeometry("Torus Knot (5,3)");
      break;
    case "6":
      switchGeometry("Icosahedron");
      break;
    case "7":
      switchGeometry("Octahedron");
      break;
    case "8":
      switchGeometry("Smooth Cube");
      break;
    case "9":
      switchGeometry("Ellipsoid");
      break;
    case "0":
      switchGeometry("Rounded Cylinder");
      break;
  }
});

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
  b0.wander({ intensity: 1.0 });
  b0.update();

  for (let i = 1; i < boids.length; i++) {
    const b = boids[i];

    // Apply basic separation
    b.separate(boids, { intensity: 1.0, radius: 15 });

    switch (behaviors[curr]) {
      default:
      case "wander": {
        b.align(boids, { intensity: 0.5, radius: 30 });
        b.wander({ intensity: 0.8 });
        break;
      }
      case "seek": {
        b.seek(b0.position, { intensity: 0.8 });
        b.align(boids, { intensity: 0.3, radius: 30 });
        b.wander({ intensity: 0.2, angle: 0.1, radius: 5 });
        break;
      }
      case "flee": {
        const dist = b.position.distanceTo(b0.position);
        if (dist < 40) {
          b.flee(b0.position, { intensity: 1.5 });
        }
        b.wander({ intensity: 0.4 });
        break;
      }
      case "arrive": {
        b.arrive(b0.position, { intensity: 0.7 });
        b.wander({ angle: 0.05, intensity: 0.1, radius: 3 });
        break;
      }
      case "seek-sequence": {
        b.seek(boids[i - 1].position, { intensity: 0.8 });
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

function draw() {
  renderer.render(scene, camera);
}
animate();
