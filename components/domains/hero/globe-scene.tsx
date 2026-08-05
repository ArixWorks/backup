"use client"

import { useMemo, useRef } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import type { MotionValue } from "motion/react"

/**
 * Screen-space transform for one extension pill, written every frame by the
 * scene and read by the DOM badge. These are motion values, so updating them
 * never triggers a React render.
 */
export type BadgeProjection = {
  x: MotionValue<number>
  y: MotionValue<number>
  scale: MotionValue<number>
  opacity: MotionValue<number>
  depth: MotionValue<number>
}

/**
 * Live pointer/drag state, owned by the DOM container so a drag keeps tracking
 * even when it starts on top of a badge. The scene consumes the deltas.
 */
export type DragState = {
  dragging: boolean
  /** Unconsumed pointer delta in px; the frame loop zeroes these after reading. */
  dx: number
  dy: number
  /** Normalized hover position (-1..1) used for the idle tilt. */
  hx: number
  hy: number
  hovering: boolean
}

/** Where each pill is pinned in 3D, as (azimuth, polar-offset) on the sphere. */
const ANCHOR_ANGLES: Array<[number, number]> = [
  [0.15, -0.62],
  [1.35, 0.1],
  [2.55, -0.28],
  [3.95, 0.45],
  [5.15, -0.12],
]

const ANCHOR_RADIUS = 1.78

const VIOLET = new THREE.Color("#8b5cf6")
const CYAN = new THREE.Color("#22d3ee")
const INDIGO = new THREE.Color("#6366f1")

/* ------------------------------------------------------------------ shaders */

const PARTICLE_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uDpr;
  attribute float aScale;
  attribute float aPhase;
  varying float vFacing;
  varying float vLat;

  void main() {
    vec3 p = position;
    // Gentle breathing along the normal so the shell feels alive, not rigid.
    p *= 1.0 + sin(uTime * 0.7 + aPhase * 6.2831) * 0.014;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    // position doubles as the normal on a unit sphere.
    vec3 nW = normalize(mat3(modelMatrix) * normalize(position));
    vec3 pW = (modelMatrix * vec4(p, 1.0)).xyz;
    vFacing = dot(nW, normalize(cameraPosition - pW));
    vLat = position.y * 0.5 + 0.5;

    // Perspective attenuation: far points shrink.
    gl_PointSize = uSize * aScale * uDpr * (1.0 / max(-mv.z, 0.001));
  }
`

const PARTICLE_FRAG = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform float uOpacity;
  varying float vFacing;
  varying float vLat;

  void main() {
    // Round, soft-edged point.
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.05, d);

    // Iridescence: latitude drives the base hue, view angle shifts it.
    float t = clamp(vLat * 0.75 + (1.0 - vFacing) * 0.45, 0.0, 1.0);
    vec3 col = mix(uColorA, uColorB, t);
    col = mix(col, uColorC, smoothstep(0.55, 1.0, 1.0 - vFacing) * 0.5);

    // Points on the far hemisphere read dimmer, which is what sells the volume.
    float depth = smoothstep(-0.45, 1.0, vFacing);
    gl_FragColor = vec4(col * (0.28 + depth * 1.05), alpha * uOpacity * (0.34 + depth * 0.66));
  }
`

const FRESNEL_VERT = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPosW = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const FRESNEL_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPower;
  uniform float uIntensity;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec3 v = normalize(cameraPosition - vPosW);
    float f = pow(1.0 - clamp(dot(normalize(vNormalW), v), 0.0, 1.0), uPower);
    gl_FragColor = vec4(uColor, f * uIntensity);
  }
