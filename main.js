import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import BlueprintOverlay from './blueprint.js';

let scene, camera, renderer, controls;
let clock;
let progress = 0; // 0 = healthy, 1 = polluted
let currentYear = 2020; // will be synced to timeline[0] below
let fishGroup = null;
let fishMaterials = []; // array to store all original materials for tinting
let bubbles = []; // array of bubble mesh groups
let bubbleMaterial = null;
let bubbleEdgeMaterial = null;
const MAX_BUBBLES = 50; // fewer bubbles since they're full meshes
const BUBBLES_ENABLED = false; // disable bubbles (remove grey bubbles)
const HALO_ENABLED = true; // enable subtle halo for luminous top glow
const FISH_GLOW_ENABLED = false; // outline glow; set true to re-enable
const PARTICLE_MIN = 0;
const PARTICLE_MAX = 0;
const SCALE_FLARES = [
  { year: 2022, seed: 101 },
  { year: 2024, seed: 202 },
  { year: 2026, seed: 303 },
  { year: 2028, seed: 404 },
  { year: 2030, seed: 454 },
  { year: 2032, seed: 505 },
  { year: 2035, seed: 606 },
  { year: 2038, seed: 656 },
  { year: 2042, seed: 707 },
  { year: 2045, seed: 757 },
  { year: 2050, seed: 808 },
];
const SCALE_DUPLICATES = 6; // number of flares per timeline entry
let particleContainer = null;
let particleElements = [];
let activeParticleCount = 0;
let activeBubbleCount = 0;
let bubbleSpawnTimer = 0;
let raycaster = null;
let mouse = new THREE.Vector2();
let hitboxes = [];
let hitboxGlows = []; // visible glow meshes for each hitbox
let hoverGlow = null;
let currentHoveredHitbox = null;
let blueprintOverlay = null;
let animationMixer = null;
let hasGLTFAnimations = false;
let tailMeshes = []; // meshes for tail animation
let finMeshes = []; // meshes for fin animation
let bodyMeshes = []; // main body meshes for body wave animation
let spineSegments = []; // ordered body segments for spine wave
let fishGlowMeshes = []; // [{ source, glow }]
let scaleTooltipContainer = null;
let scaleFlares = []; // [{mesh, basePos, dir, year}]
let scaleTextures = [];
let scaleTexturesPromise = null;
let activeScaleTooltip = null; // currently visible tooltip element
let swimPhase = 0; // overall swim cycle phase
const cameraTarget = new THREE.Vector3();

// Timeline from 2020 to 2050
const timeline = [
  {
    year: 2020,
    progress: 0.0,
    label: 'Pre-gAI Baseline',
    fact: 'Before the generative AI boom, global data centers consumed ~200 terawatt-hours of electricity annually—comparable to South Korea’s total usage. E-waste worldwide hit ~53.6 million metric tons, driven by fast-growing electronics demand.'
  },
  {
    year: 2021,
    progress: 0.05,
    label: 'Infrastructure Foundation',
    fact: 'AI infrastructure quietly expanded as companies like Google, Meta, and Microsoft built hyperscale data centers. Each new site required hundreds of megawatts—enough to power tens of thousands of homes.'
  },
  {
    year: 2022,
    progress: 0.1,
    label: 'gAI Lift-off',
    fact: 'ChatGPT launched, sparking global gAI use. Global data centers consumed ~460 terawatt-hours—roughly equivalent to France’s entire electricity use. GPT-3 training alone consumed ~1,287 megawatt-hours (1.3 million kilowatt-hours), enough to power about 120 U.S. homes for a year or charge over 100 million smartphones.'
  },
  {
    year: 2023,
    progress: 0.2,
    label: 'The Thirst Emerges',
    fact: 'Studies revealed training GPT-4 likely required millions of liters of water. Each user session with ChatGPT (~20 prompts) indirectly consumed ~500ml—roughly a standard water bottle’s worth. U.S. AI data centers began drawing over 4% of national electricity.'
  },
  {
    year: 2024,
    progress: 0.25,
    label: 'Compute Arms Race',
    fact: 'Over 3.8 million high-performance GPUs shipped globally to meet AI demand, causing rapid turnover and growing e-waste. Cloud providers announced plans to double data-center capacity within two years.'
  },
  {
    year: 2025,
    progress: 0.3,
    label: 'Grid Crunch',
    fact: 'U.S. projections showed data centers may consume 6.7% to 12% of national electricity by 2028—more than the total usage of some countries. Multiple utilities in Virginia and Arizona delayed new AI server farms due to power strain.'
  },
  {
    year: 2026,
    progress: 0.35,
    label: 'Regulatory Awakening',
    fact: 'The EU passed the AI Act, mandating disclosure of energy, water, and carbon metrics for large models. Several U.S. states introduced similar bills. Tech firms began issuing sustainability labels for their AI APIs.'
  },
  {
    year: 2028,
    progress: 0.45,
    label: 'Water Tipping Point',
    fact: 'U.S. AI data centers projected to consume 720 billion gallons of water annually for cooling—equal to the indoor use of ~18 million homes. Major drought states, including Arizona, restricted AI expansion permits.'
  },
  {
    year: 2030,
    progress: 0.6,
    label: 'Carbon Reckoning',
    fact: 'Unregulated gAI growth could emit 220 million metric tons of CO₂ annually—comparable to 50 million gasoline-powered cars. Companies scrambled to integrate carbon-aware scheduling and dynamic model loading.'
  },
  {
    year: 2032,
    progress: 0.68,
    label: 'Hardware Pushback',
    fact: 'New global rules required modular, upgradeable GPUs for AI hardware. Chip refresh cycles slowed to 5 years, reducing landfill-bound electronics by 60%.'
  },
  {
    year: 2035,
    progress: 0.75,
    label: 'AI Net-Zero Threshold',
    fact: 'Major cloud providers (AWS, Google, Azure) certified 100% carbon-free operations in the U.S. and EU. Renewable-aligned inference scheduling became industry standard—shifting workloads to times and locations with solar or wind surpluses.'
  },
  {
    year: 2040,
    progress: 0.85,
    label: 'Smart Cooling Era',
    fact: 'Advanced immersion cooling and reclaimed wastewater systems slashed water consumption by 70%. Urban data centers now fed district heating networks with AI waste heat, warming homes in winter.'
  },
  {
    year: 2045,
    progress: 0.95,
    label: 'Circular Compute',
    fact: 'Global recycling infrastructure enabled recovery of 80% of rare earth metals from old AI chips. Manufacturing emissions dropped significantly through reuse-first chip design.'
  },
  {
    year: 2050,
    progress: 1.0,
    label: 'Sustainable Singularity?',
    fact: 'With carbon-free energy and AI workloads optimized to near-zero waste, each AI query now uses 90% less energy than in 2023. Generative AI becomes a model of global sustainable computing—achieved through policy, innovation, and infrastructure alignment.'
  }
];
currentYear = timeline[0]?.year || currentYear;

init();
animate();

