/**
 * TECHFEST 2026 IIT BOMBAY — 3D Interactive Script
 * Features: Three.js Particles, GSAP ScrollTrigger Morphing, 3D Pass Flipper, & Dynamic Interactions
 */

document.addEventListener('DOMContentLoaded', () => {
  /* ============================================================
     1. INITIALIZATION & SETUP
     ============================================================ */
  
  // Elements
  const canvas = document.getElementById('webgl-canvas');
  const navbar = document.getElementById('navbar');
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  const ticketCard = document.getElementById('ticketCard');
  const registerForm = document.getElementById('techfestRegisterForm');
  
  // Three.js Core Variables
  let scene, camera, renderer, particles;
  const particleCount = 6000;
  
  // Particle Arrays for States
  const posSphere = new Float32Array(particleCount * 3);
  const posRings = new Float32Array(particleCount * 3);
  const posWave = new Float32Array(particleCount * 3);
  const posTunnel = new Float32Array(particleCount * 3);
  
  // Animation Morph State
  const morphState = { progress: 0 };
  
  // Interactive variables
  let mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
  let explosionActive = false;
  let explosionFactor = 0;
  const particleVelocities = new Float32Array(particleCount * 3);
  
  // Helper: check prefers reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============================================================
     2. THREE.JS WEBGL SYSTEM
     ============================================================ */
  
  function initWebGL() {
    // 1. Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030008, 0.08);

    // 2. Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 8);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x030008, 1);

    // 4. Generate Particle States
    generateStates();

    // 5. Create Points Geometry
    const geometry = new THREE.BufferGeometry();
    // Start with the sphere state
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(posSphere), 3));
    
    // Add custom colors to particles (gradient cyan to magenta)
    const colors = new Float32Array(particleCount * 3);
    const colorCyan = new THREE.Color(0x00f5ff);
    const colorMagenta = new THREE.Color(0xff007f);
    
    for (let i = 0; i < particleCount; i++) {
      const mixRatio = i / particleCount;
      const mixedColor = new THREE.Color().lerpColors(colorCyan, colorMagenta, mixRatio);
      colors[i * 3] = mixedColor.r;
      colors[i * 3 + 1] = mixedColor.g;
      colors[i * 3 + 2] = mixedColor.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Custom Particle Shader / Texture Material
    // Create a circular glowing canvas texture manually to avoid loading delay or image path issues
    const particleTexture = createCircularTexture();

    const material = new THREE.PointsMaterial({
      size: 0.06,
      map: particleTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true
    });

    // 6. Create Points Object
    particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Initialise Scroll animations
    if (!prefersReducedMotion) {
      initScrollAnimations();
    }
    
    // Resize Listener
    window.addEventListener('resize', onWindowResize);
    
    // Mouse Interaction
    window.addEventListener('mousemove', onMouseMove);
    
    // Start loop
    animate();
  }

  // Generate coordinates for various layout shapes
  function generateStates() {
    for (let i = 0; i < particleCount; i++) {
      // 1. Sphere State
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const rSphere = 2.8 + Math.random() * 0.6;
      posSphere[i * 3] = rSphere * Math.sin(phi) * Math.cos(theta);
      posSphere[i * 3 + 1] = rSphere * Math.sin(phi) * Math.sin(theta);
      posSphere[i * 3 + 2] = rSphere * Math.cos(phi);

      // 2. Twin Orbital Rings
      const isOuter = i % 2 === 0;
      const rRing = isOuter ? 4.5 : 2.5;
      const tRing = Math.random() * 2 * Math.PI;
      const ringSpread = (Math.random() - 0.5) * 0.15;
      if (isOuter) {
        posRings[i * 3] = rRing * Math.cos(tRing);
        posRings[i * 3 + 1] = ringSpread;
        posRings[i * 3 + 2] = rRing * Math.sin(tRing);
      } else {
        posRings[i * 3] = rRing * Math.cos(tRing);
        posRings[i * 3 + 1] = rRing * Math.sin(tRing);
        posRings[i * 3 + 2] = ringSpread;
      }

      // 3. Grid / Wave State
      const gridWidth = Math.floor(Math.sqrt(particleCount));
      const rIndex = Math.floor(i / gridWidth);
      const cIndex = i % gridWidth;
      const wX = (rIndex - gridWidth / 2) * 0.28;
      const wZ = (cIndex - gridWidth / 2) * 0.28;
      posWave[i * 3] = wX;
      posWave[i * 3 + 1] = Math.sin(Math.sqrt(wX * wX + wZ * wZ) * 0.7) * 0.6 - 0.5;
      posWave[i * 3 + 2] = wZ;

      // 4. Cylindrical Tunnel State
      const rTunnel = 2.0 + Math.random() * 0.8;
      const tTunnel = Math.random() * 2 * Math.PI;
      const zTunnel = (Math.random() - 0.5) * 16.0;
      posTunnel[i * 3] = rTunnel * Math.cos(tTunnel);
      posTunnel[i * 3 + 1] = rTunnel * Math.sin(tTunnel);
      posTunnel[i * 3 + 2] = zTunnel;
    }
  }

  // Create a canvas texture for round, glowing particles
  function createCircularTexture() {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 16;
    pCanvas.height = 16;
    const ctx = pCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 16);
    return new THREE.CanvasTexture(pCanvas);
  }

  /* ============================================================
     3. SCROLLBINDING VIA GSAP & SCROLLTRIGGER
     ============================================================ */
  
  function initScrollAnimations() {
    gsap.registerPlugin(ScrollTrigger);

    // Bind scroll progress directly to particle morph target
    gsap.to(morphState, {
      progress: 3.0,
      ease: 'none',
      scrollTrigger: {
        trigger: 'body',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1.2
      }
    });

    // Camera movements along the scroll path
    const mainTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: 'body',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1.5
      }
    });

    // Section 1 (Hero) -> Section 2 (Events)
    mainTimeline.to(camera.position, { x: 0, y: 3, z: 6 }, 0);
    mainTimeline.to(camera.rotation, { x: -0.3, y: 0, z: 0 }, 0);

    // Section 2 (Events) -> Section 3 (Exhibitions)
    mainTimeline.to(camera.position, { x: -3.5, y: 1.5, z: 5 }, 1);
    mainTimeline.to(camera.rotation, { x: -0.15, y: 0.35, z: 0.1 }, 1);

    // Section 3 (Exhibitions) -> Section 4 (Register)
    mainTimeline.to(camera.position, { x: 0, y: 0.3, z: 4.8 }, 2);
    mainTimeline.to(camera.rotation, { x: 0, y: 0, z: 0 }, 2);
  }

  /* ============================================================
     4. RENDER LOOP & PARTICLE MORPHING
     ============================================================ */
  
  function animate(time) {
    requestAnimationFrame(animate);

    // 1. Soft Mouse Tilt Interaction on WebGL Object
    mouse.x += (mouse.targetX - mouse.x) * 0.05;
    mouse.y += (mouse.targetY - mouse.y) * 0.05;
    
    if (particles) {
      // Rotation animation baseline
      particles.rotation.y = time * 0.00015;
      
      // Tilt using smooth mouse values
      particles.rotation.x = mouse.y * 0.15;
      particles.rotation.z = mouse.x * 0.1;
      
      // Update geometry positions based on scroll morph state
      const positions = particles.geometry.attributes.position.array;
      const progress = morphState.progress;
      
      // Determine morph limits and interpolation fraction
      let srcArray, destArray;
      let tFraction = 0;
      
      if (progress < 1.0) {
        srcArray = posSphere;
        destArray = posRings;
        tFraction = progress;
      } else if (progress < 2.0) {
        srcArray = posRings;
        destArray = posWave;
        tFraction = progress - 1.0;
      } else {
        srcArray = posWave;
        destArray = posTunnel;
        tFraction = progress - 2.0;
      }
      
      // Apply smoothstep to transition ease
      const smoothFraction = tFraction * tFraction * (3 - 2 * tFraction);

      // Map positions
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        
        // Target base morph location
        let targetX = srcArray[i3] + (destArray[i3] - srcArray[i3]) * smoothFraction;
        let targetY = srcArray[i3 + 1] + (destArray[i3 + 1] - srcArray[i3 + 1]) * smoothFraction;
        let targetZ = srcArray[i3 + 2] + (destArray[i3 + 2] - srcArray[i3 + 2]) * smoothFraction;

        // Apply dynamic wave modulation if in grid state
        if (progress >= 1.0 && progress < 3.0) {
          const wavePhase = time * 0.0025;
          const dist = Math.sqrt(targetX * targetX + targetZ * targetZ);
          // Modulate Y height with wave
          targetY += Math.sin(dist * 0.8 - wavePhase) * 0.25;
        }

        // Apply interactive mouse displacement
        // Project mouse vector to 3D space loosely
        const mX = mouse.x * 3;
        const mY = -mouse.y * 3;
        const dX = targetX - mX;
        const dY = targetY - mY;
        const distToMouse = Math.sqrt(dX * dX + dY * dY);
        
        if (distToMouse < 1.2) {
          const force = (1.2 - distToMouse) * 0.15;
          targetX += (dX / distToMouse) * force;
          targetY += (dY / distToMouse) * force;
        }

        // Calculate and apply dynamic particle explosion force
        if (explosionActive) {
          targetX += particleVelocities[i3] * explosionFactor;
          targetY += particleVelocities[i3 + 1] * explosionFactor;
          targetZ += particleVelocities[i3 + 2] * explosionFactor;
        }

        // Apply final values to render buffer
        positions[i3] = targetX;
        positions[i3 + 1] = targetY;
        positions[i3 + 2] = targetZ;
      }
      
      particles.geometry.attributes.position.needsUpdate = true;
    }

    // 2. Animate explosion lifecycle
    if (explosionActive) {
      explosionFactor += 0.05;
      if (explosionFactor > 4.5) {
        // Slow down and collapse back to target shape
        explosionActive = false;
        gsap.to(morphState, {
          duration: 1.5,
          onComplete: () => {
            explosionFactor = 0;
          }
        });
      }
    }

    renderer.render(scene, camera);
  }

  // Particle explosion burst on registration pass generation
  function triggerParticleExplosion() {
    explosionFactor = 0;
    explosionActive = true;
    
    // Assign random explosion vector to particles
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(Math.random() * 2 - 1);
      const speed = 0.5 + Math.random() * 0.8;
      
      particleVelocities[i3] = speed * Math.sin(phi) * Math.cos(theta);
      particleVelocities[i3 + 1] = speed * Math.sin(phi) * Math.sin(theta);
      particleVelocities[i3 + 2] = speed * Math.cos(phi);
    }
  }

  // Windows Event Handlers
  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function onMouseMove(e) {
    // Normalise cursor coords from -1 to 1
    mouse.targetX = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.targetY = (e.clientY / window.innerHeight) * 2 - 1;
  }

  /* ============================================================
     5. HTML CARDS REVEAL INTERSECTORS
     ============================================================ */
  
  const revealElements = document.querySelectorAll('.reveal');
  
  if (revealElements.length) {
    if (prefersReducedMotion) {
      revealElements.forEach(el => el.classList.add('active'));
    } else {
      const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, idx) => {
          if (entry.isIntersecting) {
            // Slight stagger delay for adjacent elements
            setTimeout(() => {
              entry.target.classList.add('active');
            }, idx * 100);
            revealObserver.unobserve(entry.target);
          }
        });
      }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      });
      revealElements.forEach(el => revealObserver.observe(el));
    }
  }

  /* ============================================================
     6. NAVBAR INTERACTIVITY
     ============================================================ */
  
  // Scrolled Navbar background trigger
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    trackActiveNavSections();
  });

  // Highlight active link based on viewport scroll sections
  const sections = document.querySelectorAll('section');
  const navLinksList = document.querySelectorAll('.nav-link');

  function trackActiveNavSections() {
    let activeSectionId = 'hero';
    const offset = 120;
    
    sections.forEach(sec => {
      const top = sec.offsetTop - offset;
      const bottom = top + sec.offsetHeight;
      if (window.scrollY >= top && window.scrollY < bottom) {
        activeSectionId = sec.id;
      }
    });

    navLinksList.forEach(link => {
      const href = link.getAttribute('href').substring(1);
      if (href === activeSectionId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  // Hamburger toggle menu
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const isExpanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', !isExpanded);
      navLinks.style.display = isExpanded ? 'none' : 'flex';
      navLinks.style.flexDirection = 'column';
      navLinks.style.position = 'absolute';
      navLinks.style.top = 'var(--nav-height)';
      navLinks.style.left = '0';
      navLinks.style.width = '100%';
      navLinks.style.background = 'var(--glass-bg-heavy)';
      navLinks.style.backdropFilter = 'blur(16px)';
      navLinks.style.padding = '2rem';
      navLinks.style.borderBottom = '1px solid var(--glass-border)';
    });

    // Close menu when a link is clicked on mobile viewports
    navLinks.querySelectorAll('a').forEach(anchor => {
      anchor.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          navLinks.style.display = 'none';
          navToggle.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }

  /* ============================================================
     7. TICKET GENERATION & FORM HANDLER
     ============================================================ */
  
  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const usernameInput = document.getElementById('username').value.trim();
      const branchInput = document.getElementById('userbranch').value.trim();
      
      // Update ticket back fields
      document.getElementById('ticketName').textContent = usernameInput.toUpperCase();
      document.getElementById('ticketBranch').textContent = branchInput.toUpperCase();
      
      // Generate unique registration pass serial code
      const randomId = Math.floor(1000 + Math.random() * 9000);
      document.getElementById('ticketPassId').textContent = `#TFT-${randomId}-B`;
      
      // Trigger WebGL Particle explosion burst
      if (!prefersReducedMotion) {
        triggerParticleExplosion();
      }
      
      // Flip the 3D card pass
      if (ticketCard) {
        ticketCard.classList.add('flipped');
      }
    });
  }

  /* ============================================================
     8. START SYSTEM
     ============================================================ */
  initWebGL();
  
  console.log('%c⚡ TECHFEST IIT Bombay Core initialized. Portal online. ⚡', 'color: #00F5FF; font-size: 14px; font-weight: bold;');
});
