import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { soundFx } from '../../lib/soundFx';

/**
 * RobotTerminal - Authentic 1:1 Three.js 3D Robot Character
 * Replicates the Junca Studio WebGL 3D robot bust:
 * - Real 3D GLTF/DRACO model with decoupled head pivot tracking mouse cursor
 * - Realistic PBR materials (anodized crimson case, chrome neck, matte fan, CRT glass)
 * - Dynamic CRT Canvas screen with live phosphor terminal telemetry
 * - Smoothly spinning turbine fan blades inside recessed cowl
 * - Directional crimson studio lighting and EXR environment reflections
 * - Resilient CSS 3D fallback for headless/jsdom or environments without WebGL
 */
/**
 * Engaging cinematic sci-fi storytelling script for Tony (assistant robot).
 * Streams word-by-word with retro terminal CRT phosphor beam glow.
 */
const TONY_STORY_LINES: string[] = [
  "Welcome to Iunoware Academy!",
  "Hi, I'm Tony, your AI assistant robot.",
  "Master video editing & creative production with intensive sprints.",
  "Get 1-on-1 mentorship and <24h SLA feedback on your cuts.",
  "Multi-cohort concurrent learning powered by Supabase & React 19.",
  "Secure your industry career with verifiable digital credentials.",
  "Let's build your dream portfolio together!"
];

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

