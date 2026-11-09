import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Agent, Task } from './api';

const R = 4.2;
function pos(i: number, n: number): THREE.Vector3 { const a = (i / n) * Math.PI * 2 - Math.PI / 2; return new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R); }
function curve(a: THREE.Vector3, b: THREE.Vector3) { const m = a.clone().add(b).multiplyScalar(0.5); m.y += 1.6; return new THREE.QuadraticBezierCurve3(a.clone().setY(0.6), m, b.clone().setY(0.6)); }

function label(text: string, sub: string, color: string) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const x = c.getContext('2d')!;
  x.font = 'bold 40px Inter, Arial'; x.textAlign = 'center'; x.fillStyle = color; x.shadowColor = color; x.shadowBlur = 18; x.fillText(text, 256, 70);
  x.shadowBlur = 0; x.font = '30px Inter, Arial'; x.fillStyle = '#cfe6ff'; x.fillText(sub, 256, 125);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}

function Controls({ reduced }: { reduced: boolean }) {
  const { camera, gl } = useThree();
  const ref = useRef<OrbitControls>();
  useEffect(() => { const c = new OrbitControls(camera, gl.domElement); c.enableDamping = true; c.enablePan = false; c.minDistance = 6; c.maxDistance = 16; c.maxPolarAngle = Math.PI / 2.1; c.autoRotate = !reduced; c.autoRotateSpeed = 0.5; ref.current = c; return () => c.dispose(); }, [camera, gl, reduced]);
  useFrame(() => ref.current?.update());
  return null;
}

function Station({ a, p, busy, failed, count, onPick }: { a: Agent; p: THREE.Vector3; busy: boolean; failed: boolean; count: number; onPick: (id: string) => void }) {
  const m = useRef<THREE.Mesh>(null!); const ring = useRef<THREE.Mesh>(null!);
  const tex = useMemo(() => label(`${a.id} ${a.name}`, `${a.realStatus}${count ? ' · ' + count + ' задачи' : ''}`, a.color), [a, count]);
  useFrame((s, dt) => { m.current.rotation.y += dt * (busy ? 2 : 0.5); m.current.position.y = 0.9 + Math.sin(s.clock.elapsedTime * 2 + +a.id) * 0.08; ring.current.rotation.z += dt * (busy ? 1.5 : 0.3); });
  const col = failed ? '#ff3b4e' : a.color;
  return (
    <group position={p}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.75, 0.85, 0.12, 40]} /><meshStandardMaterial color="#0b1830" metalness={0.8} roughness={0.3} emissive={col} emissiveIntensity={0.15} /></mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}><torusGeometry args={[0.8, 0.025, 8, 60]} /><meshBasicMaterial color={col} /></mesh>
      <mesh ref={m} position={[0, 0.9, 0]} onClick={e => { e.stopPropagation(); onPick(a.id); }} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
        <icosahedronGeometry args={[0.42, 0]} /><meshStandardMaterial color={col} emissive={col} emissiveIntensity={busy ? 1.4 : 0.55} metalness={0.4} roughness={0.25} wireframe={!busy} />
      </mesh>
      <pointLight color={col} intensity={busy ? 6 : 2} distance={3} position={[0, 1, 0]} />
      <sprite position={[0, 1.95, 0]} scale={[2.3, 0.72, 1]}><spriteMaterial map={tex} transparent depthWrite={false} /></sprite>
    </group>
  );
}

function Link({ a, b, color, on }: { a: THREE.Vector3; b: THREE.Vector3; color: string; on: boolean }) {
  const geo = useMemo(() => new THREE.BufferGeometry().setFromPoints(curve(a, b).getPoints(40)), [a, b]);
  return <line><primitive object={geo} attach="geometry" /><lineBasicMaterial color={color} transparent opacity={on ? 0.95 : 0.3} /></line>;
}