function init() {
  const container = document.getElementById('container');

  scene = new THREE.Scene();
  // Deep sea fog for volumetric soft look
  scene.fog = new THREE.FogExp2(0x020b18, 0.09);

  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
  camera.position.set(0, 0.3, 3.0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Tone mapping for soft, filmic underwater look
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  // Make the WebGL canvas transparent so the CSS gradient shows
  renderer.setClearColor(0x000000, 0);
  renderer.setClearAlpha(0);
  // Fix depth buffer issues to prevent clipping
  renderer.sortObjects = true;
  container.appendChild(renderer.domElement);

  // Setup raycasting
  raycaster = new THREE.Raycaster();

  // Create hover glow effect
  const glowGeometry = new THREE.SphereGeometry(0.15, 16, 16);
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: 0x88ffff,
    emissive: 0x44aaff,
    emissiveIntensity: 1.5,
    transparent: true,
    opacity: 0.8,
  });
  hoverGlow = new THREE.Mesh(glowGeometry, glowMaterial);
  hoverGlow.visible = false;
  scene.add(hoverGlow);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 1.5;
  controls.maxDistance = 4;
  controls.target.set(0, 0, 0);
  controls.maxPolarAngle = Math.PI - 0.15; // allow near full 360 vertical
  controls.minPolarAngle = 0.15;

  // === LIGHTING: underwater + top glow ===
  // Reset to a balanced set that keeps the fish bright without a blown halo
  const hemiLight = new THREE.HemisphereLight(0x4fb7ff, 0x030306, 0.6);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xa8e8ff, 1.1);
  keyLight.position.set(-1.2, 2.8, 2.4);
  keyLight.castShadow = false;
  scene.add(keyLight);

  const rimLight = new THREE.PointLight(0x6bd2ff, 0.9, 8, 1.4);
  rimLight.position.set(0.3, 1.4, -2.4);
  scene.add(rimLight);

  const fillLight = new THREE.DirectionalLight(0x0f2742, 0.5);
  fillLight.position.set(2.6, -0.5, -1.1);
  scene.add(fillLight);

  // Gentle front fill to keep the face readable
  const frontFill = new THREE.DirectionalLight(0x8ecfff, 0.45);
  frontFill.position.set(0.4, 0.5, 3.2);
  scene.add(frontFill);

  // Warm underside light to bring out orange fins
  const warmUnder = new THREE.PointLight(0xffa347, 0.7, 6, 1.8);
  warmUnder.position.set(0, -0.4, 0.8);
  scene.add(warmUnder);

  // Create bubble materials (currently disabled)
  if (BUBBLES_ENABLED) {
    createBubbleMaterials();
  }
  
  // Remove any old particle systems that might still be in the scene
  scene.traverse((object) => {
    if (object instanceof THREE.Points) {
      console.log('Removing old particle system:', object);
      scene.remove(object);
      if (object.geometry) object.geometry.dispose();
      if (object.material) object.material.dispose();
    }
  });

  // TEMP placeholder so scene isn't empty while GLB loads
  const geo = new THREE.SphereGeometry(0.5, 32, 32);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x3db0ff,
    roughness: 0.3,
    metalness: 0.4,
  });
  const placeholder = new THREE.Mesh(geo, mat);
  placeholder.name = 'placeholder';
  scene.add(placeholder);

  // load betta glb - trying root level betta_splendens.glb
  const loader = new GLTFLoader();
  loader.load(
    './betta_splendens.glb',
    (gltf) => {
      // remove placeholder
      const ph = scene.getObjectByName('placeholder');
      if (ph) scene.remove(ph);

      fishGroup = gltf.scene;

      // center & scale
      const box = new THREE.Box3().setFromObject(fishGroup);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      // Center the fish at origin
      fishGroup.position.sub(center);
      
      // Store the centered position as the base (will be used for animation offsets)
      fishGroup.userData.basePosition = new THREE.Vector3(0, 0, 0);
      fishGroup.userData.baseRotation = new THREE.Vector3(0, -Math.PI / 2, 0);

      const targetLength = 0.6; // Significantly smaller fish
      const currentLength = size.x; // instead of size.length()
      const scaleFactor = targetLength / currentLength;
      fishGroup.scale.setScalar(scaleFactor);

      // rotate so fish faces +X (adjust if needed)
      fishGroup.rotation.y = -Math.PI / 2;
      fishGroup.rotation.x = 0;
      fishGroup.rotation.z = 0;

      // Keep original materials and textures, but clone them so we can modify them
      fishMaterials = [];
      tailMeshes = [];
      finMeshes = [];
      
      // Load textures from the original folder if available
      const textureLoader = new THREE.TextureLoader();
      let baseColorTex = null;
      let normalTex = null;
      let roughnessTex = null;
      let metallicTex = null;
      let opacityTex = null;
      
      // Try to load textures from the original betta-splendens folder
      textureLoader.load('./assets/textures/BETTA_Base_Color.png', (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        baseColorTex = tex;
        applyTexturesToMaterials();
      }, undefined, () => console.log('Could not load base color texture'));
      
      textureLoader.load('./assets/textures/BETTA_Normal_OpenGL.png', (tex) => {
        normalTex = tex;
        applyTexturesToMaterials();
      });
      
      textureLoader.load('./assets/textures/BETTA_Roughness.png', (tex) => {
        roughnessTex = tex;
        applyTexturesToMaterials();
      });
      
      textureLoader.load('./assets/textures/BETTA_Metallic.png', (tex) => {
        metallicTex = tex;
        applyTexturesToMaterials();
      });
      
      textureLoader.load('./assets/textures/BETTA_Opacity_2.png', (tex) => {
        opacityTex = tex;
        applyTexturesToMaterials();
      });
      
      function applyTexturesToMaterials() {
        if (fishMaterials.length === 0) return;
        
        fishMaterials.forEach((mat) => {
          if (baseColorTex) mat.map = baseColorTex;
          if (normalTex) mat.normalMap = normalTex;
          if (roughnessTex) mat.roughnessMap = roughnessTex;
          if (metallicTex) mat.metalnessMap = metallicTex;
          if (opacityTex) {
            mat.alphaMap = opacityTex;
            mat.transparent = true;
          }
          mat.needsUpdate = true;
        });
      }
      
      fishGroup.traverse((child) => {
        if (child.isMesh) {
          // Clone original material to preserve textures
          child.material = child.material.clone();
          
          // Ensure skinning stays enabled on skinned meshes after cloning
          if (child.isSkinnedMesh && child.material && !child.material.skinning) {
            child.material.skinning = true;
          }
          if (child.isSkinnedMesh) {
            child.frustumCulled = false; // avoid culling animated bones
          }
          
          // Ensure proper color space handling
          if (child.material.map) {
            child.material.map.colorSpace = THREE.SRGBColorSpace;
          }
          
          // Soften specular to reduce hotspots
          child.material.metalness = 0.4;
          child.material.roughness = 0.45;
          child.material.envMapIntensity = 0.6;
          
          // Fix depth issues to prevent clipping
          child.material.depthWrite = true;
          child.material.depthTest = true;
          
          // Use FrontSide to prevent seeing through geometry
          // But check if it's an eye and handle differently
          const lowerName = child.name.toLowerCase();
          if (lowerName.includes('eye')) {
            // Eyes should only show from front
            child.material.side = THREE.FrontSide;
            console.log('Found eye mesh:', child.name);
          } else {
            // Keep most fish parts double-sided to avoid culling artifacts
            child.material.side = THREE.DoubleSide;
          }
          
          // Recompute normals for proper lighting
          if (child.geometry) {
            child.geometry.computeVertexNormals();
          }
          
          // Fix potential z-fighting by adding small depth offset
          child.renderOrder = 0;
          
          child.castShadow = true;
          child.receiveShadow = true;
          
          // Store reference for progress-based tinting
          fishMaterials.push(child.material);
          
          // Categorize meshes for different animation types
          if (lowerName.includes('tail')) {
            tailMeshes.push(child);
            console.log('Found tail mesh:', child.name);
          } else if (lowerName.includes('fin') || lowerName.includes('dorsal') || lowerName.includes('pectoral') || lowerName.includes('anal')) {
            finMeshes.push(child);
            console.log('Found fin mesh:', child.name);
          } else if (!lowerName.includes('eye')) {
            // Body meshes (everything except eyes)
            bodyMeshes.push(child);
          }
        }
      });
      
      // Log all mesh names for debugging
      console.log('All meshes in fish:');
      fishGroup.traverse((child) => {
        if (child.isMesh) console.log('  -', child.name);
      });

      scene.add(fishGroup);
      if (FISH_GLOW_ENABLED) {
        addFishGlow();
      }
      // initScaleFlares() is called after textures load (see line 490)
      
      // === Add halo glow behind fish (optional) ===
      if (HALO_ENABLED) {
        const glowCanvas = document.createElement('canvas');
        glowCanvas.width = glowCanvas.height = 256;
        const gctx = glowCanvas.getContext('2d');

        const gradient = gctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        gradient.addColorStop(0, 'rgba(120, 220, 255, 0.65)');
        gradient.addColorStop(0.25, 'rgba(80, 200, 255, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        gctx.fillStyle = gradient;
        gctx.fillRect(0, 0, 256, 256);

        const glowTexture = new THREE.CanvasTexture(glowCanvas);
        const glowMaterial = new THREE.SpriteMaterial({
          map: glowTexture,
          color: 0x75cfff,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });

        const glowSprite = new THREE.Sprite(glowMaterial);
        glowSprite.scale.set(1.8, 1.8, 1.0);
        glowSprite.position.set(0, 0.3, -0.55);
        fishGroup.add(glowSprite);
      }
      initSpineSegments();
      // (skipped previous softening pass to keep the brighter, sparkly look)
      
      // Play embedded GLTF animations if available (drive skeleton)
      if (gltf.animations && gltf.animations.length > 0) {
        hasGLTFAnimations = true;
        console.log(`Found ${gltf.animations.length} animation(s) in GLB:`, gltf.animations.map(clip => clip.name));
        animationMixer = new THREE.AnimationMixer(fishGroup);
        const primaryClip = gltf.animations[0];
        const action = animationMixer.clipAction(primaryClip);
        action.reset();
        action.enabled = true;
        action.clampWhenFinished = false;
        action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(1);
        action.play();
        console.log(`Playing primary animation: ${primaryClip.name} (duration: ${primaryClip.duration}s, tracks: ${primaryClip.tracks.length})`);
      } else {
        console.log('No animations found in GLB file');
      }
      
      // Create hitboxes after fish is loaded
      createHitboxes();
      
  // Initialize scale flares now that fish is loaded and textures are (or will be) ready
  scaleTexturesPromise = scaleTexturesPromise || loadScaleTextures();
  scaleTexturesPromise.then(() => {
    initScaleFlares();
  });
      
      // Spawn initial bubbles for immediate visibility (disabled)
      if (BUBBLES_ENABLED) {
        spawnInitialBubbles();
      }
    },
    undefined,
    (err) => {
      console.error('Error loading betta.glb', err);
    }
  );

  clock = new THREE.Clock();

  // Mouse move and click handlers
  container.addEventListener('mousemove', onMouseMove);
  container.addEventListener('click', onMouseClick);

  window.addEventListener('resize', onWindowResize);

  // Initialize blueprint overlay
  blueprintOverlay = new BlueprintOverlay();

  // Particles overlay container
  particleContainer = document.getElementById('particles');
  if (particleContainer) {
    createParticles();
  }
  scaleTooltipContainer = document.getElementById('scale-tooltips');
  scaleTexturesPromise = loadScaleTextures();
  
  // Set initial blueprint intensity and progress based on initial progress
  if (blueprintOverlay) {
    blueprintOverlay.setIntensity(progress);
    blueprintOverlay.setProgress(progress);
  }

  // Setup timeline slider
  setupTimelineSlider();
}