export const RobotTerminal: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isVisibleRef = useRef(true);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Mouse tracking state
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0, active: false });
  const [rpm, setRpm] = useState(1240);
  const rpmRef = useRef(1240);
  const fanSpeedRef = useRef(1.0);
  const [uptimeSeconds, setUptimeSeconds] = useState(160);
  const uptimeSecondsRef = useRef(160);

  // Fallback CSS 3D head transform states (used when WebGL is unavailable)
  const [fallbackTransform, setFallbackTransform] = useState({
    yaw: 0,
    pitch: 0,
    roll: 0,
    glareX: 0,
    glareY: 0,
    torsoYaw: 0,
    torsoPitch: 0,
  });

  const resumeRef = useRef<(() => void) | null>(null);
  const pauseRef = useRef<(() => void) | null>(null);

  // Storytelling typewriter state
  const [displayedText, setDisplayedText] = useState(TONY_STORY_LINES[0].split(' ')[0]);
  const displayedTextRef = useRef(TONY_STORY_LINES[0].split(' ')[0]);
  const clickReactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cinematic word-by-word movie dialogue typewriter animation
  useEffect(() => {
    let lineIdx = 0;
    let wordIdx = 1;
    let timerId: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (!isVisibleRef.current || document.hidden) {
        timerId = setTimeout(tick, 400);
        return;
      }

      const words = TONY_STORY_LINES[lineIdx].split(' ');
      if (wordIdx <= words.length) {
        const text = words.slice(0, wordIdx).join(' ');
        displayedTextRef.current = text;
        setDisplayedText(text);

        if (wordIdx === words.length) {
          // Entire line revealed, pause to let user read
          wordIdx = 1;
          lineIdx = (lineIdx + 1) % TONY_STORY_LINES.length;
          timerId = setTimeout(tick, 2600);
        } else {
          wordIdx++;
          // Movie-style word-by-word typing cadence
          timerId = setTimeout(tick, 240);
        }
      }
    };

    timerId = setTimeout(tick, 240);

    return () => {
      clearTimeout(timerId);
      if (clickReactionTimeoutRef.current) {
        clearTimeout(clickReactionTimeoutRef.current);
      }
    };
  }, []);

  // Suspend GPU / canvas work when offscreen
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          resumeRef.current?.();
        } else {
          pauseRef.current?.();
        }
      },
      { threshold: 0.05 }
    );
    if (containerRef.current) observer.observe(containerRef.current);

    const handleVisibilityChange = () => {
      if (!document.hidden && isVisibleRef.current) {
        resumeRef.current?.();
      } else {
        pauseRef.current?.();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    // 0. Pre-flight check: ensure WebGL is supported
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
      if (!gl) {
        setHasError(true);
        return;
      }
    } catch {
      setHasError(true);
      return;
    }

    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let disposed = false;
    let animId = 0;
    let renderer: THREE.WebGLRenderer | null = null;
    let dracoLoader: DRACOLoader | null = null;
    let screenTexture: THREE.CanvasTexture | null = null;
    let lightMapTex: THREE.Texture | null = null;
    let aoTex: THREE.Texture | null = null;
    const createdMaterials: THREE.Material[] = [];

    try {
      // 1. Three.js Scene, Camera, Renderer
      const scene = new THREE.Scene();

      const width = container.clientWidth || 480;
      const height = container.clientHeight || 560;

      const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 50);

      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      // 2. Studio Lighting (Front view orientation)
      const ambientLight = new THREE.AmbientLight(0x2a0808, 1.8);
      scene.add(ambientLight);

      // Strong crimson key / rim light from viewer's left
      const redRimLight = new THREE.DirectionalLight(0xff2222, 5.0);
      redRimLight.position.set(0.5, 1.8, 2.5);
      scene.add(redRimLight);

      // Warm top highlight for the beveled canopy
      const topLight = new THREE.DirectionalLight(0xff6644, 2.5);
      topLight.position.set(1.5, 3.5, 0.0);
      scene.add(topLight);

      // Subtle front-right fill light for the metallic body
      const fillLight = new THREE.DirectionalLight(0xffffff, 1.2);
      fillLight.position.set(2.0, 0.8, -1.8);
      scene.add(fillLight);

      // 3. Dynamic CRT Canvas Texture for the Terminal Screen (Exact 1.6:1 Aspect Ratio matching screen visor)
      const screenCanvas = document.createElement('canvas');
      screenCanvas.width = 640;
      screenCanvas.height = 400;
      const sCtx = screenCanvas.getContext('2d');

      screenTexture = new THREE.CanvasTexture(screenCanvas);
      screenTexture.colorSpace = THREE.SRGBColorSpace;
      screenTexture.minFilter = THREE.LinearFilter;
      screenTexture.magFilter = THREE.LinearFilter;
      screenTexture.flipY = true;

      const updateScreenCanvas = (timeSec: number) => {
        if (!sCtx) return;

        // Dark CRT glass background
        sCtx.fillStyle = '#060204';
        sCtx.fillRect(0, 0, 640, 400);

        // CRT phosphor glow gradient
        const radGlow = sCtx.createRadialGradient(320, 200, 30, 320, 200, 360);
        radGlow.addColorStop(0, 'rgba(239, 68, 68, 0.22)');
        radGlow.addColorStop(0.55, 'rgba(185, 28, 28, 0.08)');
        radGlow.addColorStop(1, 'rgba(0, 0, 0, 0.98)');
        sCtx.fillStyle = radGlow;
        sCtx.fillRect(0, 0, 640, 400);

        // 4px Phosphor CRT Scanlines
        sCtx.fillStyle = 'rgba(239, 68, 68, 0.04)';
        for (let y = 0; y < 400; y += 4) {
          sCtx.fillRect(0, y, 640, 2);
        }

        const blink = Math.floor(timeSec * 2.5) % 2 === 0;
        const currentText = displayedTextRef.current;

        // Centered story text with authentic CRT Phosphor Beam Glow & multi-line wrapping
        sCtx.save();
        sCtx.textAlign = 'center';
        sCtx.textBaseline = 'middle';
        sCtx.font = '900 30px monospace';

        const lines = wrapCanvasText(sCtx, currentText, 540);
        const lineHeight = 44;
        const totalHeight = lines.length * lineHeight;
        const startY = 200 - totalHeight / 2 + lineHeight / 2;

        lines.forEach((line, index) => {
          const isLastLine = index === lines.length - 1;
          const lineText = isLastLine ? line + (blink ? '_' : ' ') : line;
          const y = startY + index * lineHeight;

          // Outer CRT Phosphor Glow
          sCtx.shadowColor = 'rgba(239, 68, 68, 0.95)';
          sCtx.shadowBlur = 22;
          sCtx.fillStyle = '#ff4444';
          sCtx.fillText(lineText, 320, y);

          // Core bright beam text for high-contrast visibility
          sCtx.shadowBlur = 0;
          sCtx.fillStyle = '#ffffff';
          sCtx.fillText(lineText, 320, y);
        });

        sCtx.restore();

        if (screenTexture) {
          screenTexture.needsUpdate = true;
        }
      };

      // 4. Setup DRACO and GLTFLoader
      dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('/draco/');

      const gltfLoader = new GLTFLoader();
      gltfLoader.setDRACOLoader(dracoLoader);

      // Texture loaders for lightmap & AO
      const texLoader = new THREE.TextureLoader();
      lightMapTex = texLoader.load('/robot/junca_lightmap_1024.webp');
      lightMapTex.colorSpace = THREE.SRGBColorSpace;
      lightMapTex.channel = 1;
      lightMapTex.flipY = false;

      aoTex = texLoader.load('/robot/junca_ao.webp');
      aoTex.flipY = false;

      // EXR Environment Loader
      const exrLoader = new EXRLoader();
      exrLoader.load(
        '/robot/env_256.exr',
        (texture) => {
          if (disposed) {
            texture.dispose();
            return;
          }
          texture.mapping = THREE.EquirectangularReflectionMapping;
          scene.environment = texture;
        },
        undefined,
        () => {
          // EXR optional
        }
      );

      // Model groups & references
      const robotRoot = new THREE.Group();
      const headPivot = new THREE.Group();
      const bodyPivot = new THREE.Group();
      robotRoot.add(bodyPivot);
      robotRoot.add(headPivot);
      scene.add(robotRoot);

      let fanBladesMesh: THREE.Object3D | null = null;

      // Materials map matching Junca Studio's visual shaders
      const materials: Record<string, THREE.Material> = {
        mat_case_alu: new THREE.MeshStandardMaterial({
          name: 'mat_case_alu',
          color: new THREE.Color(0x3a0c0c),
          metalness: 0.85,
          roughness: 0.38,
          lightMap: lightMapTex,
          lightMapIntensity: 0.9,
          aoMap: aoTex,
          aoMapIntensity: 0.4,
          side: THREE.DoubleSide,
        }),
        mat_case_anod: new THREE.MeshStandardMaterial({
          name: 'mat_case_anod',
          color: new THREE.Color(0x8a1818),
          metalness: 0.92,
          roughness: 0.5,
          lightMap: lightMapTex,
          lightMapIntensity: 0.9,
          side: THREE.DoubleSide,
        }),
        mat_chrome: new THREE.MeshStandardMaterial({
          name: 'mat_chrome',
          color: new THREE.Color(0xb5bcc8),
          metalness: 1.0,
          roughness: 0.05,
          side: THREE.DoubleSide,
        }),
        mat_fan: new THREE.MeshStandardMaterial({
          name: 'mat_fan',
          color: new THREE.Color(0x22242a),
          metalness: 0.9,
          roughness: 0.42,
        }),
        Screen: new THREE.MeshBasicMaterial({
          name: 'Screen',
          map: screenTexture,
        }),
        ScreenGlow: new THREE.MeshBasicMaterial({
          name: 'ScreenGlow',
          color: new THREE.Color(0xff3333),
          transparent: true,
          opacity: 0.15,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
        mat_glass: new THREE.MeshPhysicalMaterial({
          name: 'mat_glass',
          color: new THREE.Color(0x180505),
          metalness: 0.05,
          roughness: 0.08,
          transmission: 0.85,
          transparent: true,
          opacity: 0.35,
          clearcoat: 1.0,
          clearcoatRoughness: 0.03,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
        LED_pwr: new THREE.MeshStandardMaterial({
          name: 'LED_pwr',
          color: new THREE.Color(0xff7700),
          emissive: new THREE.Color(0xff5500),
          emissiveIntensity: 3.5,
        }),
      };

      Object.values(materials).forEach((m) => createdMaterials.push(m));

      const headNodes = new Set([
        'Cube_Plate',
        'Cube_Plate.001',
        'Cube_Plate_Piece.001',
        'Slice.004',
        'Slice.006',
        'Slice.007',
        'Slice.008',
      ]);

      const normalizeScreenUvs = (geom: THREE.BufferGeometry) => {
        const uv = geom.attributes.uv;
        if (!uv) return;
        let minU = Infinity, maxU = -Infinity;
        let minV = Infinity, maxV = -Infinity;
        for (let i = 0; i < uv.count; i++) {
          const u = uv.getX(i);
          const v = uv.getY(i);
          if (u < minU) minU = u;
          if (u > maxU) maxU = u;
          if (v < minV) minV = v;
          if (v > maxV) maxV = v;
        }
        const rangeU = maxU - minU;
        const rangeV = maxV - minV;
        if (rangeU > 0.0001 && rangeV > 0.0001) {
          const newUv = uv.clone();
          for (let i = 0; i < newUv.count; i++) {
            const u = newUv.getX(i);
            const v = newUv.getY(i);
            const normU = (u - minU) / rangeU;
            const normV = 1.0 - (v - minV) / rangeV;
            newUv.setXY(i, normU, normV);
          }
          geom.setAttribute('uv', newUv);
          newUv.needsUpdate = true;
        }
      };

      gltfLoader.load(
        '/robot/junca_robot.glb',
        (gltf) => {
          if (disposed) return;

          // Apply tailored materials and lightmaps to each mesh
          gltf.scene.traverse((obj) => {
            if ((obj as THREE.Mesh).isMesh) {
              const mesh = obj as THREE.Mesh;
              if (Array.isArray(mesh.material)) {
                let hasScreen = false;
                mesh.material = mesh.material.map((m) => {
                  if (m?.name === 'Screen') {
                    hasScreen = true;
                    return materials.Screen;
                  }
                  if (m?.name && materials[m.name]) return materials[m.name];
                  if (m?.name?.toLowerCase().includes('glass')) return materials.mat_glass;
                  return m;
                });
                if (hasScreen && mesh.geometry) {
                  normalizeScreenUvs(mesh.geometry);
                }
              } else {
                const matName = mesh.material?.name;
                if (matName === 'Screen') {
                  mesh.material = materials.Screen;
                  if (mesh.geometry) {
                    normalizeScreenUvs(mesh.geometry);
                  }
                } else if (matName && materials[matName]) {
                  mesh.material = materials[matName];
                } else if (mesh.name.toLowerCase().includes('glass')) {
                  mesh.material = materials.mat_glass;
                } else if (mesh.name === 'fan_blades') {
                  mesh.material = materials.mat_fan;
                } else if (mesh.name === 'Cylinder' || mesh.name === 'Cou') {
                  mesh.material = materials.mat_chrome;
                } else if (mesh.name.includes('LED')) {
                  mesh.material = materials.LED_pwr;
                } else {
                  mesh.material = materials.mat_case_alu;
                }
              }
            }

            if (obj.name === 'fan_blades') {
              fanBladesMesh = obj;
            }
          });

          // Compute neck center dynamically to pin the head pivot exactly on the neck cylinder
          const neckCenter = new THREE.Vector3(0.105, 0.498, -0.129);
          const couObj = gltf.scene.getObjectByName('Cou');
          if (couObj) {
            const couBox = new THREE.Box3().setFromObject(couObj);
            couBox.getCenter(neckCenter);
            neckCenter.y = couBox.max.y;
          }

          const headObjects: THREE.Object3D[] = [];
          const bodyObjects: THREE.Object3D[] = [];

          gltf.scene.children.slice().forEach((child) => {
            // Remove the tail-like card protruding from the back side
            if (
              child.name === 'Plate 2' ||
              child.name.includes('Plate 2') ||
              child.name === 'Cutter.006_Plate'
            ) {
              child.visible = false;
              if (child.parent) {
                child.parent.remove(child);
              }
              return;
            }

            const box = new THREE.Box3().setFromObject(child);
            const center = new THREE.Vector3();
            box.getCenter(center);
            const isHead =
              headNodes.has(child.name) ||
              child.name.startsWith('Cube_Plate') ||
              child.name.startsWith('Slice.00') ||
              center.y > 0.495;

            if (isHead && child.name !== 'Cou') {
              headObjects.push(child);
            } else {
              bodyObjects.push(child);
            }
          });

          headPivot.position.copy(neckCenter);

          headObjects.forEach((obj) => {
            obj.position.sub(neckCenter);
            headPivot.add(obj);
          });

          bodyObjects.forEach((obj) => {
            bodyPivot.add(obj);
          });

          // Center overall robot model in view and scale up for imposing hero presence
          robotRoot.scale.setScalar(1.30);
          const totalBox = new THREE.Box3().setFromObject(robotRoot);
          const totalCenter = new THREE.Vector3();
          totalBox.getCenter(totalCenter);

          robotRoot.position.x = -totalCenter.x;
          robotRoot.position.y = -totalCenter.y - 0.014;
          robotRoot.position.z = -totalCenter.z;

          // Position camera closer at a dynamic 3/4 studio angle for a much larger, bolder character presence
          camera.position.set(0.44, 0.012, 0.075);
          camera.lookAt(0, -0.005, 0);

          setIsReady(true);
        },
        undefined,
        (err) => {
          console.warn('WebGL GLTF load failed, using CSS 3D fallback:', err);
          setHasError(true);
        }
      );

      // 5. Mouse & Touch Interaction Physics Lerp Loop
      const handleMouseMove = (e: MouseEvent) => {
        const { innerWidth, innerHeight } = window;
        const nx = (e.clientX / innerWidth - 0.5) * 2;
        const ny = (e.clientY / innerHeight - 0.5) * 2;
        mouseRef.current.targetX = nx;
        mouseRef.current.targetY = ny;
        mouseRef.current.active = true;
      };

      const handleMouseLeave = () => {
        mouseRef.current.active = false;
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (!e.touches[0]) return;
        const touch = e.touches[0];
        const { innerWidth, innerHeight } = window;
        const nx = (touch.clientX / innerWidth - 0.5) * 2;
        const ny = (touch.clientY / innerHeight - 0.5) * 2;
        mouseRef.current.targetX = nx;
        mouseRef.current.targetY = ny;
        mouseRef.current.active = true;
      };

      const handleTouchEnd = () => {
        mouseRef.current.active = false;
      };

      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      document.addEventListener('mouseleave', handleMouseLeave);
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('touchend', handleTouchEnd, { passive: true });
      window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

      let lastTime = performance.now();
      let currentHeadYaw = 0;
      let currentHeadPitch = 0;
      let currentHeadRoll = 0;
      let currentBodyYaw = 0;
      let currentBodyPitch = 0;

      // Telemetry tickers: only update when visible and in viewport
      const intervalId = setInterval(() => {
        if (!isVisibleRef.current || document.hidden) return;
        const baseSpeed = fanSpeedRef.current;
        const nextRpm = Math.round(1240 * baseSpeed + (Math.random() * 30 - 15));
        rpmRef.current = nextRpm;
        setRpm(nextRpm);
        uptimeSecondsRef.current += 1;
        setUptimeSeconds((prev) => prev + 1);
      }, 1000);

      let isRunning = false;

      const startLoop = () => {
        if (disposed || isRunning || !isVisibleRef.current || document.hidden) return;
        isRunning = true;
        lastTime = performance.now();
        animId = requestAnimationFrame(animate);
      };

      const stopLoop = () => {
        isRunning = false;
        if (animId) {
          cancelAnimationFrame(animId);
          animId = 0;
        }
      };

      resumeRef.current = startLoop;
      pauseRef.current = stopLoop;

      const animate = (time: number) => {
        if (disposed || !isRunning) return;

        if (!isVisibleRef.current || document.hidden) {
          stopLoop();
          return;
        }

        const delta = Math.min((time - lastTime) * 0.001, 0.05);
        lastTime = time;

        // Mouse Lerp with fluid, responsive tracking
        const lerpFactor = 0.10;
        mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * lerpFactor;
        mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * lerpFactor;

        let targetYaw: number;
        let targetPitch: number;
        let targetRoll: number;

        if (mouseRef.current.active) {
          // Expressive 360-degree omnidirectional cursor tracking for the display head
          targetYaw = mouseRef.current.x * 0.82;
          targetPitch = -mouseRef.current.y * 0.52;
          targetRoll = -mouseRef.current.x * 0.15;
        } else {
          const elapsed = time * 0.001;
          targetYaw = Math.sin(elapsed * 0.8) * 0.16;
          targetPitch = Math.cos(elapsed * 1.1) * 0.08;
          targetRoll = Math.sin(elapsed * 0.6) * 0.04;
        }

        currentHeadYaw += (targetYaw - currentHeadYaw) * 0.10;
        currentHeadPitch += (targetPitch - currentHeadPitch) * 0.10;
        currentHeadRoll += (targetRoll - currentHeadRoll) * 0.10;

        // Torso stays grounded with subtle, organic micro-reaction
        currentBodyYaw += (targetYaw * 0.12 - currentBodyYaw) * 0.06;
        currentBodyPitch += (targetPitch * 0.08 - currentBodyPitch) * 0.06;

        // Euler rotation order 'YZX': Yaw (left/right around neck Y), Pitch (nod up/down around Z), Roll (tilt around X)
        headPivot.rotation.set(currentHeadRoll, currentHeadYaw, currentHeadPitch, 'YZX');
        bodyPivot.rotation.set(0, currentBodyYaw, currentBodyPitch, 'YZX');

        // Spin fan blades smoothly
        if (fanBladesMesh) {
          fanBladesMesh.rotation.x -= fanSpeedRef.current * 4.2 * delta;
        }

        // Refresh CRT Canvas
        updateScreenCanvas(time * 0.001);

        renderer?.render(scene, camera);
        animId = requestAnimationFrame(animate);
      };

      startLoop();

      // Resize handler
      const handleResize = () => {
        if (!container || disposed || !renderer) return;
        const w = container.clientWidth || 480;
        const h = container.clientHeight || 560;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };

      window.addEventListener('resize', handleResize);

      return () => {
        disposed = true;
        stopLoop();
        if (resumeRef.current === startLoop) resumeRef.current = null;
        if (pauseRef.current === stopLoop) pauseRef.current = null;
        clearInterval(intervalId);
        window.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseleave', handleMouseLeave);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
        window.removeEventListener('touchcancel', handleTouchEnd);
        window.removeEventListener('resize', handleResize);

        dracoLoader?.dispose();
        renderer?.dispose();
        screenTexture?.dispose();
        lightMapTex?.dispose();
        aoTex?.dispose();
        createdMaterials.forEach((m) => m.dispose());
      };
    } catch (err) {
      console.warn('WebGL initialization failed, falling back to CSS 3D:', err);
      setHasError(true);
    }
  }, []);

  // Fallback interactive animation loop when WebGL is unavailable
  useEffect(() => {
    if (!hasError) return;

    let animId: number;
    let disposed = false;
    let isRunning = false;
    let targetX = 0;
    let targetY = 0;
    let currX = 0;
    let currY = 0;

    const startFallbackLoop = () => {
      if (disposed || isRunning || !isVisibleRef.current || document.hidden) return;
      isRunning = true;
      animId = requestAnimationFrame(animateFallback);
    };

    const stopFallbackLoop = () => {
      isRunning = false;
      if (animId) {
        cancelAnimationFrame(animId);
        animId = 0;
      }
    };

    resumeRef.current = startFallbackLoop;
    pauseRef.current = stopFallbackLoop;

    const handleMouseMove = (e: MouseEvent) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!e.touches[0]) return;
      const touch = e.touches[0];
      targetX = (touch.clientX / window.innerWidth - 0.5) * 2;
      targetY = (touch.clientY / window.innerHeight - 0.5) * 2;
    };

    const handleTouchEnd = () => {
      targetX = 0;
      targetY = 0;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    const animateFallback = () => {
      if (disposed || !isRunning) return;

      if (!isVisibleRef.current || document.hidden) {
        stopFallbackLoop();
        return;
      }

      currX += (targetX - currX) * 0.08;
      currY += (targetY - currY) * 0.08;

      setFallbackTransform({
        yaw: currX * 38 + 6,
        pitch: -currY * 26,
        roll: -currX * 6,
        glareX: -currX * 20,
        glareY: -currY * 20,
        torsoYaw: currX * 5 + 2,
        torsoPitch: -currY * 3,
      });

      animId = requestAnimationFrame(animateFallback);
    };

    startFallbackLoop();

    const fallbackIntervalId = setInterval(() => {
      if (!isVisibleRef.current || document.hidden) return;
      const baseSpeed = fanSpeedRef.current;
      const nextRpm = Math.round(1240 * baseSpeed + (Math.random() * 30 - 15));
      rpmRef.current = nextRpm;
      setRpm(nextRpm);
      setUptimeSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      disposed = true;
      stopFallbackLoop();
      if (resumeRef.current === startFallbackLoop) resumeRef.current = null;
      if (pauseRef.current === stopFallbackLoop) pauseRef.current = null;
      clearInterval(fallbackIntervalId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [hasError]);

  const handleClick = () => {
    soundFx.playSweep(260, 720, 0.12, 0.06);
    fanSpeedRef.current = 2.4;
    const boostRpm = 2840;
    rpmRef.current = boostRpm;
    setRpm(boostRpm);

    if (clickReactionTimeoutRef.current) {
      clearTimeout(clickReactionTimeoutRef.current);
    }

    clickReactionTimeoutRef.current = setTimeout(() => {
      fanSpeedRef.current = 1.0;
      clickReactionTimeoutRef.current = null;
    }, 1800);
  };

  const uptimeMins = Math.floor(uptimeSeconds / 60);
  const uptimeSecs = uptimeSeconds % 60;
  const uptimeDisplay = `${uptimeMins}:${uptimeSecs.toString().padStart(2, '0')}`;

  return (
    <div
      ref={containerRef}
      data-cursor="ROBOT"
      onClick={handleClick}
      onMouseEnter={() => soundFx.playBlip(540, 0.03, 'sine', 0.03)}
      className="relative w-[280px] min-[380px]:w-[320px] sm:w-[420px] md:w-[540px] lg:w-[680px] xl:w-[820px] 2xl:w-[960px] h-[320px] min-[380px]:h-[360px] sm:h-[480px] md:h-[600px] lg:h-[760px] xl:h-[900px] 2xl:h-[1020px] max-h-[96vh] max-w-[92vw] lg:max-w-[55vw] flex items-center justify-center select-none pointer-events-auto cursor-pointer"
    >
      {/* ================= VOLUMETRIC CRIMSON BACKGROUND NEBULA ================= */}
      <div className="pointer-events-none absolute -inset-28 -z-10 overflow-hidden">
        {/* Deep ambient red smoke core */}
        <div className="absolute top-1/4 right-0 w-[860px] h-[860px] rounded-full bg-gradient-to-br from-red-600/40 via-red-950/30 to-transparent blur-[160px]" />
        {/* Soft upper crimson fog plume */}
        <div className="absolute -top-16 right-1/4 w-[640px] h-[640px] rounded-full bg-red-700/25 blur-[180px]" />
        {/* Subtle orange accent glow */}
        <div className="absolute bottom-8 right-8 w-[500px] h-[500px] rounded-full bg-orange-600/15 blur-[140px]" />
      </div>

      {/* Real Three.js WebGL Canvas */}
      {!hasError ? (
        <>
          <canvas
            ref={canvasRef}
            className={`size-full transition-opacity duration-700 ${
              isReady ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {!isReady && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="size-16 rounded-full border-2 border-red-500/20 border-t-red-500 animate-spin" />
            </div>
          )}
        </>
      ) : (
        /* ================= CSS 3D HIGH-FIDELITY FALLBACK ================= */
        <div
          className="relative w-full h-full flex flex-col items-center justify-end pb-8"
          style={{ perspective: 1200 }}
        >
          {/* Fallback Head */}
          <div
            className="relative z-30 mb-[-12px] will-change-transform"
            style={{
              transformStyle: 'preserve-3d',
              transformOrigin: '50% 120%',
              transform: `rotateX(${fallbackTransform.pitch}deg) rotateY(${fallbackTransform.yaw}deg) rotateZ(${fallbackTransform.roll}deg)`,
            }}
          >
            <div className="relative w-[280px] min-[380px]:w-[340px] sm:w-[440px] lg:w-[500px]">
              {/* Canopy */}
              <div className="relative mx-auto w-[92%] h-[44px] rounded-t-2xl bg-gradient-to-b from-[#2a2c33] via-[#1c1d22] to-[#121316] border-t border-white/20 px-6 flex items-center justify-between">
                <span className="size-1.5 rounded-full bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
                <div className="h-1.5 w-16 rounded-full bg-[#0a0a0c] border border-white/10" />
              </div>
              {/* Housing */}
              <div className="relative w-full h-[290px] sm:h-[330px] rounded-2xl bg-[#141518] shadow-[0_25px_60px_rgba(0,0,0,0.95)] border border-white/10 p-2.5 flex items-center justify-center">
                {/* Silver cheek */}
                <div className="absolute -left-3.5 top-4 bottom-4 w-5 bg-gradient-to-r from-[#5a5e69] via-[#3d414a] to-[#25272e] rounded-l-md border-l border-white/30" />
                {/* Screen */}
                <div
                  className="relative size-full rounded-xl bg-[#060204] p-4 border-2 border-[#20222a] flex items-center justify-center overflow-hidden shadow-[inset_0_0_35px_rgba(239,68,68,0.28)]"
                  style={{ clipPath: 'polygon(2% 0%, 98% 0%, 95% 100%, 5% 100%)' }}
                >
                  {/* CRT Scanlines Overlay */}
                  <div
                    className="absolute inset-0 pointer-events-none opacity-40"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(0deg, rgba(239,68,68,0.06) 0px, rgba(239,68,68,0.06) 2px, transparent 2px, transparent 4px)',
                    }}
                  />
                  {/* CRT Radial Ambient Glow */}
                  <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.22)_0%,rgba(185,28,28,0.06)_55%,transparent_85%)]" />

                  {/* Centered Friendly Terminal Message */}
                  <div className="relative z-10 flex flex-col items-center justify-center font-mono text-center px-4">
                    <p className="max-w-[90%] text-base sm:text-lg lg:text-xl font-black tracking-wide text-white drop-shadow-[0_0_16px_rgba(239,68,68,0.95)] leading-relaxed">
                      {displayedText}
                      <span className="text-red-500 animate-pulse inline-block ml-0.5">_</span>
                    </p>
                    <span className="sr-only">{uptimeDisplay} • {rpm} RPM</span>
                  </div>
                </div>
              </div>
              {/* Chin */}
              <div className="mx-auto w-[65%] h-[12px] rounded-b-xl bg-[#121316] border-x border-b border-white/10" />
            </div>
            {/* Neck */}
            <div className="mx-auto -mt-1 w-24 h-7 flex flex-col justify-between items-center py-1">
              <div className="w-24 h-2 rounded-full bg-gradient-to-r from-[#202228] via-[#8c919d] to-[#202228]" />
              <div className="w-26 h-2 rounded-full bg-[#141518]" />
            </div>
          </div>
          {/* Fallback Torso */}
          <div
            className="relative z-10 w-[280px] min-[380px]:w-[340px] sm:w-[500px] lg:w-[580px] h-[240px] sm:h-[320px] rounded-3xl bg-gradient-to-b from-[#18191e] via-[#111215] to-[#08080a] border border-white/10 p-4 sm:p-6 flex flex-col justify-between"
            style={{
              transform: `rotateX(${fallbackTransform.torsoPitch}deg) rotateY(${fallbackTransform.torsoYaw}deg)`,
            }}
          >
            <div className="flex items-center justify-between">
              {/* Fan */}
              <div className="relative size-28 rounded-full bg-[#08080a] border-2 border-[#2b2d36] p-1 flex items-center justify-center">
                <div className="size-full animate-spin duration-3000">
                  <svg viewBox="0 0 100 100" className="size-full">
                    <circle cx="50" cy="50" r="12" fill="#180b0b" stroke="#ef4444" strokeWidth="1" />
                    <path
                      d="M50 50 C 58 30, 52 10, 36 2 C 58 0, 78 18, 72 38 Z"
                      fill="#3a1212"
                      stroke="#ef4444"
                      strokeWidth="0.5"
                    />
                    <path
                      d="M50 50 C 58 30, 52 10, 36 2 C 58 0, 78 18, 72 38 Z"
                      transform="rotate(120 50 50)"
                      fill="#3a1212"
                      stroke="#ef4444"
                      strokeWidth="0.5"
                    />
                    <path
                      d="M50 50 C 58 30, 52 10, 36 2 C 58 0, 78 18, 72 38 Z"
                      transform="rotate(240 50 50)"
                      fill="#3a1212"
                      stroke="#ef4444"
                      strokeWidth="0.5"
                    />
                  </svg>
                </div>
              </div>
              {/* LED */}
              <div className="h-3 w-16 rounded-sm bg-gradient-to-r from-orange-600 to-amber-500 shadow-[0_0_12px_rgba(249,115,22,0.8)]" />
            </div>
            <div className="pt-3 border-t border-white/5 flex justify-between text-[9px] text-red-500/70 font-mono">
              <span>ACTIVE</span>
              <span>REV 2.06</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