function Packet({ from, to, color, born }: { from: THREE.Vector3; to: THREE.Vector3; color: string; born: number }) {
  const g = useRef<THREE.Group>(null!); const c = useMemo(() => curve(from, to), [from, to]);
  useFrame(() => { const t = Math.min(1, (performance.now() - born) / 2400); g.current.position.copy(c.getPoint(t)); g.current.visible = t < 1; });
  return <group ref={g}><mesh><octahedronGeometry args={[0.2]} /><meshBasicMaterial color="#ffffff" /></mesh><mesh><sphereGeometry args={[0.38, 16, 16]} /><meshBasicMaterial color={color} transparent opacity={0.35} /></mesh><pointLight color={color} intensity={8} distance={3} /></group>;
}

function Core({ busy }: { busy: boolean }) {
  const g = useRef<THREE.Group>(null!);
  useFrame((_, dt) => { g.current.rotation.y += dt * 0.4; g.current.rotation.x += dt * 0.1; });
  return (
    <group position={[0, 1.2, 0]}>
      <mesh><sphereGeometry args={[0.9, 32, 32]} /><meshStandardMaterial color="#0a2a66" emissive="#1e7dff" emissiveIntensity={busy ? 1.2 : 0.6} metalness={0.9} roughness={0.2} /></mesh>
      <group ref={g}>
        <mesh><icosahedronGeometry args={[1.25, 1]} /><meshBasicMaterial color="#22e4ff" wireframe transparent opacity={0.45} /></mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.6, 0.02, 8, 100]} /><meshBasicMaterial color="#22e4ff" /></mesh>
        <mesh rotation={[0.6, 0.4, 0]}><torusGeometry args={[1.85, 0.015, 8, 100]} /><meshBasicMaterial color="#3d7bff" /></mesh>
      </group>
      <pointLight color="#22c8ff" intensity={20} distance={10} />
    </group>
  );
}

const FLOW: [string, string][] = [['01', '02'], ['02', '03'], ['03', '04'], ['04', '06'], ['06', '05'], ['03', '07'], ['07', '04']];

export default function Workflow3D({ agents, tasks, packets, quality, reduced, onPick }: { agents: Agent[]; tasks: Task[]; packets: { id: number; from: string; to: string; demo: boolean }[]; quality: number; reduced: boolean; onPick: (id: string) => void }) {
  const P = useMemo(() => Object.fromEntries(agents.map((a, i) => [a.id, pos(i, agents.length)])), [agents]);
  const born = useRef<Record<number, number>>({});
  packets.forEach(p => { if (!born.current[p.id]) born.current[p.id] = performance.now(); });
  const busy = new Set(tasks.filter(t => t.status === 'running').map(t => t.agentId));
  const failed = new Set(tasks.filter(t => t.status === 'failed').map(t => t.agentId));
  const color = (id: string) => agents.find(a => a.id === id)?.color || '#22e4ff';
  const center = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  if (!agents.length) return null;
  return (
    <Canvas dpr={quality > 1 ? [1, 2] : [1, 1.25]} camera={{ position: [0, 7.5, 12.5], fov: 45 }} gl={{ antialias: quality > 1, alpha: true }} frameloop={reduced ? 'demand' : 'always'}>
      <ambientLight intensity={0.35} />
      <Controls reduced={reduced} />
      <gridHelper args={[24, 48, '#1a4f9a', '#0b2148']} position={[0, -0.05, 0]} />
      <Core busy={busy.size > 0} />
      {agents.map(a => <Link key={'c' + a.id} a={center} b={P[a.id]} color={a.color} on={busy.has(a.id)} />)}
      {FLOW.filter(([x, y]) => P[x] && P[y]).map(([x, y]) => <Link key={x + y} a={P[x]} b={P[y]} color="#8fdcff" on={packets.some(p => p.from === x && p.to === y)} />)}
      {agents.map(a => <Station key={a.id} a={a} p={P[a.id]} busy={busy.has(a.id)} failed={failed.has(a.id)} count={tasks.filter(t => t.agentId === a.id && !['done', 'stopped'].includes(t.status)).length} onPick={onPick} />)}
      {packets.filter(p => P[p.from] && P[p.to]).map(p => <Packet key={p.id} from={P[p.from]} to={P[p.to]} color={color(p.to)} born={born.current[p.id]} />)}
    </Canvas>
  );
}
