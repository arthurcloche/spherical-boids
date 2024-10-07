import * as THREE from "three";

export const behaviors = ["wander", "seek", "flee", "arrive", "seek-sequence"];

export const getRandomPointOnUnitSphere = () => {
  const theta = Math.random() * Math.PI * 2;
  const z = Math.random() * 2 - 1;
  const r = Math.sqrt(1 - z * z);
  const x = Math.cos(theta) * r;
  const y = Math.sin(theta) * r;
  return new THREE.Vector3(x, y, z);
};

export function Boid(radius, color, pos, vel) {
  this.sphereRadius = radius;
  this.position = pos || new THREE.Vector3();
  this.velocity = vel || new THREE.Vector3();
  this.acceleration = new THREE.Vector3();
  this.quaternion = new THREE.Quaternion();

  this.color = color;

  this.maxSpeed = 1.0;
  this.maxSteer = 0.1;

  this.wanderAngle = 0;
  this.arriveRadius = 0.2 * this.maxSpeed;
  this.departRadius = 0.5 * this.maxSpeed;

  this.maxForce = 0.25;
  this.maxSpeed = 5;

  // reusable objects
  this._cached = new THREE.Vector3();
  this._matrix = new THREE.Matrix4();
  this._quaternion = new THREE.Quaternion();

  this.buildGeometry = () => {
    const geometry = new THREE.ConeGeometry(3, 6, 4);
    geometry.scale(1, 1, 0.5);
    const material = new THREE.MeshBasicMaterial({ color: this.color });
    const mesh = new THREE.Mesh(geometry, material);
    this.object3D = mesh;
  };
  this.buildGeometry();

  // New update function for flocking behavior
  this.update = (boids) => {
    // Apply flocking behavior
    this.updateFlock(boids);

    // Update position and rotation
    const previousPosition = this.position.clone();

    // Set velocity tangent to sphere
    const velocityLength = this.velocity.length();
    const updatedPosition = this.position
      .clone()
      .add(this.velocity)
      .setLength(this.sphereRadius);
    this.velocity.copy(
      updatedPosition.sub(this.position).setLength(velocityLength)
    );

    // Update position
    this.position.add(this.velocity);

    // Update rotation
    const angularVelocity = this.velocity.length() / this.maxSpeed;
    this.up = this.position.clone().normalize();
    this._matrix
      .identity()
      .lookAt(this.position, previousPosition.negate(), this.up);
    this._quaternion.setFromRotationMatrix(this._matrix);
    this.quaternion.slerp(this._quaternion, angularVelocity);

    // Update object3D
    this.object3D.position.copy(this.position);
    this.object3D.up.copy(this.up);
    this.object3D.quaternion.copy(this.quaternion);
  };

  this.updateFlock = (boids) => {
    const alignment = this.align(boids);
    const cohesion = this.cohesion(boids);
    const separation = this.separation(boids);

    // You can adjust these multipliers as needed
    const alignmentWeight = 1;
    const cohesionWeight = 1;
    const separationWeight = 1;

    this.acceleration.add(alignment.multiplyScalar(alignmentWeight));
    this.acceleration.add(cohesion.multiplyScalar(cohesionWeight));
    this.acceleration.add(separation.multiplyScalar(separationWeight));

    // Update velocity
    this.velocity.add(this.acceleration);
    if (this.velocity.lengthSq() > this.maxSpeed * this.maxSpeed)
      this.velocity.setLength(this.maxSpeed);

    // Clear acceleration
    this.acceleration.set(0, 0, 0);
  };

  this.align = (boids) => {
    const perceptionRadius = 25;
    const steering = new THREE.Vector3();
    let total = 0;

    for (const other of boids) {
      if (
        other !== this &&
        this.position.distanceTo(other.position) < perceptionRadius
      ) {
        steering.add(other.velocity);
        total++;
      }
    }

    if (total > 0) {
      steering.divideScalar(total);
      steering.setLength(this.maxSpeed);
      steering.sub(this.velocity);
      if (steering.lengthSq() > this.maxForce * this.maxForce)
        steering.setLength(this.maxForce);
    }

    return steering;
  };

  this.separation = (boids) => {
    const perceptionRadius = 24;
    const steering = new THREE.Vector3();
    let total = 0;

    for (const other of boids) {
      const d = this.position.distanceTo(other.position);
      if (other !== this && d < perceptionRadius) {
        const diff = this.position.clone().sub(other.position);
        diff.divideScalar(d * d);
        steering.add(diff);
        total++;
      }
    }

    if (total > 0) {
      steering.divideScalar(total);
      steering.setLength(this.maxSpeed);
      steering.sub(this.velocity);
      if (steering.lengthSq() > this.maxForce * this.maxForce)
        steering.setLength(this.maxForce);
    }

    return steering;
  };

  this.cohesion = (boids) => {
    const perceptionRadius = 50;
    const steering = new THREE.Vector3();
    let total = 0;

    for (const other of boids) {
      if (
        other !== this &&
        this.position.distanceTo(other.position) < perceptionRadius
      ) {
        steering.add(other.position);
        total++;
      }
    }

    if (total > 0) {
      steering.divideScalar(total);
      steering.sub(this.position);
      steering.setLength(this.maxSpeed);
      steering.sub(this.velocity);
      if (steering.lengthSq() > this.maxForce * this.maxForce)
        steering.setLength(this.maxForce);
    }

    return steering;
  };
}

