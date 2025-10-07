"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Points, Mesh } from "three";

import { useAccessibility } from "@/lib/a11y";
import { cn } from "@/lib/utils";

const PARTICLE_COUNT = 240;

function FloatingParticles() {
  const pointsRef = useRef<Points>(null);
  const positions = useMemo(() => {
    const values = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const radius = 3 + Math.random() * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const offset = i * 3;
      values[offset] = radius * Math.sin(phi) * Math.cos(theta);
      values[offset + 1] = radius * Math.sin(phi) * Math.sin(theta);
      values[offset + 2] = radius * Math.cos(phi);
    }
    return values;
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const t = state.clock.getElapsedTime();
    pointsRef.current.rotation.y = t * 0.08;
    pointsRef.current.rotation.x = Math.sin(t / 2) * 0.03;
  });

  return (
    <points ref={pointsRef} position={[0, 0, -2]}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={positions.length / 3}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color="#22D3EE"
        opacity={0.45}
        transparent
        depthWrite={false}
      />
    </points>
  );
}

function GradientPlane() {
  const meshRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    meshRef.current.rotation.z = Math.sin(t * 0.12) * 0.08;
  });

  return (
    <mesh ref={meshRef} position={[0, -2.5, -6]} rotation={[-Math.PI / 2.5, 0, 0]}>
      <planeGeometry args={[14, 12, 32, 32]} />
      <meshStandardMaterial
        color="#141c2c"
        emissive="#1f2d44"
        emissiveIntensity={0.4}
        metalness={0.15}
        roughness={0.9}
      />
    </mesh>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[2, 3, 5]} intensity={1.3} color="#6366F1" />
      <pointLight position={[-4, -2, 4]} intensity={0.8} color="#22D3EE" />
      <GradientPlane />
      <FloatingParticles />
    </>
  );
}

export function LiquidBackground({ className }: { className?: string }) {
  const { prefersReducedMotion, prefersReducedData } = useAccessibility();

  if (prefersReducedMotion || prefersReducedData) {
    return (
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-[#0B1220] via-[#151f36] to-[#1e2a45] opacity-90",
          className
        )}
      />
    );
  }

  return (
    <div className={cn("pointer-events-none absolute inset-0 -z-10", className)} aria-hidden>
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }} dpr={[1, 1.5]}>
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      <div className="absolute inset-0 bg-gradient-to-br from-[#0B1220]/80 via-[#111a2e]/60 to-[#1b2844]/85" />
    </div>
  );
}