`

/* ------------------------------------------------------------------- pieces */

/** Fibonacci-distributed shell of glowing points. */
function ParticleShell({ count }: { count: number }) {
  const material = useRef<THREE.ShaderMaterial>(null)
  // gl_PointSize is in device pixels, so it must track the real pixel ratio -
  // guessing it makes the points half-size on 1x and chunky on 3x screens.
  const dpr = useThree((state) => state.gl.getPixelRatio())

  const { positions, scales, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const scales = new Float32Array(count)
    const phases = new Float32Array(count)
    const golden = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / Math.max(count - 1, 1)) * 2
      const r = Math.sqrt(Math.max(1 - y * y, 0))
      const theta = golden * i
      positions[i * 3] = Math.cos(theta) * r
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = Math.sin(theta) * r
      // A few brighter points break up the uniformity of a perfect lattice.
      scales[i] = 0.55 + Math.random() * (Math.random() > 0.94 ? 1.5 : 0.6)
      phases[i] = Math.random()
    }
    return { positions, scales, phases }
  }, [count])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 34 },
      uDpr: { value: dpr },
      uOpacity: { value: 1 },
      uColorA: { value: VIOLET.clone() },
      uColorB: { value: CYAN.clone() },
      uColorC: { value: INDIGO.clone() },
    }),
    [dpr],
  )

  useFrame((state) => {
    if (material.current) material.current.uniforms.uTime.value = state.clock.elapsedTime
  })

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aScale" args={[scales, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={PARTICLE_VERT}
        fragmentShader={PARTICLE_FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

/** Rim-lit core that gives the point cloud something solid to wrap. */
function GlowCore() {
  const uniforms = useMemo(
    () => ({
      uColor: { value: VIOLET.clone() },
      uPower: { value: 2.6 },
      uIntensity: { value: 0.85 },
    }),
    [],
  )
  return (
    <mesh scale={0.965}>
      <sphereGeometry args={[1, 48, 48]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={FRESNEL_VERT}
        fragmentShader={FRESNEL_FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

/** Latitude/longitude wireframe, kept faint so the points stay the subject. */
function Wireframe() {
  return (
    <mesh scale={1.001}>
      <sphereGeometry args={[1, 22, 14]} />
      <meshBasicMaterial
        color={INDIGO}
        wireframe
        transparent
        opacity={0.13}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

/** Counter-rotating orbit rings at three different tilts. */
function OrbitRings() {
  const a = useRef<THREE.Mesh>(null)
  const b = useRef<THREE.Mesh>(null)
  const c = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (a.current) a.current.rotation.z += delta * 0.09
    if (b.current) b.current.rotation.z -= delta * 0.06
    if (c.current) c.current.rotation.z += delta * 0.13
  })

  const ring = (color: THREE.Color, opacity: number) => (
    <meshBasicMaterial
      color={color}
      transparent
      opacity={opacity}
      depthWrite={false}
      blending={THREE.AdditiveBlending}
      side={THREE.DoubleSide}
    />
  )

  return (
    <group>
      <mesh ref={a} rotation={[1.42, 0.22, 0]}>
        <torusGeometry args={[1.34, 0.0055, 8, 200]} />
        {ring(CYAN, 0.62)}
      </mesh>
      <mesh ref={b} rotation={[1.16, -0.55, 0.5]}>
        <torusGeometry args={[1.55, 0.004, 8, 200]} />
        {ring(VIOLET, 0.5)}
      </mesh>
      <mesh ref={c} rotation={[1.62, 0.75, -0.3]}>
        <torusGeometry args={[1.18, 0.0035, 8, 200]} />
        {ring(INDIGO, 0.42)}
      </mesh>
    </group>
  )
}

/** Sparse far dust: parallaxes against the sphere and reinforces the depth. */
function Dust({ count }: { count: number }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // Shell well outside the globe so it never mixes with the surface points.
      const r = 3.1 + Math.random() * 2.6
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      arr[i * 3 + 2] = r * Math.cos(phi)
    }
    return arr
  }, [count])

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.018}
        color={CYAN}
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

/* -------------------------------------------------------------- controller */

/**
 * Owns the globe's rotation: drag to spin with real momentum, a slow idle
 * drift when untouched, and a subtle lean toward the pointer. Also projects
 * each 3D anchor to screen space for the DOM pills.
 */
function GlobeRig({
  quality,
  drag,
  projections,
}: {
  quality: "high" | "low"
  drag: React.RefObject<DragState>
  projections: BadgeProjection[]
}) {
  const group = useRef<THREE.Group>(null)
  const { camera, size } = useThree()

  const rot = useRef({ x: -0.12, y: 0.4 })
  const vel = useRef({ x: 0, y: 0 })
  const lean = useRef({ x: 0, y: 0 })

  const anchors = useMemo(
    () =>
      ANCHOR_ANGLES.map(([azimuth, polar]) => {
        const phi = Math.PI / 2 + polar
        return new THREE.Vector3(
          ANCHOR_RADIUS * Math.sin(phi) * Math.cos(azimuth),
          ANCHOR_RADIUS * Math.cos(phi),
          ANCHOR_RADIUS * Math.sin(phi) * Math.sin(azimuth),
        )
      }),
    [],
  )

  const scratch = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30)
    const state = drag.current
    if (!group.current || !state) return

    // Drag converts pointer travel straight into angular velocity.
    if (state.dragging) {
      vel.current.y += state.dx * 0.0045
      vel.current.x += state.dy * 0.0035
      state.dx = 0
      state.dy = 0
    }

    // Integrate, then bleed off momentum so a flick coasts to a stop.
    rot.current.y += vel.current.y + delta * 0.16
    rot.current.x += vel.current.x
    vel.current.y *= 0.94
    vel.current.x *= 0.94
    // Keep the poles from flipping over.
    rot.current.x = Math.max(-0.62, Math.min(0.62, rot.current.x))

    // Idle lean toward the cursor, released when the pointer leaves.
    const targetX = state.hovering && !state.dragging ? state.hy * 0.13 : 0
    const targetY = state.hovering && !state.dragging ? state.hx * 0.16 : 0
    lean.current.x += (targetX - lean.current.x) * Math.min(1, delta * 4)
    lean.current.y += (targetY - lean.current.y) * Math.min(1, delta * 4)

    group.current.rotation.x = rot.current.x + lean.current.x
    group.current.rotation.y = rot.current.y + lean.current.y

    // Project the anchors so the DOM pills orbit in true 3D.
    const half = { w: size.width / 2, h: size.height / 2 }
    for (let i = 0; i < projections.length; i++) {
      const anchor = anchors[i]
      if (!anchor) continue
      scratch.copy(anchor).applyQuaternion(group.current.quaternion)
      // Depth BEFORE projection: +1 nearest the viewer, -1 furthest.
      const facing = scratch.z / ANCHOR_RADIUS
      scratch.project(camera)
      const p = projections[i]
      p.x.set(scratch.x * half.w)
      p.y.set(-scratch.y * half.h)
      const t = (facing + 1) / 2
      p.scale.set(0.74 + t * 0.36)
      p.opacity.set(0.4 + t * 0.6)
      p.depth.set(Math.round(t * 20))
    }
  })

  return (
    <group ref={group}>
      <ParticleShell count={quality === "high" ? 3600 : 1500} />
      <GlowCore />
      <Wireframe />
      <OrbitRings />
      {quality === "high" ? <Dust count={110} /> : null}
    </group>
  )
}

/* ----------------------------------------------------------------- surface */

export default function GlobeScene({
  quality,
  drag,
  projections,
  onReady,
}: {
  quality: "high" | "low"
  drag: React.RefObject<DragState>
  projections: BadgeProjection[]
  onReady?: () => void
}) {
  return (
    <Canvas
      dpr={quality === "high" ? [1, 2] : 1}
      camera={{ position: [0, 0, 4.35], fov: 42 }}
      gl={{ alpha: true, antialias: quality === "high", powerPreference: "high-performance" }}
      onCreated={() => onReady?.()}
      // The stage is inside motion-transformed ancestors; offsetSize measures
      // layout size so a parent transform can't bake itself into the drawing
      // buffer and leave the canvas mis-sized.
      resize={{ offsetSize: true }}
      className="!absolute inset-0 size-full"
      aria-hidden
    >
      <GlobeRig quality={quality} drag={drag} projections={projections} />
    </Canvas>
  )
}
