"use client"

import { Suspense, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import * as THREE from "three"

/**
 * Renders a user-supplied .glb payment-gateway icon with a slow continuous
 * Y-axis spin, exactly like premium wallet bots. No tile box, no background:
 * the canvas is fully transparent so only the icon itself is visible.
 *
 * - Draco decoder is self-hosted at /draco/ (no foreign CDN - critical for
 *   users on restricted networks).
 * - Lighting is pure lights (no Environment preset) for the same reason.
 * - The model is auto-centered and auto-scaled to fit regardless of how it
 *   was exported.
 */
export function GatewayModel3D({ src, spinning = true }: { src: string; spinning?: boolean }) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 2.7], fov: 38 }}
      gl={{ alpha: true, antialias: true }}
      // Carousel tiles are CSS scale()-transformed. getBoundingClientRect
      // (the default measure) bakes that transform into the canvas size and
      // ResizeObserver never fires on transform changes, so a canvas mounted
      // in a shrunken side tile stays tiny/corner-stuck when it becomes
      // active. offsetSize measures layout size, ignoring transforms.
      resize={{ offsetSize: true }}
      className="h-full w-full"
      aria-hidden
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 4, 5]} intensity={2.2} />
      <directionalLight position={[-4, -2, 3]} intensity={0.7} />
      <pointLight position={[0, 2, -3]} intensity={0.6} />
      <Suspense fallback={null}>
        <SpinningModel src={src} spinning={spinning} />
      </Suspense>
    </Canvas>
  )
}

function SpinningModel({ src, spinning }: { src: string; spinning: boolean }) {
  const { scene } = useGLTF(src, "/draco/")
  const group = useRef<THREE.Group>(null)
  const [fitted, setFitted] = useState({ scale: 1, offset: new THREE.Vector3() })

  // Clone so multiple tiles can render the same cached GLTF safely, and
  // strip cameras/lights that stock GLBs often embed far from the model.
  const cloned = useMemo(() => {
    const c = scene.clone(true)
    const junk: THREE.Object3D[] = []
    c.traverse((o) => {
      if ((o as THREE.Camera).isCamera || (o as THREE.Light).isLight) junk.push(o)
    })
    for (const o of junk) o.removeFromParent()
    return c
  }, [scene])

  useLayoutEffect(() => {
    // Measure only real mesh geometry. Box3.setFromObject over the whole
    // scene also includes empty helper nodes, which inflates the box and
    // makes the model render tiny and off-center.
    cloned.updateWorldMatrix(true, true)
    const box = new THREE.Box3()
    const meshBox = new THREE.Box3()
    cloned.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh || !mesh.geometry) return
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
      if (!mesh.geometry.boundingBox) return
      meshBox.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld)
      box.union(meshBox)
    })
    if (box.isEmpty()) return
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    // Visible square at z=0 for fov 38 / dist 2.7 is ~1.86 units. Fit inside
    // it, using the worst-case rotating footprint so the Y-spin never clips.
    const spinWidth = Math.hypot(size.x, size.z)
    const maxDim = Math.max(spinWidth, size.y) || 1
    setFitted({ scale: 1.82 / maxDim, offset: center.negate() })
  }, [cloned])

  useFrame((_, delta) => {
    if (spinning && group.current) group.current.rotation.y += delta * 0.9
  })

  return (
    <group ref={group} scale={fitted.scale}>
      <primitive object={cloned} position={fitted.offset} />
    </group>
  )
}

useGLTF.preload("/pay-icons/3d/balance.glb", "/draco/")
useGLTF.preload("/pay-icons/3d/card.glb", "/draco/")
useGLTF.preload("/pay-icons/3d/ton.glb", "/draco/")