import * as THREE from "three";

export const behaviors = ["wander", "seek", "flee", "arrive", "seek-sequence"];

export const getRandomPointOnUnitSphere = () => {
  const theta = Math.random() * Math.PI * 2;
  const z = Math.random() * 2 - 1;
  const r = Math.sqrt(1 - z * z);
  const x = Math.cos(theta) * r;
  const y = Math.sin(theta) * r;
  return new THREE.Vector3(x, y, z);
};

export function Boid(radius, color, pos, vel) {
  this.sphereRadius = radius;
  this.position = pos || new THREE.Vector3();
  this.velocity = vel || new THREE.Vector3();
  this.acceleration = new THREE.Vector3();
  this.quaternion = new THREE.Quaternion();

  this.color = color;

  this.maxSpeed = 1.0;
  this.maxSteer = 0.1;

  this.wanderAngle = 0;
  this.arriveRadius = 0.2 * this.maxSpeed;
  this.departRadius = 0.5 * this.maxSpeed;

  // reusable objects
  this._cached = new THREE.Vector3();
  this._matrix = new THREE.Matrix4();
  this._quaternion = new THREE.Quaternion();

  this.buildGeometry = () => {
    const geometry = new THREE.ConeGeometry(3, 6, 4);
    geometry.scale(1, 1, 0.5);
    const material = new THREE.MeshBasicMaterial({ color: this.color });
    const mesh = new THREE.Mesh(geometry, material);
    this.object3D = mesh;
  };
  this.buildGeometry();
  this.update = () => {
    const previousPosition = this.position.clone();

    // clamp acceleration
    if (this.acceleration.lengthSq() > this.maxSteer * this.maxSteer)
      this.acceleration.setLength(this.maxSteer);
    // update velocity
    this.velocity.add(this.acceleration);
    // clamp velocity
    if (this.velocity.lengthSq() > this.maxSpeed * this.maxSpeed)
      this.velocity.setLength(this.maxSpeed);

    // set velocity tangent to sphere
    const velocityLength = this.velocity.length();
    const updatedPosition = this.position
      .clone()
      .add(this.velocity)
      .setLength(this.sphereRadius);
    this.velocity.copy(
      updatedPosition.sub(this.position).setLength(velocityLength)
    );

    // update position
    this.position.add(this.velocity);

    // update rotation
    const angularVelocity = this.velocity.length() / this.maxSpeed;
    this.up = this.position.clone().normalize();
    this._matrix
      .identity()
      .lookAt(this.position, previousPosition.negate(), this.up);
    this._quaternion.setFromRotationMatrix(this._matrix);
    this.quaternion.slerp(this._quaternion, angularVelocity);

    // clear acceleration
    this.acceleration.set(0, 0, 0);

    // update object3D
    this.object3D.position.copy(this.position);
    this.object3D.up.copy(this.up);
    this.object3D.quaternion.copy(this.quaternion);
  };

  this.seek = (target, { intensity = 1 } = {}) => {
    const steering = this._cached.subVectors(target, this.position);
    this.acceleration.add(steering.multiplyScalar(intensity));
  };

  this.flee = (target, { intensity = 1 } = {}) => {
    const steering = this._cached.subVectors(this.position, target);
    this.acceleration.add(steering.multiplyScalar(intensity));
  };

  this.arrive = (target, { intensity = 1 } = {}) => {
    const direction = this._cached.subVectors(target, this.position);
    const distance = this.position.angleTo(target);
    const targetSpeed =
      distance > this.arriveRadius
        ? this.maxSpeed
        : (this.maxSpeed * distance) / this.arriveRadius;
    const targetVelocity = direction.setLength(targetSpeed);

    const steering = this._cached.subVectors(targetVelocity, this.velocity);
    this.acceleration.add(steering.multiplyScalar(intensity));
  };

  this.wander = ({ angle = 0.25, radius = 20, intensity = 1 } = {}) => {
    this.wanderAngle += Math.random() * angle * 2 - angle;

    const up = this._cached.copy(this.position).normalize();

    const rnd = new THREE.Vector3(
      Math.cos(this.wanderAngle),
      Math.sin(this.wanderAngle),
      0
    );
    rnd.multiplyScalar(radius);
    rnd.applyAxisAngle(up, Math.PI / 2);

    const target = this.position.clone().add(this.velocity).add(rnd);

    return this.seek(target, { intensity });
  };
}