function initSpineSegments() {
  // Prefer body meshes; if none were classified, fall back to tail/fin so the spine still animates
  const candidates = bodyMeshes.length ? bodyMeshes : [...tailMeshes, ...finMeshes];
  if (!candidates.length) return;

  const uniqueMeshes = Array.from(new Set(candidates));

  const worldPositions = uniqueMeshes.map((mesh) => {
    const pos = new THREE.Vector3();
    mesh.getWorldPosition(pos);
    return { mesh, pos };
  });

  const minX = Math.min(...worldPositions.map(({ pos }) => pos.x));
  const maxX = Math.max(...worldPositions.map(({ pos }) => pos.x));

  spineSegments = worldPositions
    .map(({ mesh, pos }) => {
      const t = maxX === minX ? 0 : (pos.x - minX) / (maxX - minX);
      if (!mesh.userData.baseRotation) {
        mesh.userData.baseRotation = mesh.rotation.clone();
      }
      if (!mesh.userData.basePosition) {
        mesh.userData.basePosition = mesh.position.clone();
      }
      return { mesh, t };
    })
    .sort((a, b) => a.t - b.t);
}

function getProgressForYear(year) {
  // Clamp year to timeline range
  if (year <= timeline[0].year) {
    return timeline[0].progress;
  }
  if (year >= timeline[timeline.length - 1].year) {
    return timeline[timeline.length - 1].progress;
  }

  // Find the two timeline entries to interpolate between
  for (let i = 0; i < timeline.length - 1; i++) {
    const entry1 = timeline[i];
    const entry2 = timeline[i + 1];

    if (year >= entry1.year && year <= entry2.year) {
      // Linear interpolation
      const t = (year - entry1.year) / (entry2.year - entry1.year);
      return entry1.progress + (entry2.progress - entry1.progress) * t;
    }
  }

  return 0;
}

function getLabelForYear(year) {
  // Clamp year to timeline range
  if (year <= timeline[0].year) {
    return timeline[0].label;
  }
  if (year >= timeline[timeline.length - 1].year) {
    return timeline[timeline.length - 1].label;
  }

  // Find the appropriate label (use the earlier entry's label)
  for (let i = 0; i < timeline.length - 1; i++) {
    const entry1 = timeline[i];
    const entry2 = timeline[i + 1];

    if (year >= entry1.year && year <= entry2.year) {
      // Use the earlier entry's label, or interpolate if closer to next
      const t = (year - entry1.year) / (entry2.year - entry1.year);
      return t < 0.5 ? entry1.label : entry2.label;
    }
  }

  return timeline[0].label;
}

