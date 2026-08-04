"use client"

import { memo, useMemo, useRef, type RefObject } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"

/**
 * Real-time particle globe for the domain hero.
 *
 * Everything here is generated procedurally on the GPU-friendly path: no
 * textures, no videos, no post-processing. That keeps the whole scene at a
 * handful of draw calls so it holds 60 FPS inside the Telegram WebApp.
 *
 * Pointer input arrives through a ref (never React state) so cursor movement
 * never re-renders the React tree - only the imperative frame loop reads it.
 */

/** Normalized pointer, -1..1 on both axes, 0,0 = centre of the stage. */
export interface PointerRef {
  x: number
  y: number
}

const INDIGO = new THREE.Color("#312e81")
const VIOLET = new THREE.Color("#8b5cf6")
const CYAN = new THREE.Color("#22d3ee")

/** Max globe tilt from pointer, in radians (±8° per the design spec). */
const MAX_TILT = (8 * Math.PI) / 180
/** Continuous spin: 0.003 rad per 60 FPS frame, expressed frame-rate safe. */
const SPIN_PER_SECOND = 0.003 * 60

/** Deterministic pseudo-random so server and client agree and colours are stable. */
function seeded(index: number) {
  const value = Math.sin(index * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

/** Dense dot-sphere: evenly spread points via the Fibonacci lattice. */
const DotSphere = memo(function DotSphere({ count }: { count: number }) {
  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const color = new THREE.Color()
    const golden = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < count; i += 1) {
      const y = 1 - (i / (count - 1)) * 2
      const ring = Math.sqrt(Math.max(0, 1 - y * y))
      const theta = i * golden
      positions[i * 3] = Math.cos(theta) * ring
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = Math.sin(theta) * ring
      // Deep indigo at the poles, electric violet across the equator, with a
      // sparse scatter of cyan "data point" highlights like the reference.
      color.copy(INDIGO).lerp(VIOLET, 0.35 + ring * 0.65)
      if (seeded(i) > 0.94) color.lerp(CYAN, 0.75)
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
    return { positions, colors }
  }, [count])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.019}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.95}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
})

/**
 * Opaque core just inside the dot shell. Without it the back-facing dots show
 * through and the globe reads as a fuzzy cloud instead of a solid planet.
 */
function GlobeCore() {
  return (
    <mesh>
      <sphereGeometry args={[0.965, 32, 32]} />
      <meshBasicMaterial color="#0a0718" />
    </mesh>
  )
}

/** Thin elliptical orbit rings, each on its own tilt and drift speed. */
const OrbitRings = memo(function OrbitRings() {
  const rings = useMemo(() => {
    const segments = 128
    const positions = new Float32Array((segments + 1) * 3)
    for (let i = 0; i <= segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2
      positions[i * 3] = Math.cos(angle)
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = Math.sin(angle)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    return [
      { scale: 1.32, rotation: [1.25, 0, 0.42] as const, color: "#22d3ee", opacity: 0.5, speed: 0.06, geometry },
      { scale: 1.5, rotation: [1.05, 0.6, -0.3] as const, color: "#818cf8", opacity: 0.36, speed: -0.045, geometry },
      { scale: 1.18, rotation: [1.45, -0.4, 0.15] as const, color: "#a855f7", opacity: 0.3, speed: 0.08, geometry },
    ]
  }, [])

  return (
    <>
      {rings.map((ring, index) => (
        <DriftingRing key={index} {...ring} />
      ))}
    </>
  )
})

function DriftingRing({
  geometry,
  scale,
  rotation,
  color,
  opacity,
  speed,
}: {
  geometry: THREE.BufferGeometry
  scale: number
  rotation: readonly [number, number, number]
  color: string
  opacity: number
  speed: number
}) {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.z += delta * speed
  })
  return (
    <group ref={ref} rotation={rotation as unknown as THREE.Euler} scale={scale}>
      <lineLoop>
        <primitive object={geometry} attach="geometry" />
        <lineBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineLoop>
    </group>
  )
}

/** Sparse drifting star dust around the globe; a few blink in and out. */
const StarDust = memo(function StarDust({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      // Push the dust into a shell well outside the globe so it never sits on
      // the surface, then jitter each axis for an organic scatter.
      const radius = 1.6 + seeded(i * 3.1) * 1.3
      const theta = seeded(i * 5.7) * Math.PI * 2
      const phi = Math.acos(seeded(i * 7.3) * 2 - 1)
      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius
      positions[i * 3 + 1] = Math.cos(phi) * radius * 0.8
      positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius
    }
    return positions
  }, [count])

  useFrame((state) => {
    const points = ref.current
    if (!points) return
    const time = state.clock.elapsedTime
    points.rotation.y = time * 0.02
    // Whole-field opacity breathing is one uniform write per frame, far cheaper
    // than per-particle attribute updates and reads as gentle twinkling.
    const material = points.material as THREE.PointsMaterial
    material.opacity = 0.45 + Math.sin(time * 0.9) * 0.18
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#a5b4fc"
        size={0.026}
        sizeAttenuation
        transparent
        opacity={0.5}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
})

/** Spins the globe forever and eases it toward the pointer, capped at ±8°. */
function GlobeRig({ pointer, dots, dust }: { pointer: RefObject<PointerRef>; dots: number; dust: number }) {
  const spin = useRef<THREE.Group>(null)
  const tilt = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    // Clamp delta so a backgrounded tab doesn't resume with a huge jump.
    const step = Math.min(delta, 0.05)
    if (spin.current) spin.current.rotation.y += step * SPIN_PER_SECOND
    const group = tilt.current
    const input = pointer.current
    if (group && input) {
      const targetY = input.x * MAX_TILT
      const targetX = input.y * MAX_TILT
      // Critically damped follow: settles smoothly and returns to rest on its
      // own once the pointer leaves and the ref is zeroed.
      const ease = 1 - Math.pow(0.0015, step)
      group.rotation.y += (targetY - group.rotation.y) * ease
      group.rotation.x += (targetX - group.rotation.x) * ease
    }
  })

  return (
    <group ref={tilt}>
      <StarDust count={dust} />
      <OrbitRings />
      <group ref={spin} rotation={[0, 0, 0.28]}>
        <GlobeCore />
        <DotSphere count={dots} />
      </group>
    </group>
  )
}

/**
 * The WebGL layer only. Mounted through a lazy dynamic import by the stage so
 * the three.js chunk never blocks first paint.
 */
export default function GlobeCanvas({ pointer, quality = "high" }: { pointer: RefObject<PointerRef>; quality?: "high" | "low" }) {
  const dots = quality === "high" ? 3200 : 1500
  const dust = quality === "high" ? 40 : 24

  return (
    <Canvas
      dpr={quality === "high" ? [1, 1.75] : 1}
      camera={{ position: [0, 0, 3.1], fov: 42 }}
      gl={{ alpha: true, antialias: quality === "high", powerPreference: "high-performance" }}
      resize={{ offsetSize: true }}
      className="!absolute inset-0"
      aria-hidden
    >
      <GlobeRig pointer={pointer} dots={dots} dust={dust} />
    </Canvas>
  )
}
