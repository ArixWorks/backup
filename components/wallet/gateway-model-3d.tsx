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

  // Clone so multiple tiles can render the same cached GLTF safely.
  const cloned = useMemo(() => scene.clone(true), [scene])

  useLayoutEffect(() => {
    const box = new THREE.Box3().setFromObject(cloned)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    setFitted({ scale: 2.05 / maxDim, offset: center.negate() })
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
useGLTF.preload("/pay-icons/3d/stars.glb", "/draco/")