function getFactForYear(year) {
  // Only show facts within their active interval; otherwise blank
  if (year < timeline[0].year || year > timeline[timeline.length - 1].year) return '';
  for (let i = 0; i < timeline.length; i++) {
    const entry = timeline[i];
    const next = timeline[i + 1];
    const nextYear = next ? next.year : Number.POSITIVE_INFINITY;
    if (year >= entry.year && year < nextYear) {
      return entry.fact || '';
    }
  }
  return '';
}

function applyProgressSideEffects() {
  // Update blueprint intensity and progress (for color changes)
  if (blueprintOverlay) {
    blueprintOverlay.setIntensity(progress);
    blueprintOverlay.setProgress(progress);
  }

  // Update particles
  updateParticlesForProgress();

  // Sync fish visuals
  updateFishAppearance();
  updateBackgroundForProgress();
  // Scales are driven by currentYear in update loop; force refresh this frame
  updateScaleFlares(clock ? clock.elapsedTime : 0);
  updateScaleTooltips();
  activeScaleTooltip = null;
}

function lerpHexColor(hex1, hex2, t) {
  const c1 = parseInt(hex1.replace('#', ''), 16);
  const c2 = parseInt(hex2.replace('#', ''), 16);
  const r1 = (c1 >> 16) & 0xff;
  const g1 = (c1 >> 8) & 0xff;
  const b1 = c1 & 0xff;
  const r2 = (c2 >> 16) & 0xff;
  const g2 = (c2 >> 8) & 0xff;
  const b2 = c2 & 0xff;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, '0')}${g
    .toString(16)
    .padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function updateBackgroundForProgress() {
  // Use a fixed bright background; layers are disabled in CSS
  document.body.style.background = 'radial-gradient(circle at 40% 25%, #2c95ff, #0f3f65 70%, #0b1225 100%)';
}
function findTimelineEntry(year) {
  return timeline.find((t) => t.year === year) || null;
}
function setupTimelineSlider() {
  const slider = document.getElementById('yearSlider');
  const yearLabel = document.getElementById('yearLabel');
  const yearFact = document.getElementById('yearFact');
  const infoTabs = document.querySelectorAll('#info-panel .info-tab');
  const infoBodies = document.querySelectorAll('#info-panel .info-body');

  if (!slider || !yearLabel) return;

  // Info tab behavior
  infoTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      infoTabs.forEach((t) => t.classList.toggle('active', t === tab));
      infoBodies.forEach((body) => {
        body.classList.toggle('hidden', body.getAttribute('data-tabcontent') !== target);
      });
    });
  });

  // Set slider range
  slider.min = timeline[0].year;
  slider.max = timeline[timeline.length - 1].year;
  slider.value = timeline[0].year;
  currentYear = timeline[0].year;

  // Update on slider change
  slider.addEventListener('input', (e) => {
    currentYear = parseInt(e.target.value);
    progress = getProgressForYear(currentYear);
    
    // Update label
    const label = getLabelForYear(currentYear);
    yearLabel.textContent = `${currentYear}: ${label}`;
    if (yearFact) {
      yearFact.textContent = getFactForYear(currentYear);
    }
    
    applyProgressSideEffects();
    // reset any active scale tooltip on timeline change
    activeScaleTooltip = null;
  });

  // Initial update
  progress = getProgressForYear(currentYear);
  const label = getLabelForYear(currentYear);
  yearLabel.textContent = `${currentYear}: ${label}`;
  if (yearFact) {
    yearFact.textContent = getFactForYear(currentYear);
  }
  applyProgressSideEffects();
}

function createHitboxes() {
  if (!fishGroup) return;

  // Define hitbox positions relative to fish (around the fish body)
  const hitboxData = [
    { name: 'emissions', position: new THREE.Vector3(0.6, 0.2, 0), radius: 0.25 },
    { name: 'water', position: new THREE.Vector3(-0.4, 0.3, 0.3), radius: 0.25 },
    { name: 'energy', position: new THREE.Vector3(0, -0.3, 0.5), radius: 0.25 },
    { name: 'inequality', position: new THREE.Vector3(-0.5, -0.2, -0.4), radius: 0.25 },
  ];

  hitboxData.forEach((data) => {
    // Invisible hitbox for raycasting
    const geometry = new THREE.SphereGeometry(data.radius, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      visible: false, // invisible
      side: THREE.DoubleSide,
    });
    const hitbox = new THREE.Mesh(geometry, material);
    hitbox.name = data.name;
    hitbox.position.copy(data.position);
    
    // Visible glowing sphere as child of hitbox
    const glowGeometry = new THREE.SphereGeometry(data.radius * 0.6, 16, 16);
    const glowMaterial = new THREE.MeshStandardMaterial({
      color: 0x88ffff,
      emissive: 0x44aaff,
      emissiveIntensity: 0.3, // will be updated based on progress
      transparent: true,
      opacity: 0.0,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.name = `${data.name}_glow`;
    glow.visible = false; // keep hitbox glow hidden; hoverGlow handles feedback
    hitbox.add(glow);
    
    // Make hitbox a child of fishGroup so it moves with the fish
    fishGroup.add(hitbox);
    hitboxes.push(hitbox);
    hitboxGlows.push(glow);
  });
}

function randomizeParticle(el) {
  // Disabled since particles are off
  const startX = 0;
  const drift = 0;
  const startY = 0;
  const endY = 0;
  const duration = 1;
  const delay = 0;

  el.style.setProperty('--startX', `${startX}vw`);
  el.style.setProperty('--endX', `${startX + drift}vw`);
  el.style.setProperty('--startY', `${startY}vh`);
  el.style.setProperty('--endY', `${endY}vh`);
  el.style.setProperty('--duration', `${duration}ms`);
  el.style.animationDelay = `${delay}ms`;
}

function createParticles() {
  if (!particleContainer) return;
  const maxCount = PARTICLE_MAX;
  particleElements = [];
  for (let i = 0; i < maxCount; i++) {
    const el = document.createElement('div');
    el.className = 'particle';
    randomizeParticle(el);
    el.style.display = 'none';
    el.addEventListener('animationiteration', () => randomizeParticle(el));
    particleContainer.appendChild(el);
    particleElements.push(el);
  }
}

function addFishGlow() {
  if (!FISH_GLOW_ENABLED) return;
  if (!fishGroup) return;
  const glowColor = 0x7fd8ff;
  const opacity = 0.18;
  fishGlowMeshes = [];

  fishGroup.traverse((child) => {
    if (!child.isMesh) return;
    if (child.name.toLowerCase().includes('eye')) return;

    const mat = new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    });

    const glowMesh = child.isSkinnedMesh
      ? new THREE.SkinnedMesh(child.geometry, mat)
      : new THREE.Mesh(child.geometry, mat);

    glowMesh.name = `${child.name}_glow`;
    glowMesh.matrixAutoUpdate = false;
    glowMesh.frustumCulled = false;
    if (child.isSkinnedMesh && child.skeleton) {
      glowMesh.bind(child.skeleton, child.bindMatrix);
    }

    scene.add(glowMesh);
    fishGlowMeshes.push({ source: child, glow: glowMesh });
  });
}

