import React, { useEffect, useRef } from 'react';
import earthImage from '../images/earth_clouds.jpg';
import * as THREE from 'three';

export const Earth = ({
  width = 400,
  height = 400,
  earthSize = 1,
  style = {},
  ...rest
}: EarthProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const frameRef = useRef<number>(0);
  const initializedRef = useRef(false); // prevents double initialization in strict mode

  useEffect(() => {
    // guard against strict mode double execution
    if (initializedRef.current || !containerRef.current) return;
    initializedRef.current = true;

    const container = containerRef.current;

    // scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 3);
    camera.lookAt(0, 0, 0);

    // renderer with transparent background
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // earth geometry
    const geometry = new THREE.SphereGeometry(earthSize, 64, 64);

    // texture loader
    const textureLoader = new THREE.TextureLoader();
    const earthTexture = textureLoader.load(earthImage);

    // material with texture
    const material = new THREE.MeshStandardMaterial({
      map: earthTexture,
      metalness: 0.1,
      roughness: 0.8,
    });

    const earth = new THREE.Mesh(geometry, material);
    scene.add(earth);

    // lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 3.2);
    scene.add(ambientLight);

    // const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    // directionalLight.position.set(5, 3, 5);
    // scene.add(directionalLight);

    // animation loop
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);

      // rotate earth around y-axis
      // earth.rotation.y += 0.002;

      earth.rotation.y += 0.0004;

      renderer.render(scene, camera);
    };

    animate();

    // cleanup
    return () => {
      cancelAnimationFrame(frameRef.current);

      geometry.dispose();
      material.dispose();
      earthTexture.dispose();
      renderer.dispose();

      if (
        container &&
        renderer.domElement &&
        container.contains(renderer.domElement)
      ) {
        container.removeChild(renderer.domElement);
      }

      initializedRef.current = false; // allow re-initialization if component remounts
    };
  }, [width, height, earthSize]);

  return (
    <div
      ref={containerRef}
      {...rest}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        position: 'relative',
        ...style,
      }}
    />
  );
};

type EarthProps = {
  width?: number;
  height?: number;
  earthSize?: number;
} & React.HTMLAttributes<HTMLDivElement>;
