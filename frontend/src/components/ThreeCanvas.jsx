import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ThreeCanvas({ themeColor = '#00ffaa' }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Setup Scene, Camera, and Renderer
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    // Subtle fog to create depth
    scene.fog = new THREE.FogExp2('#030712', 0.08);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 8;
    camera.position.y = 1;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 2. Create the floating 3D Quant Crystal (Icosahedron)
    const crystalColor = new THREE.Color(themeColor);
    
    // Core geometry
    const geometry = new THREE.IcosahedronGeometry(1.6, 0); // Flat facets
    
    // Material 1: Semitransparent solid core
    const coreMaterial = new THREE.MeshPhysicalMaterial({
      color: crystalColor,
      roughness: 0.1,
      metalness: 0.9,
      transmission: 0.6, // Glass-like transparency
      ior: 1.5,
      thickness: 1.0,
      transparent: true,
      opacity: 0.6,
      flatShading: true,
      side: THREE.DoubleSide
    });
    
    const crystal = new THREE.Mesh(geometry, coreMaterial);
    scene.add(crystal);

    // Material 2: Wireframe shell for high-tech look
    const wireGeometry = new THREE.IcosahedronGeometry(1.63, 0);
    const wireMaterial = new THREE.MeshBasicMaterial({
      color: crystalColor,
      wireframe: true,
      transparent: true,
      opacity: 0.3
    });
    const wireframeMesh = new THREE.Mesh(wireGeometry, wireMaterial);
    crystal.add(wireframeMesh);

    // 3. Create a grid ring surrounding the crystal
    const ringGeometry = new THREE.RingGeometry(2.4, 2.5, 64);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: crystalColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);

    // Dynamic grid pattern points around the ring
    const pointsCount = 40;
    const pointsGeometry = new THREE.BufferGeometry();
    const pointsPositions = new Float32Array(pointsCount * 3);
    const pointsSpeeds = [];

    for (let i = 0; i < pointsCount; i++) {
      const angle = (i / pointsCount) * Math.PI * 2;
      const radius = 2.45;
      pointsPositions[i * 3] = Math.cos(angle) * radius;
      pointsPositions[i * 3 + 1] = 0;
      pointsPositions[i * 3 + 2] = Math.sin(angle) * radius;
      pointsSpeeds.push(0.5 + Math.random() * 1.5);
    }

    pointsGeometry.setAttribute('position', new THREE.BufferAttribute(pointsPositions, 3));
    const pointsMaterial = new THREE.PointsMaterial({
      color: crystalColor,
      size: 0.08,
      transparent: true,
      opacity: 0.8
    });
    const orbitPoints = new THREE.Points(pointsGeometry, pointsMaterial);
    scene.add(orbitPoints);

    // 4. Create floating ambient particle stars background
    const starsCount = 150;
    const starsGeometry = new THREE.BufferGeometry();
    const starsPositions = new Float32Array(starsCount * 3);

    for (let i = 0; i < starsCount * 3; i += 3) {
      starsPositions[i] = (Math.random() - 0.5) * 15;
      starsPositions[i + 1] = (Math.random() - 0.5) * 10;
      starsPositions[i + 2] = (Math.random() - 0.5) * 15;
    }

    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.03,
      transparent: true,
      opacity: 0.4
    });
    const starField = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(starField);

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(themeColor, 8, 15);
    pointLight1.position.set(3, 4, 3);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight('#a855f7', 4, 15);
    pointLight2.position.set(-3, -3, -3);
    scene.add(pointLight2);

    // 6. Interactive Mouse Movement (tilt effects)
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (event) => {
      const rect = container.getBoundingClientRect();
      // Normalized coordinates -1 to 1
      mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    container.addEventListener('mousemove', handleMouseMove);

    // 7. Render Loop
    let clock = new THREE.Clock();
    let animationFrameId;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Floating wave animation (Sine wave)
      crystal.position.y = Math.sin(elapsedTime * 1.5) * 0.15;
      
      // Rotations
      crystal.rotation.y += 0.006;
      crystal.rotation.x += 0.003;
      
      ring.rotation.z -= 0.002;
      orbitPoints.rotation.y += 0.005;

      // Particle movements (drift down)
      const positions = starField.geometry.attributes.position.array;
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] -= 0.002; // slow falling
        if (positions[i] < -5) {
          positions[i] = 5; // wrap around
        }
      }
      starField.geometry.attributes.position.needsUpdate = true;

      // Interpolate core rotation to follow target mouse position
      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;

      crystal.rotation.z = targetX * 0.3;
      crystal.rotation.x = targetY * 0.3 + (elapsedTime * 0.15); // combine base rotation + tilt

      renderer.render(scene, camera);
    };

    animate();

    // 8. Handle Resize
    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Clean up
    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      coreMaterial.dispose();
      wireGeometry.dispose();
      wireMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      pointsGeometry.dispose();
      pointsMaterial.dispose();
      starsGeometry.dispose();
      starsMaterial.dispose();
      renderer.dispose();
    };
  }, [themeColor]);

  return <div ref={containerRef} className="three-canvas-wrapper" />;
}