function updateFishGlowTransforms() {
  if (!FISH_GLOW_ENABLED) return;
  if (!fishGlowMeshes.length) return;
  const scale = new THREE.Matrix4().makeScale(1.05, 1.05, 1.05);

  fishGlowMeshes.forEach(({ source, glow }) => {
    if (!source || !glow) return;
    glow.visible = source.visible;
    glow.matrixWorld.copy(source.matrixWorld).multiply(scale);
  });
}

function seededRandom(seed, offset = 0) {
  const x = Math.sin(seed * 9973 + offset * 7919) * 43758.5453;
  return x - Math.floor(x);
}

function loadScaleTextures() {
  const loader = new THREE.TextureLoader();
  const paths = [
    './assets/scales/scale1.png',
    './assets/scales/scale2.png',
  ];
  scaleTextures = [];
  return Promise.all(
    paths.map(
      (p) =>
        new Promise((resolve) => {
          loader.load(
            p,
            (tex) => {
              tex.colorSpace = THREE.SRGBColorSpace;
              tex.center.set(0.5, 0.5);
              scaleTextures.push(tex);
              resolve(true);
            },
            undefined,
            () => {
              console.warn('Could not load scale texture', p);
              resolve(false);
            }
          );
        })
    )
  );
}

function initScaleFlares() {
  if (!fishGroup) return;
  const geometry = new THREE.PlaneGeometry(0.24, 0.24);

  SCALE_FLARES.forEach((entry) => {
    const factEntry = findTimelineEntry(entry.year);
    const factText = factEntry && factEntry.fact ? factEntry.fact : '';

    for (let i = 0; i < SCALE_DUPLICATES; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
        alphaTest: 0.0,
        fog: false,
      });
      const tex = scaleTextures.length
        ? scaleTextures[(entry.seed + i * 37) % scaleTextures.length]
        : null;
      if (tex) {
        mat.map = tex;
        mat.alphaMap = tex;
        mat.opacity = 1;
      } else {
        mat.color.setHex(0x9de5ff);
      }
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.renderOrder = 999;
      mesh.frustumCulled = false;

      // full-body spread along X (head-tail), Y (top-bottom), Z (depth)
      const sx = -0.4 + seededRandom(entry.seed + i, 1) * 0.9; // head to tail
      const sy = -0.4 + seededRandom(entry.seed + i, 2) * 0.8; // vertical span
      const sz = -0.3 + seededRandom(entry.seed + i, 3) * 0.6; // depth span
      const basePos = new THREE.Vector3(sx, sy, sz);

      // outward dir for flake-off
      const dx = seededRandom(entry.seed + i, 4) - 0.5;
      const dy = seededRandom(entry.seed + i, 5) - 0.5;
      const dz = seededRandom(entry.seed + i, 6) - 0.5;
      const dir = new THREE.Vector3(dx, dy, dz).normalize();

      mesh.position.copy(basePos);
      mesh.visible = false;
      fishGroup.add(mesh);

      let tooltipEl = null;
      if (scaleTooltipContainer) {
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'scale-tooltip';
        tooltipEl.textContent = factText;
        tooltipEl.style.opacity = '0';
        scaleTooltipContainer.appendChild(tooltipEl);
      }

      scaleFlares.push({
        mesh,
        basePos,
        dir,
        year: entry.year,
        seed: entry.seed + i,
        tooltipEl,
        env: 0,
      });
    }
  });
  console.log(`Initialized ${scaleFlares.length} scale flares`);
}

function updateScaleFlares(time) {
  if (!scaleFlares.length) return;

  scaleFlares.forEach((flare) => {
    const deltaYear = currentYear - flare.year;
    // visibility envelope with generous on-time and slow fade
    let env = 0;
    if (deltaYear < -1) env = 0;
    else if (deltaYear < 8) env = 1;
    else if (deltaYear < 18) env = Math.max(0, 1 - (deltaYear - 8) / 10); // slow fade after +8 years
    else env = 0;

    flare.env = env;
    if (env <= 0.001) {
      flare.mesh.visible = false;
      return;
    }

    const flakeFactor = Math.max(0, deltaYear) / 6;
    const drift = flare.dir.clone().multiplyScalar(1.2 * flakeFactor);
    const gravity = new THREE.Vector3(0, -0.4 * flakeFactor, 0);
    // subtle flutter
    const wobble = Math.sin(time * 2 + flare.seed) * 0.01;
    const wobbleVec = new THREE.Vector3(
      Math.sin(time * 1.2 + flare.seed) * 0.007,
      Math.cos(time * 1.6 + flare.seed) * 0.007,
      wobble
    );

    flare.mesh.position.copy(flare.basePos).add(drift).add(gravity).add(wobbleVec);
    // scale and shape variation
    const size = 1.6 + env * 1.3 + flakeFactor * 0.9;
    const aspect = 0.9 + seededRandom(flare.seed, 7) * 0.55;
    flare.mesh.scale.set(size, size * aspect, 1);
    const mat = flare.mesh.material;
    mat.opacity = Math.min(1, 0.7 + 0.6 * env);
    if (camera) {
      flare.mesh.lookAt(camera.position);
    }
  });
}

function updateScaleTooltips() {
  if (!scaleTooltipContainer || !scaleFlares.length || !camera || !renderer) return;
  const width = renderer.domElement.clientWidth;
  const height = renderer.domElement.clientHeight;
  const proj = new THREE.Vector3();

  scaleFlares.forEach((flare) => {
    const tooltip = flare.tooltipEl;
    if (!tooltip) return;
    // Tooltip only on selection
    const isActive = activeScaleTooltip === tooltip;
    if (!isActive) {
      tooltip.style.opacity = '0';
      return;
    }
    flare.mesh.getWorldPosition(proj);
    proj.project(camera);
    const x = (proj.x * 0.5 + 0.5) * width;
    const y = (-proj.y * 0.5 + 0.5) * height;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    tooltip.style.opacity = `${Math.min(1, flare.env)}`;
  });
}

function updateParticlesForProgress() {
  if (!particleContainer || particleElements.length === 0) return;
  // particles disabled
  particleElements.forEach((el) => {
    el.style.display = 'none';
  });
  activeParticleCount = 0;
}

