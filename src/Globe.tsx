import { EARTH_MASK } from './assets';
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

function useLandPoints(count: number) {
  const [pts, setPts] = useState<Float32Array | null>(null);
  useEffect(() => {
    const img = new Image();
    img.src = EARTH_MASK;
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const out: number[] = [];
      const golden = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < count; i++) {
        const y = 1 - (i / (count - 1)) * 2; const r = Math.sqrt(1 - y * y); const th = golden * i;
        const x = Math.cos(th) * r, z = Math.sin(th) * r;
        const lat = Math.asin(y), lon = Math.atan2(z, -x);
        const u = Math.floor(((lon + Math.PI) / (2 * Math.PI)) * c.width) % c.width;
        const v = Math.floor(((Math.PI / 2 - lat) / Math.PI) * c.height);
        if (d[(v * c.width + u) * 4] < 128) out.push(x, y, z);
      }
      setPts(new Float32Array(out));
    };
  }, [count]);
  return pts;
}

function LatLon() {
  const geo = useMemo(() => {
    const p: number[] = [];
    const R = 1.002;
    for (let lat = -75; lat <= 75; lat += 15) {
      const phi = (lat * Math.PI) / 180;
      for (let i = 0; i < 96; i++) {
        const a = (i / 96) * Math.PI * 2, b = ((i + 1) / 96) * Math.PI * 2;
        p.push(R * Math.cos(phi) * Math.cos(a), R * Math.sin(phi), R * Math.cos(phi) * Math.sin(a));
        p.push(R * Math.cos(phi) * Math.cos(b), R * Math.sin(phi), R * Math.cos(phi) * Math.sin(b));
      }
    }
    for (let lon = 0; lon < 360; lon += 20) {
      const l = (lon * Math.PI) / 180;
      for (let i = 0; i < 48; i++) {
        const a = -Math.PI / 2 + (i / 48) * Math.PI, b = -Math.PI / 2 + ((i + 1) / 48) * Math.PI;
        p.push(R * Math.cos(a) * Math.cos(l), R * Math.sin(a), R * Math.cos(a) * Math.sin(l));
        p.push(R * Math.cos(b) * Math.cos(l), R * Math.sin(b), R * Math.cos(b) * Math.sin(l));
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); return g;
  }, []);
  return <lineSegments geometry={geo}><lineBasicMaterial color="#1a6dff" transparent opacity={0.22} /></lineSegments>;
}

function Ring({ r, tilt, speed, color, dots = 3 }: any) {
  const g = useRef<THREE.Group>(null!);
  useFrame((_, dt) => { g.current.rotation.y += dt * speed; });
  return (
    <group rotation={tilt}>
      <group ref={g}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[r, 0.006, 8, 160]} /><meshBasicMaterial color={color} transparent opacity={0.75} /></mesh>
        {Array.from({ length: dots }).map((_, i) => {
          const a = (i / dots) * Math.PI * 2;
          return <mesh key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]}><sphereGeometry args={[0.025, 8, 8]} /><meshBasicMaterial color="#bff6ff" /></mesh>;
        })}
      </group>
    </group>
  );
}

function Particles({ n }: { n: number }) {
  const ref = useRef<THREE.Points>(null!);
  const geo = useMemo(() => {
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 1.15 + Math.random() * 0.9, a = Math.random() * Math.PI * 2, y = (Math.random() - 0.5) * 1.4;
      p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = y; p[i * 3 + 2] = Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); return g;
  }, [n]);
  useFrame((_, dt) => { ref.current.rotation.y -= dt * 0.06; });
  return <points ref={ref} geometry={geo}><pointsMaterial color="#5fd8ff" size={0.018} transparent opacity={0.8} sizeAttenuation /></points>;
}

function Pulse({ trigger }: { trigger: number }) {
  const m = useRef<THREE.Mesh>(null!);
  const t0 = useRef(-10);
  useEffect(() => { t0.current = performance.now(); }, [trigger]);
  useFrame(() => {
    const t = (performance.now() - t0.current) / 1400;
    const s = 1 + Math.min(t, 1) * 0.9;
    m.current.scale.setScalar(s);
    (m.current.material as THREE.MeshBasicMaterial).opacity = t < 1 ? 0.5 * (1 - t) : 0;
  });
  return <mesh ref={m}><sphereGeometry args={[1, 32, 32]} /><meshBasicMaterial color="#38c8ff" transparent opacity={0} wireframe /></mesh>;
}

function Earth({ quality, pulse, alert }: { quality: number; pulse: number; alert: boolean }) {
  const pts = useLandPoints(quality > 1 ? 16000 : 7000);
  const g = useRef<THREE.Group>(null!);
  useFrame((_, dt) => { g.current.rotation.y += dt * 0.12; });
  const pgeo = useMemo(() => { if (!pts) return null; const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pts, 3)); return gg; }, [pts]);
  return (
    <group>
      <group ref={g} rotation={[0.35, 0, 0.1]}>
        <mesh><sphereGeometry args={[0.985, 48, 48]} /><meshBasicMaterial color="#020b1f" transparent opacity={0.92} /></mesh>
        <LatLon />
        {pgeo && <points geometry={pgeo}><pointsMaterial color={alert ? '#ff5a4a' : '#3fb8ff'} size={0.022} sizeAttenuation transparent opacity={0.95} /></points>}
      </group>
      <mesh><sphereGeometry args={[1.06, 48, 48]} /><meshBasicMaterial color="#1e7dff" transparent opacity={0.07} side={THREE.BackSide} /></mesh>
      <Ring r={1.35} tilt={[0.25, 0, 0.18]} speed={0.4} color="#22e4ff" />
      <Ring r={1.55} tilt={[-0.2, 0, -0.3]} speed={-0.25} color="#3d7bff" dots={2} />
      <Ring r={1.75} tilt={[0.05, 0, 0.05]} speed={0.15} color="#8fdcff" dots={4} />
      <Particles n={quality > 1 ? 700 : 260} />
      <Pulse trigger={pulse} />
    </group>
  );
}

export default function Globe({ quality, reduced, pulse, alert }: { quality: number; reduced: boolean; pulse: number; alert: boolean }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => { const f = () => setVisible(!document.hidden); document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f); }, []);
  return (
    <Canvas dpr={quality > 1 ? [1, 2] : [1, 1.25]} frameloop={reduced || !visible ? 'demand' : 'always'} camera={{ position: [0, 0.35, 4.1], fov: 42 }} gl={{ antialias: quality > 1, alpha: true, powerPreference: 'high-performance' }}>
      <Earth quality={quality} pulse={pulse} alert={alert} />
    </Canvas>
  );
}
