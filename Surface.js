import * as THREE from "three";
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from "three-mesh-bvh";

// Enable accelerated raycasting globally once
if (!THREE.Mesh.prototype._bvhRaycastPatched) {
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
  THREE.Mesh.prototype._bvhRaycastPatched = true;
}

export class MeshSurfaceConstraint {
  constructor(mesh) {
    this.mesh = mesh;
    this.raycaster = new THREE.Raycaster();
    this._tmpVec3 = new THREE.Vector3();
    this._tmpVecA = new THREE.Vector3();
    this._tmpVecB = new THREE.Vector3();
    this._normal = new THREE.Vector3();

    // Build BVH if not already present
    const geometry = this.mesh.geometry;
    if (!geometry.boundsTree) {
      // Attach the BVH methods to the geometry
      geometry.computeBoundsTree = computeBoundsTree;
      geometry.disposeBoundsTree = disposeBoundsTree;
      // Now compute the BVH
      geometry.computeBoundsTree();
    }
  }

  dispose() {
    if (this.mesh?.geometry?.boundsTree) {
      this.mesh.geometry.disposeBoundsTree();
    }
  }

  // Cast a ray and return the closest intersection (point and world-normal)
  _intersect(origin, direction, near = 0, far = Infinity) {
    this.raycaster.ray.origin.copy(origin);
    this.raycaster.ray.direction.copy(direction).normalize();
    this.raycaster.near = near;
    this.raycaster.far = far;
    const hits = this.raycaster.intersectObject(this.mesh, false);
    if (!hits || hits.length === 0) return null;
    const hit = hits[0];

    // Compute world normal
    if (hit.normal) {
      this._normal.copy(hit.normal);
    } else if (hit.face && hit.face.normal) {
      this._normal.copy(hit.face.normal);
    } else {
      this._normal.set(0, 1, 0);
    }
    // Transform to world space
    this.mesh.getWorldQuaternion(_quat);
    this._normal.applyQuaternion(_quat);
    return {
      point: hit.point.clone(),
      normal: this._normal.clone(),
      faceIndex: hit.faceIndex,
    };
  }

  // Project a point onto the surface using a ray along +/- normal fallback
  projectPoint(point, preferredNormal, maxDistance = 100) {
    const offset = 0.1; // Increased offset for better edge handling
    const origin = this._tmpVec3.copy(point);
    const dir = this._tmpVecA;
    if (preferredNormal && preferredNormal.lengthSq() > 0) {
      dir.copy(preferredNormal).normalize();
    } else {
      dir.set(0, -1, 0);
    }

    // Try casting along -dir first (toward surface)
    let hit = this._intersect(
      this._tmpVecB.copy(origin).addScaledVector(dir, offset),
      this._tmpVecA.copy(dir).multiplyScalar(-1),
      0,
      maxDistance + offset * 2
    );
    
    // If no hit, try opposite direction
    if (!hit) {
      hit = this._intersect(
        this._tmpVecB.copy(origin).addScaledVector(dir, -offset),
        dir.clone(),
        0,
        maxDistance + offset * 2
      );
    }
    
    // If still no hit, try multiple directions from center
    if (!hit && this.mesh.geometry.boundingSphere) {
      const center = this.mesh.geometry.boundingSphere.center;
      
      // Try direct line from center
      const toPoint = this._tmpVecA.copy(point).sub(center);
      if (toPoint.lengthSq() > 0.001) {
        toPoint.normalize();
        hit = this._intersect(
          center.clone(),
          toPoint,
          0,
          maxDistance * 3
        );
      }
      
      // If still no hit, try from point toward center
      if (!hit) {
        const toCenter = this._tmpVecA.copy(center).sub(point).normalize();
        hit = this._intersect(
          point.clone(),
          toCenter,
          0,
          maxDistance * 2
        );
      }
    }
    
    return hit; // may be null
  }

  // Get normal at a surface point by a tiny reproject
  normalAt(point, fallbackNormal) {
    const result = this.projectPoint(point, fallbackNormal, 0.25);
    if (result) return result.normal;
    if (fallbackNormal) return this._tmpVecA.copy(fallbackNormal);
    return this._tmpVecA.set(0, 1, 0);
  }
}

// module-scoped temp quaternion
const _quat = new THREE.Quaternion();