function findHitboxFromObject(object) {
  // Ascend the hierarchy to find the top-level hitbox mesh
  let current = object;
  while (current) {
    if (hitboxes.includes(current)) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

function onMouseMove(event) {
  if (!renderer || !camera) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // Update raycaster
  raycaster.setFromCamera(mouse, camera);

  // Check intersections with hitboxes
  const intersects = raycaster.intersectObjects(hitboxes, true);

  const hit = intersects.find(({ object }) => findHitboxFromObject(object));

  if (hit) {
    const hitbox = findHitboxFromObject(hit.object);
    const hitPoint = hit.point;

    // Show glow at hit location
    hoverGlow.position.copy(hitPoint);
    hoverGlow.visible = true;

    // Update info text if hovering a new hitbox
    if (hitbox && currentHoveredHitbox !== hitbox.name) {
      currentHoveredHitbox = hitbox.name;
      updateInfoText(hitbox.name);
    }
  } else {
    // Hide glow if not hovering
    hoverGlow.visible = false;
    if (currentHoveredHitbox) {
      currentHoveredHitbox = null;
      updateInfoText(null);
    }
  }
}

function onMouseClick(event) {
  // Check for scale tooltip toggles (click to show/hide fact)
  if (scaleFlares.length && renderer && camera) {
    const rect = renderer.domElement.getBoundingClientRect();
    const mouseNDC = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(mouseNDC, camera);
    const flareMeshes = scaleFlares.map((f) => f.mesh);
    const hits = raycaster.intersectObjects(flareMeshes, true);
    if (hits.length > 0) {
      const hitMesh = hits[0].object;
      const flare = scaleFlares.find((f) => f.mesh === hitMesh);
      if (flare && flare.tooltipEl) {
        if (activeScaleTooltip === flare.tooltipEl) {
          // toggle off
          activeScaleTooltip = null;
          flare.tooltipEl.style.opacity = '0';
        } else {
          // set this as active, hide others
          activeScaleTooltip = flare.tooltipEl;
          scaleFlares.forEach((f) => {
            if (f.tooltipEl && f.tooltipEl !== activeScaleTooltip) {
              f.tooltipEl.style.opacity = '0';
            }
          });
        }
        return;
      }
    }
  }

  // Fallback to hitbox behavior
  onMouseMove(event);
}

function updateInfoText(hitboxName) {
  const infoElement = document.getElementById('info');
  if (!infoElement) return;

  const messages = {
    emissions: 'Carbon Emissions: gAI data centers generate massive CO₂ emissions, contributing to climate change and global warming.',
    water: 'Water Consumption: AI infrastructure requires enormous amounts of water for cooling, straining local water resources.',
    energy: 'Energy Demand: The computational power needed for gAI consumes vast amounts of electricity, often from non-renewable sources.',
    inequality: 'Global Inequality: The environmental costs of gAI disproportionately affect developing regions while benefits accrue elsewhere.',
  };

  if (hitboxName && messages[hitboxName]) {
    infoElement.textContent = messages[hitboxName];
  } else {
    infoElement.textContent = 'Spin the fish. Hover and click on glowing areas to learn more.';
  }
}

function createBubbleMaterials() {
  // --- Bubble materials ---
  // Use MeshPhysicalMaterial for realistic glass/soap bubble effect
  // Make them highly visible with transmission and clearcoat
  
  bubbleMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.02,        // very smooth/glossy
    transparent: true,
    opacity: 0.4,          // transparent but visible
    transmission: 0.95,    // high transmission for glass effect
    thickness: 0.5,        // bubble wall thickness
    ior: 1.0,              // index of refraction (air-like)
    reflectivity: 1.0,
    clearcoat: 1.0,        // glossy clearcoat
    clearcoatRoughness: 0.05,
    side: THREE.DoubleSide,
    emissive: 0x88ccff,    // blue glow
    emissiveIntensity: 0.15,
    envMapIntensity: 1.0
  });

  // Edge material - brighter rim for soap bubble effect
  bubbleEdgeMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xa0e8ff), // brighter blue-green tint
    metalness: 0,
    roughness: 0.1,
    transparent: true,
    opacity: 0.8,          // more opaque rim
    transmission: 0.7,     // less transmission for visible edge
    thickness: 0.2,
    ior: 1.1,
    clearcoat: 1.0,
    clearcoatRoughness: 0.0, // perfectly smooth edge
    side: THREE.DoubleSide,
    emissive: 0xa0e8ff,    // bright rim glow
    emissiveIntensity: 0.4
  });
  
  console.log('Bubble materials created with transmission');
}

function createBubble(position, radius = 0.15) {
  if (!bubbleMaterial || !bubbleEdgeMaterial) {
    console.warn('Bubble materials not initialized yet');
    return null;
  }
  
  // Create inner glassy sphere with higher detail
  const geo = new THREE.SphereGeometry(radius, 32, 32);
  const inner = new THREE.Mesh(geo, bubbleMaterial.clone());
  
  // Create slightly larger shell for the colored rim (soap bubble edge effect)
  const edgeGeo = new THREE.SphereGeometry(radius * 1.05, 32, 32); // slightly larger for visible rim
  const edge = new THREE.Mesh(edgeGeo, bubbleEdgeMaterial.clone());
  
  // Create bubble group
  const group = new THREE.Group();
  group.add(inner);
  group.add(edge);
  group.position.copy(position);
  
  // Store bubble data for animation
  group.userData.wobblePhase = Math.random() * Math.PI * 2;
  group.userData.radius = radius;
  group.userData.velocity = {
    x: (Math.random() - 0.5) * 0.008, // slower initial velocity
    y: Math.random() * 0.01 + 0.005, // slower upward bias
    z: (Math.random() - 0.5) * 0.008, // slower initial velocity
  };
  group.userData.basePosition = position.clone();
  
  scene.add(group);
  bubbles.push(group);
  activeBubbleCount++;
  
  if (bubbles.length % 5 === 0) {
    console.log(`Created bubble ${bubbles.length} at`, position);
  }
  
  return group;
}

function spawnBubble() {
  if (activeBubbleCount >= MAX_BUBBLES || !fishGroup) return;
  
  // Spawn near fish surface - distance increases with progress
  const baseRadius = 0.3;
  const maxRadius = 0.8;
  const spawnRadius = baseRadius + (maxRadius - baseRadius) * progress;
  
  // Random position on sphere around fish
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(Math.random() * 2 - 1);
  
  const fishPos = fishGroup.position;
  const spawnPos = new THREE.Vector3(
    fishPos.x + spawnRadius * Math.sin(phi) * Math.cos(theta),
    fishPos.y + spawnRadius * Math.sin(phi) * Math.sin(theta),
    fishPos.z + spawnRadius * Math.cos(phi)
  );
  
  // Random bubble size
  const bubbleRadius = 0.08 + Math.random() * 0.06;
  
  createBubble(spawnPos, bubbleRadius);
}

function spawnInitialBubbles() {
  if (!BUBBLES_ENABLED) return;
  if (!fishGroup || !bubbleMaterial) {
    console.warn('Cannot spawn initial bubbles - fish or materials not ready');
    return;
  }
  
  // Spawn 8-12 initial bubbles around the fish for immediate visibility
  const initialCount = 8 + Math.floor(Math.random() * 5);
  const fishPos = fishGroup.position;
  
  console.log(`Spawning ${initialCount} initial bubbles around fish at`, fishPos);
  
  for (let i = 0; i < initialCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const radius = 0.3 + Math.random() * 0.4; // closer to fish for visibility
    
    const spawnPos = new THREE.Vector3(
      fishPos.x + radius * Math.sin(phi) * Math.cos(theta),
      fishPos.y + radius * Math.sin(phi) * Math.sin(theta),
      fishPos.z + radius * Math.cos(phi)
    );
    
    // Make bubbles slightly larger for better visibility
    const bubbleRadius = 0.12 + Math.random() * 0.1;
    const bubble = createBubble(spawnPos, bubbleRadius);
    
    if (!bubble) {
      console.warn(`Failed to create bubble ${i}`);
    }
  }
  
  console.log(`Successfully spawned ${bubbles.length} initial bubbles`);
}

