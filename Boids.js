import * as THREE from "three";
import { MeshSurfaceConstraint } from "./Surface.js";

export const behaviors = [
  "wander",
  "seek",
  "flee",
  "arrive",
  "seek-sequence",
  //   "WASD",
];

export const getRandomPointOnUnitSphere = () => {
  const theta = Math.random() * Math.PI * 2;
  const z = Math.random() * 2 - 1;
  const r = Math.sqrt(1 - z * z);
  const x = Math.cos(theta) * r;
  const y = Math.sin(theta) * r;
  return new THREE.Vector3(x, y, z);
};

export function Boid(radius, color, pos, vel, surface) {
  this.sphereRadius = radius; // kept for backward-compat on spheres
  this.position = pos || new THREE.Vector3();
  this.velocity = vel || new THREE.Vector3();
  this.acceleration = new THREE.Vector3();
  this.quaternion = new THREE.Quaternion();
  this.up = new THREE.Vector3(0, 1, 0); // Initialize up vector

  // Optional surface constraint (instance of MeshSurfaceConstraint)
  this.surface = surface || null;

  this.color = color;

  this.maxSpeed = 0.4;
  this.maxSteer = 0.04;

  this.wanderAngle = 0;
  this.arriveRadius = 0.2 * this.maxSpeed;
  this.departRadius = 0.5 * this.maxSpeed;

  // reusable objects
  this._cached = new THREE.Vector3();
  this._matrix = new THREE.Matrix4();
  this._quaternion = new THREE.Quaternion();
  
  // Simple check if boid is roughly in front
  this.isInFront = (otherPosition) => {
    if (!otherPosition) return false;
    if (this.velocity.lengthSq() < 0.001) return true; // No velocity, all are "in front"
    
    const toOther = this._cached.subVectors(otherPosition, this.position);
    return toOther.dot(this.velocity) > 0;
  };

  this.buildGeometry = () => {
    const geometry = new THREE.ConeGeometry(2, 8, 4);
    geometry.rotateX(Math.PI / 2); // Point forward
    geometry.scale(1, 1, 1.5);
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

    if (this.surface) {
      // Surface-constrained integration with offset
      const surfaceOffset = 3.0; // Glide above surface
      
      // First find current surface point
      const currentHit = this.surface.projectPoint(this.position, this.up, 200);
      if (!currentHit) {
        // Lost surface - try to recover
        const recoveryHit = this.surface.projectPoint(this.position, new THREE.Vector3(0, -1, 0), 500);
        if (recoveryHit) {
          this.position.copy(recoveryHit.point).addScaledVector(recoveryHit.normal, surfaceOffset);
          this.up = recoveryHit.normal.clone();
          this.velocity.multiplyScalar(0.1); // Slow down to recover
        }
        return;
      }
      
      const currentNormal = currentHit.normal.clone().normalize();
      this.up = currentNormal;
      
      // Project acceleration to tangent plane to keep steering on surface
      const accelDotN = this.acceleration.dot(currentNormal);
      this.acceleration.addScaledVector(currentNormal, -accelDotN);
      
      // Apply acceleration to velocity
      this.velocity.add(this.acceleration);
      
      // Project velocity to tangent plane
      const velDotN = this.velocity.dot(currentNormal);
      this.velocity.addScaledVector(currentNormal, -velDotN);
      
      // Clamp velocity
      if (this.velocity.lengthSq() > this.maxSpeed * this.maxSpeed) {
        this.velocity.setLength(this.maxSpeed);
      }
      
      // Add small random perturbation to avoid getting stuck
      if (this.velocity.lengthSq() < 0.01 * this.maxSpeed * this.maxSpeed) {
        const randomTangent = new THREE.Vector3(
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5
        );
        const dotN = randomTangent.dot(currentNormal);
        randomTangent.addScaledVector(currentNormal, -dotN);
        this.velocity.add(randomTangent.multiplyScalar(0.01));
      }
      
      // Calculate next position
      const nextPos = this.position.clone().add(this.velocity);
      
      // Project to surface
      const nextHit = this.surface.projectPoint(nextPos, currentNormal, 200);
      if (nextHit) {
        const nextNormal = nextHit.normal.clone().normalize();
        // Update position with offset from surface
        this.position.copy(nextHit.point).addScaledVector(nextNormal, surfaceOffset);
        this.up = nextNormal;
        
        // Adjust velocity for actual movement made
        const actualMove = this.position.clone().sub(previousPosition);
        const speed = this.velocity.length();
        if (actualMove.lengthSq() > 0.001) {
          this.velocity.copy(actualMove).normalize().multiplyScalar(speed);
        }
      } else {
        // Couldn't project - stay on current surface point
        this.position.copy(currentHit.point).addScaledVector(currentNormal, surfaceOffset);
        this.velocity.multiplyScalar(0.8); // Slow down a bit
      }
    } else {
      // Original sphere-constrained integration
      const velocityLength = this.velocity.length();
      const updatedPosition = this.position
        .clone()
        .add(this.velocity)
        .setLength(this.sphereRadius);
      this.velocity.copy(
        updatedPosition.sub(this.position).setLength(velocityLength)
      );
      this.position.add(this.velocity);
      this.up = this.position.clone().normalize();
    }

    // update rotation to face movement direction
    if (this.velocity.lengthSq() > 0.001) {
      // Create look direction from velocity
      const lookDirection = this.velocity.clone().normalize();
      const lookTarget = this.position.clone().add(lookDirection);
      
      // Use surface normal as up
      const upVector = this.up || new THREE.Vector3(0, 1, 0);
      
      // Build rotation matrix
      this._matrix.identity().lookAt(this.position, lookTarget, upVector);
      this._quaternion.setFromRotationMatrix(this._matrix);
      
      // Smooth rotation
      const rotationSpeed = Math.min(1.0, this.velocity.length() / this.maxSpeed * 2);
      this.quaternion.slerp(this._quaternion, rotationSpeed * 0.1);
    }

    // clear acceleration
    this.acceleration.set(0, 0, 0);

    // update object3D
    this.object3D.position.copy(this.position);
    this.object3D.up.copy(this.up);
    this.object3D.quaternion.copy(this.quaternion);
  };

  this.seek = (target, { intensity = 1 } = {}) => {
    const steering = this._cached.subVectors(target, this.position);
    
    // If on surface, project steering to tangent plane
    if (this.surface && this.up) {
      const dotN = steering.dot(this.up);
      steering.addScaledVector(this.up, -dotN);
    }
    
    steering.normalize().multiplyScalar(this.maxSteer * intensity);
    this.acceleration.add(steering);
  };

  this.flee = (target, { intensity = 1 } = {}) => {
    const steering = this._cached.subVectors(this.position, target);
    
    // If on surface, project steering to tangent plane
    if (this.surface && this.up) {
      const dotN = steering.dot(this.up);
      steering.addScaledVector(this.up, -dotN);
    }
    
    steering.normalize().multiplyScalar(this.maxSteer * intensity);
    this.acceleration.add(steering);
  };

  this.arrive = (target, { intensity = 1 } = {}) => {
    const direction = this._cached.subVectors(target, this.position);
    const distance = direction.length();
    
    // If on surface, project direction to tangent plane
    if (this.surface && this.up) {
      const dotN = direction.dot(this.up);
      direction.addScaledVector(this.up, -dotN);
    }
    
    const targetSpeed =
      distance > this.arriveRadius * 10
        ? this.maxSpeed
        : (this.maxSpeed * distance) / (this.arriveRadius * 10);
    const targetVelocity = direction.normalize().multiplyScalar(targetSpeed);

    const steering = targetVelocity.sub(this.velocity);
    steering.normalize().multiplyScalar(this.maxSteer * intensity);
    this.acceleration.add(steering);
  };

  this.align = (neighbors, { intensity = 1, radius = 50 } = {}) => {
    if (!neighbors || neighbors.length === 0) return;
    
    let avgVelocity = new THREE.Vector3();
    let count = 0;
    
    for (let neighbor of neighbors) {
      if (neighbor === this) continue;
      
      const dist = this.position.distanceTo(neighbor.position);
      
      // Simple distance and front check
      if (dist > 0 && dist < radius && this.isInFront(neighbor.position)) {
        avgVelocity.add(neighbor.velocity);
        count++;
      }
    }
    
    if (count > 0) {
      avgVelocity.divideScalar(count);
      
      // Project to tangent plane if on surface
      if (this.surface && this.up) {
        const dotN = avgVelocity.dot(this.up);
        avgVelocity.addScaledVector(this.up, -dotN);
      }
      
      if (avgVelocity.lengthSq() > 0.001) {
        avgVelocity.normalize().multiplyScalar(this.maxSpeed);
        const steering = avgVelocity.sub(this.velocity);
        if (steering.lengthSq() > 0.001) {
          steering.normalize().multiplyScalar(this.maxSteer * intensity);
          this.acceleration.add(steering);
        }
      }
    }
  };
  
  this.cohesion = (neighbors, { intensity = 1, radius = 50 } = {}) => {
    if (!neighbors || neighbors.length === 0) return;
    
    let centerOfMass = new THREE.Vector3();
    let count = 0;
    
    for (let neighbor of neighbors) {
      if (neighbor === this) continue;
      
      const dist = this.position.distanceTo(neighbor.position);
      
      if (dist > 0 && dist < radius && this.isInFront(neighbor.position)) {
        centerOfMass.add(neighbor.position);
        count++;
      }
    }
    
    if (count > 0) {
      centerOfMass.divideScalar(count);
      this.seek(centerOfMass, { intensity });
    }
  };
  
  this.separate = (neighbors, { intensity = 1, radius = 20 } = {}) => {
    if (!neighbors || neighbors.length === 0) return;
    
    let steering = new THREE.Vector3();
    let count = 0;
    
    for (let neighbor of neighbors) {
      if (neighbor === this) continue;
      
      const dist = this.position.distanceTo(neighbor.position);
      
      if (dist > 0 && dist < radius) {
        const diff = this._cached.subVectors(this.position, neighbor.position);
        diff.normalize().divideScalar(dist); // Weight by distance
        steering.add(diff);
        count++;
      }
    }
    
    if (count > 0) {
      steering.divideScalar(count);
      
      // Project to tangent plane if on surface
      if (this.surface && this.up) {
        const dotN = steering.dot(this.up);
        steering.addScaledVector(this.up, -dotN);
      }
      
      steering.normalize().multiplyScalar(this.maxSpeed);
      steering.sub(this.velocity);
      steering.normalize().multiplyScalar(this.maxSteer * intensity);
      this.acceleration.add(steering);
    }
  };

  this.wander = ({ angle = 0.15, radius = 10, intensity = 1 } = {}) => {
    this.wanderAngle += Math.random() * angle * 2 - angle;

    // Use actual up vector (surface normal) if available
    const up = this.up || new THREE.Vector3(0, 1, 0);

    // Get forward direction
    let forward;
    if (this.velocity.lengthSq() > 0.001) {
      forward = this.velocity.clone().normalize();
      // Remove normal component to keep in tangent plane
      const dotUp = forward.dot(up);
      forward.addScaledVector(up, -dotUp);
      if (forward.lengthSq() < 0.001) {
        // Velocity was parallel to normal, pick random tangent
        forward.set(1, 0, 0);
        const d = forward.dot(up);
        forward.addScaledVector(up, -d);
      }
      forward.normalize();
    } else {
      // No velocity, pick random tangent direction
      forward = new THREE.Vector3(1, 0, 0);
      const d = forward.dot(up);
      forward.addScaledVector(up, -d).normalize();
    }
    
    // Create right vector perpendicular to forward and up
    const right = new THREE.Vector3().crossVectors(up, forward);
    if (right.lengthSq() > 0.001) {
      right.normalize();
    } else {
      right.set(0, 0, 1);
    }
    
    // Create wander circle ahead
    const circleCenter = this.position.clone().addScaledVector(forward, radius * 2);
    
    // Add random point on circle
    const wanderForce = forward.clone().multiplyScalar(Math.cos(this.wanderAngle))
      .addScaledVector(right, Math.sin(this.wanderAngle))
      .multiplyScalar(radius);
    
    const target = circleCenter.add(wanderForce);
    
    return this.seek(target, { intensity });
  };
}
