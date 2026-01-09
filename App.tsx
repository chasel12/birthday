
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// --- 配置区 ---
const CORE_PARTICLES = 8500;
const BACKGROUND_PARTICLES = 20000;
const TOTAL_PARTICLES = CORE_PARTICLES + BACKGROUND_PARTICLES;
const BLOW_THRESHOLD = 45; 
// 在此处替换您的 MP3 文件链接
const BGM_URL = '../bgm.MP3'; 

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [mode, setMode] = useState<'IDLE' | 'CAKE' | 'TEXT'>('IDLE');
  const [audioLevel, setAudioLevel] = useState(0);

  // 动画与物理引用
  const targetsRef = useRef<Float32Array>(new Float32Array(TOTAL_PARTICLES * 3));
  const lerpSpeedsRef = useRef<Float32Array>(new Float32Array(TOTAL_PARTICLES));
  const particleColorsRef = useRef<Float32Array>(new Float32Array(TOTAL_PARTICLES * 3));
  const modeRef = useRef<'IDLE' | 'CAKE' | 'TEXT' | 'TRANSITION'>('IDLE');

  // 麦克风引用
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // 初始化交互：音乐 + 麦克风
  const startInteraction = async () => {
    try {
      // 1. 播放音乐
      if (!audioRef.current) {
        audioRef.current = new Audio(BGM_URL);
        audioRef.current.loop = true;
      }
      audioRef.current.play().catch(e => console.log("Audio play deferred", e));

      // 2. 开启麦克风
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      
      setMode('CAKE');
      modeRef.current = 'CAKE';
      generateCakeTargets();
    } catch (err) {
      console.warn("Mic access denied, switching to click-only mode.");
      setMode('CAKE');
      modeRef.current = 'CAKE';
      generateCakeTargets();
    }
  };

  const generateCakeTargets = () => {
    const pCount = CORE_PARTICLES;
    const t1 = Math.floor(pCount * 0.4);
    const t2 = Math.floor(pCount * 0.25);
    const t3 = Math.floor(pCount * 0.2);
    const candle = pCount - t1 - t2 - t3;

    let pIdx = 0;
    const fill = (count: number, r: number, h: number, y: number, color: THREE.Color) => {
      for (let i = 0; i < count; i++, pIdx++) {
        const theta = Math.random() * Math.PI * 2;
        const curR = Math.sqrt(Math.random()) * r;
        targetsRef.current[pIdx * 3] = Math.cos(theta) * curR;
        targetsRef.current[pIdx * 3 + 1] = (Math.random() - 0.5) * h + y;
        targetsRef.current[pIdx * 3 + 2] = Math.sin(theta) * curR;
        particleColorsRef.current[pIdx * 3] = color.r;
        particleColorsRef.current[pIdx * 3 + 1] = color.g;
        particleColorsRef.current[pIdx * 3 + 2] = color.b;
      }
    };

    fill(t1, 5.0, 3.0, 0, new THREE.Color(0xff00a6)); // 底层粉
    fill(t2, 3.5, 2.5, 2.8, new THREE.Color(0x00d2ff)); // 中层蓝
    fill(t3, 2.2, 1.8, 4.8, new THREE.Color(0xffe600)); // 顶层黄
    fill(candle, 0.2, 1.4, 6.2, new THREE.Color(0xff2200)); // 烛火红
  };

  const generateTextTargets = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    canvas.width = 1024; canvas.height = 512;
    ctx.fillStyle = 'black'; ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 160px "Microsoft YaHei", sans-serif';
    ctx.fillText('祝郑璐', 512, 160);
    ctx.fillText('生日快乐', 512, 360);

    const data = ctx.getImageData(0, 0, 1024, 512).data;
    const pts: { x: number, y: number }[] = [];
    for (let y = 0; y < 512; y += 3) {
      for (let x = 0; x < 1024; x += 3) {
        if (data[(y * 1024 + x) * 4] > 128) {
          pts.push({ x: (x - 512) * 0.045, y: (256 - y) * 0.045 + 2 });
        }
      }
    }

    for (let i = 0; i < CORE_PARTICLES; i++) {
      const p = pts[Math.floor(Math.random() * pts.length)] || {x: 0, y: 0};
      targetsRef.current[i * 3] = p.x + (Math.random() - 0.5) * 0.1;
      targetsRef.current[i * 3 + 1] = p.y + (Math.random() - 0.5) * 0.1;
      targetsRef.current[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
      particleColorsRef.current[i * 3] = 1.0;
      particleColorsRef.current[i * 3 + 1] = 0.85;
      particleColorsRef.current[i * 3 + 2] = 1.0;
    }
  };

  const transform = () => {
    if (modeRef.current !== 'CAKE') return;
    modeRef.current = 'TRANSITION';
    for (let i = 0; i < CORE_PARTICLES; i++) {
      const ang = Math.random() * Math.PI * 2;
      const d = 15 + Math.random() * 15;
      targetsRef.current[i * 3] += Math.cos(ang) * d;
      targetsRef.current[i * 3 + 1] += (Math.random() - 0.5) * d;
      targetsRef.current[i * 3 + 2] += Math.sin(ang) * d;
      lerpSpeedsRef.current[i] = 0.01 + Math.random() * 0.02;
    }
    setTimeout(() => {
      generateTextTargets();
      for (let i = 0; i < CORE_PARTICLES; i++) {
        lerpSpeedsRef.current[i] = 0.04 + Math.random() * 0.06;
      }
      setMode('TEXT');
      modeRef.current = 'TEXT';
    }, 500);
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000103);
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 25);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.autoRotate = true; controls.autoRotateSpeed = 0.5;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.6, 0.5, 0.1));

    const geo = new THREE.BufferGeometry();
    const posArr = new Float32Array(TOTAL_PARTICLES * 3);
    const colArr = new Float32Array(TOTAL_PARTICLES * 3);

    for (let i = 0; i < TOTAL_PARTICLES; i++) {
      const i3 = i * 3;
      posArr[i3] = (Math.random() - 0.5) * 150;
      posArr[i3+1] = (Math.random() - 0.5) * 150;
      posArr[i3+2] = (Math.random() - 0.5) * 150;
      lerpSpeedsRef.current[i] = 0.03 + Math.random() * 0.05;

      if (i >= CORE_PARTICLES) {
        const r = 30 + Math.random() * 60;
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        targetsRef.current[i3] = r * Math.sin(ph) * Math.cos(th);
        targetsRef.current[i3+1] = r * Math.sin(ph) * Math.sin(th);
        targetsRef.current[i3+2] = r * Math.cos(ph);
        const color = new THREE.Color().setHSL(Math.random(), 0.8, 0.07);
        colArr[i3] = color.r; colArr[i3+1] = color.g; colArr[i3+2] = color.b;
      }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    const mat = new THREE.PointsMaterial({ size: 0.13, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    scene.add(new THREE.Points(geo, mat));

    const dataArray = new Uint8Array(128);
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);
        let s = 0; for (let i = 0; i < 20; i++) s += dataArray[i];
        const avg = s / 20;
        setAudioLevel(avg);
        if (avg > BLOW_THRESHOLD && modeRef.current === 'CAKE') transform();
      }
      const p = geo.attributes.position.array as Float32Array;
      const c = geo.attributes.color.array as Float32Array;
      for (let i = 0; i < TOTAL_PARTICLES; i++) {
        const i3 = i * 3;
        const spd = lerpSpeedsRef.current[i];
        p[i3] += (targetsRef.current[i3] - p[i3]) * spd;
        p[i3+1] += (targetsRef.current[i3+1] - p[i3+1]) * spd;
        p[i3+2] += (targetsRef.current[i3+2] - p[i3+2]) * spd;
        if (i < CORE_PARTICLES) {
          c[i3] += (particleColorsRef.current[i3] - c[i3]) * 0.05;
          c[i3+1] += (particleColorsRef.current[i3+1] - c[i3+1]) * 0.05;
          c[i3+2] += (particleColorsRef.current[i3+2] - c[i3+2]) * 0.05;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      composer.render();
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full relative overflow-hidden bg-black"
      onClick={() => mode === 'CAKE' && transform()}
    >
      {mode === 'IDLE' && (
        <div 
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl"
          onClick={(e) => { e.stopPropagation(); startInteraction(); }}
        >
          <button className="group relative px-12 py-5 overflow-hidden rounded-full bg-white/5 border border-white/20 transition-all hover:bg-white/10 active:scale-95">
             <div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 to-cyan-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
             <span className="relative text-white font-bold tracking-[0.4em] uppercase text-sm">点这点这这这</span>
          </button>
        </div>
      )}

      {/* 仅在吹气时显示的极简音量条 */}
      {mode === 'CAKE' && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-32 h-0.5 bg-white/5 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-cyan-400 to-pink-500 transition-all duration-75"
            style={{ width: `${Math.min((audioLevel / BLOW_THRESHOLD) * 100, 100)}%` }}
          ></div>
        </div>
      )}

      {/* 隐藏的装饰装饰边角 */}
      <div className="absolute inset-0 pointer-events-none border-[1px] border-white/5 m-4 rounded-3xl opacity-30"></div>
    </div>
  );
};

export default App;