function onWindowResize() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateFishAppearance() {
  if (!fishMaterials || fishMaterials.length === 0) return;

  // progress 0 -> 1 : vibrant -> grey/dull
  const pollutedColor = new THREE.Color(0x3a3a3a);

  // Ease progress so early years barely change visuals
  const visual = Math.pow(progress, 1.3);

  // Update all materials with color tint and roughness
  fishMaterials.forEach((mat) => {
    // Get the original/base color (store it on first call if not already stored)
    if (!mat.userData.originalColor) {
      mat.userData.originalColor = mat.color.clone();
    }
    
    // Tint the original color toward polluted state using eased progress
    mat.color.copy(mat.userData.originalColor).lerp(pollutedColor, visual * 0.6);
    
    // Increase roughness (less shiny) as pollution increases
    if (!mat.userData.originalRoughness) {
      mat.userData.originalRoughness = mat.roughness !== undefined ? mat.roughness : 0.3;
    }
    mat.roughness = mat.userData.originalRoughness + visual * 0.3;
  });

  // Fog color and density (kept light to preserve vivid color)
  const cleanFog = new THREE.Color(0x01050a);
  const dirtyFog = new THREE.Color(0x04070b);
  const fogColor = cleanFog.clone().lerp(dirtyFog, visual);
  scene.fog.color.copy(fogColor);
  
  // Keep fog subtle so the fish stays crisp
  const baseDensity = 0.01;
  const maxDensity = 0.04;
  scene.fog.density = baseDensity + (maxDensity - baseDensity) * visual;

  // Update hitbox glow intensity (subtle at low progress, brighter at high progress)
  hitboxGlows.forEach((glow) => {
    if (glow && glow.material) {
      const minIntensity = 0.3;
      const maxIntensity = 1.5;
      glow.material.emissiveIntensity = minIntensity + (maxIntensity - minIntensity) * visual;
      // keep glows hidden; hoverGlow indicates hover instead
      glow.visible = false;
      glow.material.opacity = 0.0;
    }
  });

}

function disposeBubble(bubble) {
  bubble.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}

function updateBubbles(deltaTime) {
  if (!BUBBLES_ENABLED) return;
  if (!fishGroup) return;
  
  const fishPos = fishGroup.position;
  const maxDistance = 2.0 + progress * 3.0; // max distance increases with progress
  
  // Update existing bubbles
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const bubble = bubbles[i];
    if (!bubble.parent) {
      // Bubble was removed, clean up
      disposeBubble(bubble);
      bubbles.splice(i, 1);
      activeBubbleCount--;
      continue;
    }
    
    // Update position based on velocity (slower movement)
    bubble.position.x += bubble.userData.velocity.x * 0.5; // slow down horizontal
    bubble.position.y += bubble.userData.velocity.y * 0.3; // slow down vertical
    bubble.position.z += bubble.userData.velocity.z * 0.5; // slow down depth
    
    // Update velocity (much slower drift)
    const driftSpeed = 0.002 + progress * 0.005; // much slower
    bubble.userData.velocity.y += driftSpeed * 0.0003; // very slight upward acceleration
    
    // Check distance from fish (much larger max distance so bubbles persist longer)
    const dx = bubble.position.x - fishPos.x;
    const dy = bubble.position.y - fishPos.y;
    const dz = bubble.position.z - fishPos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Remove bubbles that drift too far (increased max distance significantly)
    const extendedMaxDistance = 5.0 + progress * 5.0; // bubbles can go much further
    if (distance > extendedMaxDistance) {
      scene.remove(bubble);
      disposeBubble(bubble);
      bubbles.splice(i, 1);
      activeBubbleCount--;
    }
  }
  
  // Spawn new bubbles - slower spawn rate
  const baseSpawnRate = 0.5; // bubbles per second at progress = 0 (slower)
  const maxSpawnRate = 1.5; // bubbles per second at progress = 1 (slower)
  const currentSpawnRate = baseSpawnRate + (maxSpawnRate - baseSpawnRate) * progress;
  
  bubbleSpawnTimer += deltaTime;
  const spawnInterval = 1.0 / currentSpawnRate;
  
  while (bubbleSpawnTimer >= spawnInterval && activeBubbleCount < MAX_BUBBLES) {
    spawnBubble();
    bubbleSpawnTimer -= spawnInterval;
  }
  
  // Update bubble colors with progress (keep them colorful, only slight fade)
  const healthyColor = new THREE.Color(0xffffff);
  const slightlyPollutedColor = new THREE.Color(0xddddff); // slight blue-grey, not grey
  
  bubbles.forEach((bubble) => {
    const inner = bubble.children[0];
    const edge = bubble.children[1];
    
    if (inner && inner.material) {
      // Keep bubbles white/blue, only slight tint towards pollution
      inner.material.color.lerpColors(healthyColor, slightlyPollutedColor, progress * 0.2);
      // Keep emissive glow bright
      inner.material.emissiveIntensity = 0.15 + (0.05 * progress); // stays bright
    }
    if (edge && edge.material) {
      const healthyEdge = new THREE.Color(0xa0e8ff); // bright blue-green
      const slightlyPollutedEdge = new THREE.Color(0x88c8ff); // still blue, not grey
      edge.material.color.lerpColors(healthyEdge, slightlyPollutedEdge, progress * 0.3);
      // Keep edge glow bright
      edge.material.emissiveIntensity = 0.4 + (0.1 * progress); // stays bright
    }
  });
}

