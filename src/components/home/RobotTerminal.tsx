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
export type RobotTerminalMode = 'sprint' | 'pipeline' | 'brief';

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
  const [terminalMode, setTerminalMode] = useState<RobotTerminalMode>('sprint');
  const terminalModeRef = useRef<RobotTerminalMode>('sprint');

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

      const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 50);

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

        const blink = Math.floor(timeSec * 2) % 2 === 0;
        const mins = Math.floor(uptimeSecondsRef.current / 60);
        const secs = uptimeSecondsRef.current % 60;
        const uptimeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        const mode = terminalModeRef.current;

        // Screen Header: Red semi-transparent frosted plate with 1px border
        const plateX = 36;
        const plateY = 24;
        const plateW = 568;
        const plateH = 44;

        sCtx.fillStyle = 'rgba(220, 38, 38, 0.18)';
        sCtx.fillRect(plateX, plateY, plateW, plateH);
        sCtx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
        sCtx.lineWidth = 1;
        sCtx.strokeRect(plateX, plateY, plateW, plateH);

        // Header Text & Mode Badge
        sCtx.textBaseline = 'middle';
        sCtx.font = 'bold 20px monospace';
        sCtx.fillStyle = '#ff4444';

        const headerTitle =
          mode === 'sprint'
            ? '> SPRINT OS'
            : mode === 'pipeline'
            ? '> STUDIO 4K'
            : '> DAILY BRIEF';

        sCtx.fillText(headerTitle + (blink ? '_' : ' '), plateX + 16, plateY + plateH / 2);

        sCtx.textAlign = 'right';
        sCtx.font = 'bold 16px monospace';
        sCtx.fillStyle = '#fca5a5';
        const modeBadge = mode === 'sprint' ? '[1/3]' : mode === 'pipeline' ? '[2/3]' : '[3/3]';
        sCtx.fillText(modeBadge, plateX + plateW - 16, plateY + plateH / 2);
        sCtx.textAlign = 'left';

        // Telemetry Data Rows
        interface TelemetryRow {
          label: string;
          value: string;
          valueColor?: string;
        }

        let rows: TelemetryRow[];

        if (mode === 'sprint') {
          rows = [
            { label: 'COHORT', value: 'VIDEO EDIT' },
            { label: 'BATCH', value: '#15 COHORT' },
            { label: 'STAGE', value: 'DAY 07 / 15', valueColor: '#fbbf24' },
            { label: 'BRIEFS', value: '15 SYNCED', valueColor: '#38B44A' },
            { label: 'COOLING', value: `${rpmRef.current} RPM`, valueColor: '#ffffff' },
            { label: 'UPTIME', value: uptimeStr, valueColor: '#38bdf8' },
          ];
        } else if (mode === 'pipeline') {
          rows = [
            { label: 'CODEC', value: 'PRORES 422' },
            { label: 'CANVAS', value: '4K 60FPS' },
            { label: 'AUDIO', value: '48k / 24-BIT' },
            { label: 'COLOR', value: 'REC.709 LUT', valueColor: '#fbbf24' },
            { label: 'ENGINE', value: 'M-PRO 82%', valueColor: '#38B44A' },
            { label: 'COOLING', value: `${rpmRef.current} RPM`, valueColor: '#ffffff' },
          ];
        } else {
          rows = [
            { label: 'BRIEF', value: 'COMMERCIAL' },
            { label: 'ASSETS', value: '4K MULTI-CAM' },
            { label: 'DUE', value: '23:59 TODAY', valueColor: '#fbbf24' },
            { label: 'MENTOR', value: '1-ON-1 ONLINE', valueColor: '#38B44A' },
            { label: 'REWARD', value: '1,450 XP', valueColor: '#fbbf24' },
            { label: 'COOLING', value: `${rpmRef.current} RPM`, valueColor: '#ffffff' },
          ];
        }

        const startY = 82;
        const rowHeight = 44;
        const leftX = 48;
        const rightX = 592;

        rows.forEach((row, i) => {
          const rowY = startY + i * rowHeight + rowHeight / 2;

          // Label
          sCtx.textBaseline = 'middle';
          sCtx.font = 'bold 17px monospace';
          sCtx.fillStyle = 'rgba(248, 113, 113, 0.95)';
          sCtx.fillText(row.label, leftX, rowY);

          // Value
          sCtx.textAlign = 'right';
          sCtx.font = 'bold 17px monospace';
          sCtx.fillStyle = row.valueColor || '#ffffff';
          sCtx.fillText(row.value, rightX, rowY);
          sCtx.textAlign = 'left';

          // Dot leaders connecting label and value
          const labelW = sCtx.measureText(row.label).width;
          const valW = sCtx.measureText(row.value).width;
          const dotsStart = leftX + labelW + 10;
          const dotsEnd = rightX - valW - 10;
          if (dotsEnd > dotsStart + 8) {
            const dotCount = Math.floor((dotsEnd - dotsStart) / 8);
            sCtx.fillStyle = 'rgba(239, 68, 68, 0.35)';
            sCtx.fillText('.'.repeat(Math.max(1, dotCount)), dotsStart, rowY);
          }
        });

        // Screen footer divider
        sCtx.fillStyle = 'rgba(239, 68, 68, 0.45)';
        sCtx.fillRect(plateX, 350, plateW, 1.5);

        // Screen footer: Left: JUNCA OS v2.4, Right: Blinking CLICK TO CYCLE >
        sCtx.textBaseline = 'middle';
        sCtx.font = 'bold 14px monospace';
        sCtx.fillStyle = 'rgba(248, 113, 113, 0.85)';
        sCtx.fillText('JUNCA OS v2.4', leftX, 372);

        sCtx.textAlign = 'right';
        sCtx.font = 'bold 14px monospace';
        sCtx.fillStyle = blink ? '#ff4444' : '#fb923c';
        sCtx.fillText('CLICK TO CYCLE >', rightX, 372);
        sCtx.textAlign = 'left';

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
            if (headNodes.has(child.name)) {
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

          // Center overall robot model in view
          const totalBox = new THREE.Box3().setFromObject(robotRoot);
          const totalCenter = new THREE.Vector3();
          totalBox.getCenter(totalCenter);

          robotRoot.position.x = -totalCenter.x;
          robotRoot.position.y = -totalCenter.y;
          robotRoot.position.z = -totalCenter.z;

          // Position camera at a dynamic 3/4 studio angle with closer framing for larger, bold character presence
          camera.position.set(0.65, 0.03, 0.135);
          camera.lookAt(0, 0.015, 0);

          setIsReady(true);
        },
        undefined,
        (err) => {
          console.warn('WebGL GLTF load failed, using CSS 3D fallback:', err);
          setHasError(true);
        }
      );

      // 5. Mouse Interaction & Physics Lerp Loop
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

      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      document.addEventListener('mouseleave', handleMouseLeave);

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

        // Mouse Lerp
        const lerpFactor = 0.08;
        mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * lerpFactor;
        mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * lerpFactor;

        let targetYaw: number;
        let targetPitch: number;
        let targetRoll: number;

        if (mouseRef.current.active) {
          // Front-facing mouse tracking centered on neck axis
          targetYaw = mouseRef.current.x * 0.22;
          targetPitch = -mouseRef.current.y * 0.14;
          targetRoll = -mouseRef.current.x * 0.035;
        } else {
          const elapsed = time * 0.001;
          targetYaw = Math.sin(elapsed * 0.8) * 0.06;
          targetPitch = Math.cos(elapsed * 1.2) * 0.03;
          targetRoll = Math.sin(elapsed * 0.6) * 0.015;
        }

        currentHeadYaw += (targetYaw - currentHeadYaw) * 0.08;
        currentHeadPitch += (targetPitch - currentHeadPitch) * 0.08;
        currentHeadRoll += (targetRoll - currentHeadRoll) * 0.08;

        // Torso stays grounded with subtle micro-reaction
        currentBodyYaw += (targetYaw * 0.05 - currentBodyYaw) * 0.04;
        currentBodyPitch += (targetPitch * 0.03 - currentBodyPitch) * 0.04;

        // In front-facing view, Z is pitch (nod up/down), Y is yaw (turn left/right), X is roll
        headPivot.rotation.set(currentHeadRoll, currentHeadYaw, currentHeadPitch, 'ZYX');
        bodyPivot.rotation.set(0, currentBodyYaw, currentBodyPitch, 'ZYX');

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

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const animateFallback = () => {
      if (disposed || !isRunning) return;

      if (!isVisibleRef.current || document.hidden) {
        stopFallbackLoop();
        return;
      }

      currX += (targetX - currX) * 0.08;
      currY += (targetY - currY) * 0.08;

      setFallbackTransform({
        yaw: currX * 14 + 10,
        pitch: -currY * 9,
        roll: -currX * 2.0,
        glareX: -currX * 14,
        glareY: -currY * 14,
        torsoYaw: currX * 2.5 + 4,
        torsoPitch: -currY * 1.5,
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
    };
  }, [hasError]);

  const handleClick = () => {
    soundFx.playSweep(260, 720, 0.12, 0.06);
    const nextMode: RobotTerminalMode =
      terminalModeRef.current === 'sprint'
        ? 'pipeline'
        : terminalModeRef.current === 'pipeline'
        ? 'brief'
        : 'sprint';
    terminalModeRef.current = nextMode;
    setTerminalMode(nextMode);
    fanSpeedRef.current = 2.4;
    const boostRpm = 2840;
    rpmRef.current = boostRpm;
    setRpm(boostRpm);
    setTimeout(() => {
      fanSpeedRef.current = 1.0;
    }, 1200);
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
      className="relative w-[340px] sm:w-[420px] md:w-[480px] lg:w-[560px] xl:w-[640px] 2xl:w-[720px] h-[500px] sm:h-[580px] md:h-[640px] lg:h-[720px] xl:h-[780px] 2xl:h-[840px] max-h-[85vh] max-w-[48vw] flex items-center justify-center select-none pointer-events-auto cursor-pointer"
    >
      {/* ================= VOLUMETRIC CRIMSON BACKGROUND NEBULA ================= */}
      <div className="pointer-events-none absolute -inset-24 -z-10 overflow-hidden">
        {/* Deep ambient red smoke core */}
        <div className="absolute top-1/4 right-0 w-[640px] h-[640px] rounded-full bg-gradient-to-br from-red-600/40 via-red-950/30 to-transparent blur-[130px]" />
        {/* Soft upper crimson fog plume */}
        <div className="absolute -top-16 right-1/4 w-[480px] h-[480px] rounded-full bg-red-700/25 blur-[150px]" />
        {/* Subtle orange accent glow */}
        <div className="absolute bottom-8 right-8 w-[360px] h-[360px] rounded-full bg-orange-600/15 blur-[110px]" />
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
            <div className="relative w-[280px] sm:w-[320px] lg:w-[350px]">
              {/* Canopy */}
              <div className="relative mx-auto w-[92%] h-[36px] rounded-t-2xl bg-gradient-to-b from-[#2a2c33] via-[#1c1d22] to-[#121316] border-t border-white/20 px-6 flex items-center justify-between">
                <span className="size-1.5 rounded-full bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
                <div className="h-1.5 w-16 rounded-full bg-[#0a0a0c] border border-white/10" />
              </div>
              {/* Housing */}
              <div className="relative w-full h-[240px] sm:h-[260px] rounded-2xl bg-[#141518] shadow-[0_25px_60px_rgba(0,0,0,0.95)] border border-white/10 p-2.5 flex items-center justify-center">
                {/* Silver cheek */}
                <div className="absolute -left-3.5 top-4 bottom-4 w-5 bg-gradient-to-r from-[#5a5e69] via-[#3d414a] to-[#25272e] rounded-l-md border-l border-white/30" />
                {/* Screen */}
                <div
                  className="relative size-full rounded-xl bg-[#060204] p-2.5 border-2 border-[#20222a] flex flex-col justify-between overflow-hidden shadow-[inset_0_0_30px_rgba(239,68,68,0.22)]"
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
                  <div className="relative z-10 size-full flex flex-col justify-between font-mono text-[11px] leading-relaxed">
                    <div>
                      {/* Frosted Plate Screen Header */}
                      <div className="bg-red-600/20 border border-red-500/50 px-2 py-1 rounded flex items-center justify-between text-red-500 font-bold text-[11px]">
                        <span>
                          {terminalMode === 'sprint' ? '> SPRINT OS' : terminalMode === 'pipeline' ? '> STUDIO 4K' : '> DAILY BRIEF'}
                          <span className="animate-pulse">_</span>
                        </span>
                        <span className="text-[10px] text-red-300">
                          [{terminalMode === 'sprint' ? '1/3' : terminalMode === 'pipeline' ? '2/3' : '3/3'}]
                        </span>
                      </div>

                      {/* Telemetry rows with dot leaders */}
                      <div className="mt-2 space-y-1 text-[10px]">
                        {terminalMode === 'sprint' && (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-red-400 font-bold">COHORT</span>
                              <span className="flex-1 border-b border-dotted border-red-500/30 mx-1.5 translate-y-[2px]" />
                              <span className="text-white font-bold">VIDEO EDIT</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-red-400 font-bold">BATCH</span>
                              <span className="flex-1 border-b border-dotted border-red-500/30 mx-1.5 translate-y-[2px]" />
                              <span className="text-white font-bold">#15 COHORT</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-red-400 font-bold">STAGE</span>
                              <span className="flex-1 border-b border-dotted border-red-500/30 mx-1.5 translate-y-[2px]" />
                              <span className="text-amber-400 font-bold">DAY 07 / 15</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-red-400 font-bold">BRIEFS</span>
                              <span className="flex-1 border-b border-dotted border-red-500/30 mx-1.5 translate-y-[2px]" />
                              <span className="text-emerald-400 font-bold">15 SYNCED</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-red-400 font-bold">COOLING</span>
                              <span className="flex-1 border-b border-dotted border-red-500/30 mx-1.5 translate-y-[2px]" />
                              <span className="text-white font-bold">{rpm} RPM</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-red-400 font-bold">UPTIME</span>
                              <span className="flex-1 border-b border-dotted border-red-500/30 mx-1.5 translate-y-[2px]" />
                              <span className="text-sky-400 font-bold">{uptimeDisplay}</span>
                            </div>
                          </>
                        )}
                        {terminalMode === 'pipeline' && (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-red-400 font-bold">CODEC</span>
                              <span className="flex-1 border-b border-dotted border-red-500/30 mx-1.5 translate-y-[2px]" />
                              <span className="text-white font-bold">PRORES 422</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-red-400 font-bold">CANVAS</span>
                              <span className="flex-1 border-b border-dotted border-red-500/30 mx-1.5 translate-y-[2px]" />
                              <span className="text-white font-bold">4K 60FPS</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-red-400 font-bold">AUDIO</span>
                              <span className="flex-1 border-b border-dotted border-red-500/30 mx-1.5 translate-y-[2px]" />
                              <span className="text-white font-bold">48k / 24-BIT</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-red-400 font-bold">COLOR</span>
                              <span className="flex-1 border-b border-dotted border-red-500/30 mx-1.5 translate-y-[2px]" />
                              <span className="text-amber-400 font-bold">REC.709 LUT</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-red-400 font-bold">ENGINE</span>
                              <span className="flex-1 border-b border-dotted border-red-500/30 mx-1.5 translate-y-[2px]" />
                              <span className="text-emerald-400 font-bold">M-PRO 82%</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-red-400 font-bold">COOLING</span>
                              <span className="flex-1 border-b border-dotted border-red-500/30 mx-1.5 translate-y-[2px]" />
                              <span className="text-white font-bold">{rpm} RPM</span>
                            </div>
                          </>
                        )}
                        {terminalMode === 'brief' && (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-red-400 font-bold">BRIEF</span>
                              <span className="flex-1 border-b border-dotted border-red-500/30 mx-1.5 translate-y-[2px]" />
                              <span className="text-white font-bold">COMMERCIAL</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-red-400 font-bold">ASSETS</span>
                              <span className="flex-1 border-b border-dotted border-red-500/30 mx-1.5 translate-y-[2px]" />
                              <span className="text-white font-bold">4K MULTI-CAM</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-red-400 font-bold">DUE</span>
                              <span className="flex-1 border-b border-dotted border-red-500/30 mx-1.5 translate-y-[2px]" />
                              <span className="text-amber-400 font-bold">23:59 TODAY</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-red-400 font-bold">MENTOR</span>
                              <span className="flex-1 border-b border-dotted border-red-500/30 mx-1.5 translate-y-[2px]" />
                              <span className="text-emerald-400 font-bold">1-ON-1 ONLINE</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-red-400 font-bold">REWARD</span>
                              <span className="flex-1 border-b border-dotted border-red-500/30 mx-1.5 translate-y-[2px]" />
                              <span className="text-amber-400 font-bold">1,450 XP</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-red-400 font-bold">COOLING</span>
                              <span className="flex-1 border-b border-dotted border-red-500/30 mx-1.5 translate-y-[2px]" />
                              <span className="text-white font-bold">{rpm} RPM</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    {/* Footer */}
                    <div className="flex justify-between border-t border-red-500/40 pt-1.5 text-[9.5px]">
                      <span className="text-red-400 font-bold">JUNCA OS v2.4</span>
                      <span className="text-amber-400 font-bold animate-pulse">CLICK TO CYCLE &gt;</span>
                    </div>
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
            className="relative z-10 w-[310px] sm:w-[370px] lg:w-[420px] h-[210px] sm:h-[240px] rounded-3xl bg-gradient-to-b from-[#18191e] via-[#111215] to-[#08080a] border border-white/10 p-5 flex flex-col justify-between"
            style={{
              transform: `rotateX(${fallbackTransform.torsoPitch}deg) rotateY(${fallbackTransform.torsoYaw}deg)`,
            }}
          >
            <div className="flex items-center justify-between">
              {/* Fan */}
              <div className="relative size-20 rounded-full bg-[#08080a] border-2 border-[#2b2d36] p-1 flex items-center justify-center">
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
