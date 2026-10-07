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
export const RobotTerminal: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Mouse tracking state
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0, active: false });
  const [rpm, setRpm] = useState(62);
  const rpmRef = useRef(62);
  const fanSpeedRef = useRef(1.0);
  const uptimeSecondsRef = useRef(160);
  const statusModeRef = useRef<'status' | 'awaiting'>('status');

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

      // 3. Dynamic CRT Canvas Texture for the Terminal Screen
      const screenCanvas = document.createElement('canvas');
      screenCanvas.width = 512;
      screenCanvas.height = 512;
      const sCtx = screenCanvas.getContext('2d');

      screenTexture = new THREE.CanvasTexture(screenCanvas);
      screenTexture.colorSpace = THREE.SRGBColorSpace;
      screenTexture.minFilter = THREE.LinearFilter;
      screenTexture.magFilter = THREE.LinearFilter;

      const updateScreenCanvas = (timeSec: number) => {
        if (!sCtx) return;

        // Dark CRT glass background
        sCtx.fillStyle = '#060203';
        sCtx.fillRect(0, 0, 512, 512);

        // CRT phosphor glow gradient
        const radGlow = sCtx.createRadialGradient(256, 256, 40, 256, 256, 320);
        radGlow.addColorStop(0, 'rgba(239, 68, 68, 0.12)');
        radGlow.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
        sCtx.fillStyle = radGlow;
        sCtx.fillRect(0, 0, 512, 512);

        // CRT Scanlines
        sCtx.fillStyle = 'rgba(239, 68, 68, 0.04)';
        for (let y = 0; y < 512; y += 4) {
          sCtx.fillRect(0, y, 512, 2);
        }

        sCtx.font = '22px monospace';
        sCtx.textBaseline = 'top';

        const blink = Math.floor(timeSec * 2) % 2 === 0;

        if (statusModeRef.current === 'status') {
          // Red phosphor header
          sCtx.fillStyle = '#ef4444';
          sCtx.fillText('> status', 45, 60);

          sCtx.font = '20px monospace';
          sCtx.fillStyle = 'rgba(248, 113, 113, 0.9)';
          sCtx.fillText('  env ........ ok', 45, 110);
          sCtx.fillText('  lightmap ... ok', 45, 150);
          sCtx.fillText('  rig ........ ok', 45, 190);
          sCtx.fillText(`  fan ........ ${rpmRef.current} rpm`, 45, 230);

          const mins = Math.floor(uptimeSecondsRef.current / 60);
          const secs = uptimeSecondsRef.current % 60;
          const uptimeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
          sCtx.fillText(`  uptime ..... ${uptimeStr}`, 45, 270);
        } else {
          sCtx.fillStyle = '#ef4444';
          sCtx.fillText('> awaiting input ' + (blink ? '_' : ' '), 45, 120);

          sCtx.font = '18px monospace';
          sCtx.fillStyle = 'rgba(248, 113, 113, 0.7)';
          sCtx.fillText('  core active', 45, 180);
          sCtx.fillText('  telemetry synced', 45, 220);
        }

        // Screen footer bar
        sCtx.fillStyle = 'rgba(239, 68, 68, 0.3)';
        sCtx.fillRect(45, 410, 422, 1);

        sCtx.font = '16px monospace';
        sCtx.fillStyle = 'rgba(239, 68, 68, 0.8)';
        sCtx.fillText('JUNCA OS  v0.1', 45, 430);

        sCtx.textAlign = 'right';
        sCtx.fillText(blink ? 'ATTENTIF' : '#TT84F2F', 467, 430);
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

      gltfLoader.load(
        '/robot/junca_robot.glb',
        (gltf) => {
          if (disposed) return;

          // Apply tailored materials and lightmaps to each mesh
          gltf.scene.traverse((obj) => {
            if ((obj as THREE.Mesh).isMesh) {
              const mesh = obj as THREE.Mesh;
              if (Array.isArray(mesh.material)) {
                mesh.material = mesh.material.map((m) => {
                  if (m?.name && materials[m.name]) return materials[m.name];
                  if (m?.name?.toLowerCase().includes('glass')) return materials.mat_glass;
                  return m;
                });
              } else {
                const matName = mesh.material?.name;
                if (matName && materials[matName]) {
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

      // Telemetry tickers
      const intervalId = setInterval(() => {
        const nextRpm = 60 + Math.floor(Math.random() * 5);
        rpmRef.current = nextRpm;
        setRpm(nextRpm);
        uptimeSecondsRef.current += 1;
      }, 1000);

      let lastTime = performance.now();
      let currentHeadYaw = 0;
      let currentHeadPitch = 0;
      let currentHeadRoll = 0;
      let currentBodyYaw = 0;
      let currentBodyPitch = 0;
      let isIntersecting = true;
      let isTabVisible = !document.hidden;
      let isRunning = false;

      const animate = (time: number) => {
        if (disposed || !isRunning) return;

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

      const startLoop = () => {
        if (disposed || isRunning || !isIntersecting || !isTabVisible) return;
        isRunning = true;
        lastTime = performance.now();
        animId = requestAnimationFrame(animate);
      };

      const stopLoop = () => {
        isRunning = false;
        if (animId) {
          cancelAnimationFrame(animId);
        }
      };

      // IntersectionObserver: suspend WebGL loop when out of viewport
      const io = new IntersectionObserver(
        ([entry]) => {
          isIntersecting = entry.isIntersecting;
          if (isIntersecting) {
            startLoop();
          } else {
            stopLoop();
          }
        },
        { threshold: 0.05 }
      );

      if (container) {
        io.observe(container);
      }

      const handleVisibilityChange = () => {
        isTabVisible = !document.hidden;
        if (isTabVisible && isIntersecting) {
          startLoop();
        } else {
          stopLoop();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

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
        io.disconnect();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
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
    let targetX = 0;
    let targetY = 0;
    let currX = 0;
    let currY = 0;
    let isIntersecting = true;
    let isRunning = false;

    const handleMouseMove = (e: MouseEvent) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const animateFallback = () => {
      if (!isRunning) return;

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

    const startFallbackLoop = () => {
      if (isRunning || !isIntersecting || document.hidden) return;
      isRunning = true;
      animId = requestAnimationFrame(animateFallback);
    };

    const stopFallbackLoop = () => {
      isRunning = false;
      if (animId) cancelAnimationFrame(animId);
    };

    const io = new IntersectionObserver(([entry]) => {
      isIntersecting = entry.isIntersecting;
      if (isIntersecting) {
        startFallbackLoop();
      } else {
        stopFallbackLoop();
      }
    }, { threshold: 0.05 });

    if (containerRef.current) {
      io.observe(containerRef.current);
    }

    const handleVisibilityChange = () => {
      if (!document.hidden && isIntersecting) {
        startFallbackLoop();
      } else {
        stopFallbackLoop();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    startFallbackLoop();

    return () => {
      stopFallbackLoop();
      io.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [hasError]);

  const handleClick = () => {
    soundFx.playSweep(260, 720, 0.12, 0.06);
    statusModeRef.current = statusModeRef.current === 'status' ? 'awaiting' : 'status';
    fanSpeedRef.current = 2.4;
    setTimeout(() => {
      fanSpeedRef.current = 1.0;
    }, 1200);
  };

  return (
    <div
      ref={containerRef}
      data-cursor="ROBOT"
      onClick={handleClick}
      onMouseEnter={() => soundFx.playBlip(540, 0.03, 'sine', 0.03)}
      className="relative w-[380px] sm:w-[460px] md:w-[540px] lg:w-[640px] xl:w-[720px] 2xl:w-[800px] h-[580px] sm:h-[660px] md:h-[720px] lg:h-[820px] xl:h-[900px] 2xl:h-[980px] flex items-center justify-center select-none pointer-events-auto cursor-pointer"
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
              <div className="relative w-full h-[190px] sm:h-[210px] rounded-2xl bg-[#141518] shadow-[0_25px_60px_rgba(0,0,0,0.95)] border border-white/10 p-3.5 flex items-center justify-center">
                {/* Silver cheek */}
                <div className="absolute -left-3.5 top-4 bottom-4 w-5 bg-gradient-to-r from-[#5a5e69] via-[#3d414a] to-[#25272e] rounded-l-md border-l border-white/30" />
                {/* Screen */}
                <div
                  className="relative size-full rounded-xl bg-[#09090c] p-3 border-2 border-[#20222a] flex flex-col justify-between overflow-hidden"
                  style={{ clipPath: 'polygon(2% 0%, 98% 0%, 95% 100%, 5% 100%)' }}
                >
                  <div className="relative size-full rounded-lg bg-[#070204] p-3 flex flex-col justify-between font-mono text-[11px] leading-relaxed text-red-400">
                    <div>
                      <div className="text-red-500 font-bold">&gt; status</div>
                      <div className="mt-1 space-y-0.5 text-[10px]">
                        <div>env ........ ok</div>
                        <div>lightmap ... ok</div>
                        <div>rig ........ ok</div>
                        <div>fan ........ {rpm} rpm</div>
                      </div>
                    </div>
                    <div className="flex justify-between border-t border-red-900/40 pt-1 text-[9px]">
                      <span>JUNCA OS v0.1</span>
                      <span className="text-red-300 font-bold">ATTENTIF</span>
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