function animate() {
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta(); // updates internal elapsedTime
  const t = clock.elapsedTime;

  // Update GLB animations if they exist
  if (animationMixer) {
    animationMixer.update(deltaTime);
  }

  // Progress is now controlled by timeline slider, not time-based
  // (progress is updated in setupTimelineSlider's event listener)

  // Comprehensive swim motion - intensity decreases as pollution increases (fish becomes sluggish)
  const swimIntensity = 1.0 - 0.5 * progress; // slower at 2050
  
  // Update overall swim phase for coordinated movement
  swimPhase += deltaTime * swimIntensity;
  
  if (fishGroup) {
    // Store base position on first frame if not set (should be set when fish loads)
    if (!fishGroup.userData.basePosition) {
      fishGroup.userData.basePosition = new THREE.Vector3(0, 0, 0);
      fishGroup.userData.baseRotation = new THREE.Euler(0, -Math.PI / 2, 0);
    }
    
    const basePos = fishGroup.userData.basePosition;
    const baseRot = fishGroup.userData.baseRotation;
    
    if (hasGLTFAnimations) {
      // Do not apply any procedural root motion; let the GLTF clip fully own transforms.
    } else {
      // Procedural swim path when no embedded animation is present
      const swimSpeed = 0.6 * swimIntensity;
      const bobSpeed = 0.8 * swimIntensity;
      const swaySpeed = 2.5 * swimIntensity;
      
      // Vertical bob (breathing/floating motion with multiple frequencies)
      const verticalBob = Math.sin(t * bobSpeed) * 0.12 + Math.sin(t * bobSpeed * 0.5) * 0.05;
      
      // Swimming forward/back arc (more natural path with multiple phases)
      const swimPhase1 = t * 0.3 * swimIntensity;
      const swimPhase2 = t * 0.2 * swimIntensity;
      const forwardArc = Math.sin(swimPhase1) * 0.25 + Math.cos(swimPhase2) * 0.15;
      const sideArc = Math.cos(swimPhase1) * 0.15 + Math.sin(swimPhase2) * 0.08;
      
      // Apply position offsets from base (ensure base is at origin)
      fishGroup.position.x = (basePos.x || 0) + forwardArc;
      fishGroup.position.y = (basePos.y || 0) + verticalBob;
      fishGroup.position.z = (basePos.z || 0) + sideArc;
      
      // Body sway (yaw + roll + pitch) - more natural movement with variation
      const yawPhase = t * swaySpeed;
      const rollPhase = t * 1.8 * swimIntensity;
      const pitchPhase = t * 0.9 * swimIntensity;
      
      // More pronounced swimming motion
      const yawAmount = Math.sin(yawPhase) * 0.35 * swimIntensity + Math.cos(yawPhase * 0.7) * 0.15 * swimIntensity;
      const rollAmount = Math.sin(rollPhase) * 0.15 * swimIntensity;
      const pitchAmount = Math.sin(pitchPhase) * 0.08 * swimIntensity;
      
      // Apply rotation offsets from base (ensure base rotation is correct)
      const baseY = (baseRot && baseRot.y !== undefined) ? baseRot.y : -Math.PI / 2;
      const baseZ = (baseRot && baseRot.z !== undefined) ? baseRot.z : 0;
      const baseX = (baseRot && baseRot.x !== undefined) ? baseRot.x : 0;
      
      fishGroup.rotation.y = baseY + yawAmount; // left-right with variation
      fishGroup.rotation.z = baseZ + rollAmount; // subtle roll
      fishGroup.rotation.x = baseX + pitchAmount; // subtle pitch (nose up/down)
    }
  }
  
  // Comprehensive tail animation (if tail meshes exist)
  if (tailMeshes.length > 0) {
    const tailWaveSpeed = 6 * swimIntensity;
    const tailWaveAmount = 0.5 * swimIntensity;
    if (!hasGLTFAnimations) {
      tailMeshes.forEach((m, i) => {
        // More complex tail movement with multiple wave frequencies
        const phase1 = t * tailWaveSpeed + i * 0.3;
        const phase2 = t * tailWaveSpeed * 1.5 + i * 0.5;
        m.rotation.y = Math.sin(phase1) * tailWaveAmount + Math.sin(phase2) * tailWaveAmount * 0.3;
        m.rotation.z = Math.cos(phase1 * 0.8) * tailWaveAmount * 0.4; // side-to-side tail movement
      });
    }
  }
  
  // Comprehensive fin animation (if fin meshes exist)
  if (finMeshes.length > 0) {
    const finFlapSpeed = 9 * swimIntensity;
    const finFlapAmount = 0.25 * swimIntensity;
    if (!hasGLTFAnimations) {
      finMeshes.forEach((m, i) => {
        // Different fin types get different animations
        const lowerName = m.name.toLowerCase();
        const phase = t * finFlapSpeed + i * 0.5;
        
        if (lowerName.includes('dorsal')) {
          // Dorsal fin: gentle wave
          m.rotation.z = Math.sin(phase) * finFlapAmount * 0.8;
          m.rotation.x = Math.cos(phase * 0.7) * finFlapAmount * 0.3;
        } else if (lowerName.includes('pectoral')) {
          // Pectoral fins: flapping motion
          m.rotation.z = Math.sin(phase * 1.2) * finFlapAmount;
          m.rotation.y = Math.cos(phase * 0.9) * finFlapAmount * 0.5;
        } else if (lowerName.includes('anal')) {
          // Anal fin: subtle movement
          m.rotation.z = Math.sin(phase * 0.8) * finFlapAmount * 0.6;
        } else {
          // Generic fin movement
          m.rotation.z = Math.sin(phase) * finFlapAmount;
          m.rotation.x = Math.cos(phase * 0.7) * finFlapAmount * 0.3;
        }
      });
    }
  }
  
  // Spine wave animation: sequenced sway along the body for a coherent swim loop
  if (spineSegments.length > 0 && !hasGLTFAnimations) {
    const spineSpeed = 3.6 * swimIntensity;
    const spinePhase = t * spineSpeed;
    const yawAmplitude = 0.35 * swimIntensity;
    const pitchAmplitude = 0.07 * swimIntensity;
    const rollAmplitude = 0.1 * swimIntensity;

    spineSegments.forEach(({ mesh, t }) => {
      const baseRot = mesh.userData.baseRotation || mesh.rotation;
      const basePos = mesh.userData.basePosition || mesh.position;
      const phase = spinePhase + t * Math.PI * 1.2;

      // Yaw-driven serpentine spine
      mesh.rotation.y = baseRot.y + Math.sin(phase) * yawAmplitude * (0.6 + t * 0.8);
      mesh.rotation.z = baseRot.z + Math.sin(phase * 0.7) * rollAmplitude * (0.5 + t * 0.5);
      mesh.rotation.x = baseRot.x + Math.cos(phase * 0.9) * pitchAmplitude * (0.6 + (1 - t) * 0.4);

      // Subtle lateral offset to avoid robotic pivoting
      mesh.position.x = basePos.x;
      mesh.position.y = basePos.y + Math.sin(phase + Math.PI / 2) * 0.01 * swimIntensity;
      mesh.position.z = basePos.z + Math.sin(phase) * 0.02 * swimIntensity;
    });
  }

  updateFishAppearance();
  updateBubbles(deltaTime);
  
  // Animate bubble wobble (subtle scale changes only - position handled in updateBubbles)
  if (BUBBLES_ENABLED) {
    bubbles.forEach((bubble) => {
      if (bubble.userData && bubble.userData.wobblePhase !== undefined) {
        const phase = bubble.userData.wobblePhase;
        const scale = 1 + Math.sin(t * 2.0 + phase) * 0.03;
        bubble.scale.setScalar(scale);
        // Subtle rotation for more dynamic look
        bubble.rotation.x += Math.sin(t * 1.2 + phase) * 0.002;
        bubble.rotation.y += Math.cos(t * 1.5 + phase) * 0.002;
      }
    });
  }

  // Animate hover glow
  if (hoverGlow && hoverGlow.visible) {
    const pulse = Math.sin(t * 4) * 0.05 + 1;
    hoverGlow.scale.setScalar(pulse);
    hoverGlow.material.emissiveIntensity = 1.5 + Math.sin(t * 6) * 0.5;
  }

  updateFishGlowTransforms();
  updateScaleFlares(t);
  updateScaleTooltips();

  // Keep orbit controls focused on the fish so rotations feel intuitive and the fish stays on screen
  if (controls) {
    if (fishGroup) {
      fishGroup.getWorldPosition(cameraTarget);
      controls.target.lerp(cameraTarget, 0.2);
    }
    controls.update();
  }

  renderer.render(scene, camera);
}
