"use client";

import { useEffect, useRef, useState } from "react";

// Define the different dessert types, adding grass jelly and red bean
export type DessertType =
  | "sago"
  | "mochi"
  | "boba"
  | "taro"
  | "mango"
  | "grass-jelly"
  | "red-bean";

interface DessertAnimationProps {
  containerClassName?: string;
  density?: number;
  speed?: number;
  type?: DessertType | "random"; // Allow specifying a type or random
}

export function DessertAnimation({
  containerClassName = "",
  density = 50,
  speed = 1,
  type = "random",
}: DessertAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // If type is random, select a random dessert type on component mount
  const [dessertType] = useState<DessertType>(() => {
    if (type !== "random") return type;

    const types: DessertType[] = [
      "sago",
      "mochi",
      "boba",
      "taro",
      "mango",
      "grass-jelly",
      "red-bean",
    ];
    return types[Math.floor(Math.random() * types.length)] as DessertType;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Configure dessert-specific properties with more realistic settings
    const dessertConfig = {
      sago: {
        colors: [
          "rgba(255, 255, 255, 0.85)",
          "rgba(255, 252, 245, 0.85)",
          "rgba(245, 240, 230, 0.85)",
          "rgba(235, 225, 210, 0.85)",
        ],
        minSize: 2,
        maxSize: 4.5,
        shape: "circle",
        hasTexture: true,
      },
      mochi: {
        colors: [
          "rgba(255, 255, 255, 0.95)", // bright mochi white
          "rgba(250, 250, 250, 0.9)", // soft white
          "rgba(245, 245, 245, 0.85)", // light gray-white
          "rgba(240, 240, 235, 0.85)", // natural mochi off-white
          "rgba(235, 235, 230, 0.8)", // subtle creamy white
        ],
        minSize: 4,
        maxSize: 8,
        shape: "mochi",
        hasTexture: true,
      },
      boba: {
        colors: [
          "rgba(50, 25, 10, 0.95)", // Dark brown
          "rgba(60, 30, 15, 0.95)", // Medium brown
          "rgba(45, 22, 12, 0.95)", // Rich brown
          "rgba(40, 20, 10, 0.95)", // Very dark brown
        ],
        minSize: 3.5,
        maxSize: 6,
        shape: "circle",
        hasTexture: true,
      },
      taro: {
        colors: [
          "rgba(190, 144, 212, 0.9)", // Light purple
          "rgba(175, 122, 197, 0.9)", // Lavender
          "rgba(200, 162, 220, 0.9)", // Pale purple
          "rgba(180, 132, 205, 0.9)", // Medium purple
        ],
        minSize: 5,
        maxSize: 9,
        shape: "square",
        hasTexture: true,
        hasSpeckles: true,
      },
      mango: {
        colors: [
          "rgba(255, 204, 0, 0.9)", // Bright yellow
          "rgba(255, 182, 0, 0.9)", // Golden yellow
          "rgba(255, 165, 0, 0.9)", // Orange
          "rgba(255, 192, 0, 0.9)", // Amber
        ],
        minSize: 5,
        maxSize: 10,
        shape: "square",
        hasTexture: true,
      },
      "grass-jelly": {
        colors: [
          "rgba(30, 30, 30, 0.8)", // Almost black
          "rgba(40, 40, 40, 0.8)", // Dark gray
          "rgba(35, 35, 35, 0.8)", // Very dark gray
          "rgba(45, 45, 45, 0.8)", // Medium dark gray
        ],
        minSize: 5,
        maxSize: 12,
        shape: "jelly",
        hasTexture: true,
        glossy: true,
      },
      "red-bean": {
        colors: [
          "rgba(140, 40, 40, 0.9)", // Deep red
          "rgba(120, 30, 30, 0.9)", // Dark red
          "rgba(150, 50, 50, 0.9)", // Medium red
          "rgba(130, 35, 35, 0.9)", // Rich red
        ],
        minSize: 10,
        maxSize: 16,
        shape: "bean",
        hasTexture: true,
      },
    };

    const config = dessertConfig[dessertType];

    // Create dessert particles
    const particles: {
      x: number;
      y: number;
      size: number;
      speed: number;
      opacity: number;
      swing: number;
      swingSpeed: number;
      color: string;
      rotation: number;
      rotationSpeed: number;
      scaleX: number;
      scaleY: number;
      textureOffset: number;
      textureScale: number;
      wobble: number;
      wobbleSpeed: number;
    }[] = [];

    for (let i = 0; i < density; i++) {
      const x = Math.random() * canvas.width;
      const y = -20 - Math.random() * 100; // Start above the visible area
      const size =
        Math.random() * (config.maxSize - config.minSize) + config.minSize;
      const particleSpeed = (Math.random() * 0.5 + 0.5) * speed;
      const opacity = Math.random() * 0.2 + 0.8;
      const swing = Math.random() * Math.PI * 2;
      const swingSpeed = Math.random() * 0.01 - 0.005;
      const color = config.colors[
        Math.floor(Math.random() * config.colors.length)
      ] as string;
      const rotation = Math.random() * Math.PI * 2;
      const rotationSpeed =
        (Math.random() * 0.02 - 0.01) * (config.shape !== "circle" ? 1 : 0);

      // For more realistic shapes
      const scaleX = config.shape === "bean" ? 0.6 + Math.random() * 0.2 : 1;
      const scaleY = config.shape === "bean" ? 1 + Math.random() * 0.3 : 1;
      const textureOffset = Math.random() * 100;
      const textureScale = 0.5 + Math.random() * 1;
      const wobble = Math.random() * Math.PI * 2;
      const wobbleSpeed = Math.random() * 0.02;

      particles.push({
        x,
        y,
        size,
        speed: particleSpeed,
        opacity,
        swing,
        swingSpeed,
        color,
        rotation,
        rotationSpeed,
        scaleX,
        scaleY,
        textureOffset,
        textureScale,
        wobble,
        wobbleSpeed,
      });
    }

    // Draw functions for different shapes with enhanced realism
    const drawFunctions = {
      // Sago pearls - translucent, small, round
      circle: (
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        size: number,
        color: string,
        options: { glossy?: boolean; textureScale?: number } = {},
      ) => {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Add highlight for 3D effect
        const highlightSize = options.glossy ? 0.6 : 0.4;
        const highlightOpacity = options.glossy ? 0.7 : 0.5;

        ctx.beginPath();
        ctx.arc(
          x - size * 0.3,
          y - size * 0.3,
          size * highlightSize,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = `rgba(255, 255, 255, ${highlightOpacity})`;
        ctx.fill();

        // Add subtle texture if needed
        if (options.textureScale) {
          ctx.beginPath();
          for (let i = 0; i < 3; i++) {
            const dotSize = size * 0.1;
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * size * 0.6;
            ctx.arc(
              x + Math.cos(angle) * distance,
              y + Math.sin(angle) * distance,
              dotSize,
              0,
              Math.PI * 2,
            );
          }
          ctx.fillStyle = `rgba(255, 255, 255, 0.1)`;
          ctx.fill();
        }
      },
      // Square shaped
      square: (
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        size: number,
        color: string,
        rotation: number,
      ) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.beginPath();
        const roundedSize = size * 0.8; // Make squares slightly smaller
        ctx.roundRect(
          -roundedSize,
          -roundedSize,
          roundedSize * 2,
          roundedSize * 2,
          size * 0.3,
        ); // Rounded corners
        ctx.fillStyle = color;
        ctx.fill();

        // Add highlight for 3D effect
        ctx.beginPath();
        ctx.roundRect(
          -roundedSize * 0.5,
          -roundedSize * 0.5,
          roundedSize,
          roundedSize,
          size * 0.15,
        );
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.fill();
        ctx.restore();
      },

      // Mochi - soft, rounded squares with powdery surface
      mochi: (
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        size: number,
        color: string,
        rotation: number,
        textureScale: number,
      ) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);

        // Draw the main mochi body - now a circle for ball-shaped mochi
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.9, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Add a subtle shadow underneath to create depth
        // ctx.beginPath();
        // ctx.ellipse(0, size * 0.7, size * 1.1, size * 0.3, 0, 0, Math.PI * 2);
        // ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
        // ctx.fill();

        // Add highlight for 3D spherical effect
        ctx.beginPath();
        ctx.arc(-size * 0.3, -size * 0.3, size * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
        ctx.fill();

        // Add a second smaller highlight for more dimension
        ctx.beginPath();
        ctx.arc(-size * 0.4, -size * 0.4, size * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.fill();

        // Add powdery texture all around the surface
        for (let i = 0; i < 12; i++) {
          ctx.beginPath();
          const dotSize = size * 0.04 * textureScale;
          const angle = Math.random() * Math.PI * 2;
          // Keep powder mostly on the surface
          const distance = size * 0.7 + Math.random() * size * 0.2;
          ctx.arc(
            Math.cos(angle) * distance,
            Math.sin(angle) * distance,
            dotSize,
            0,
            Math.PI * 2,
          );
          ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
          ctx.fill();
        }

        ctx.restore();
      },

      // Taro - irregular purple shapes with speckles
      irregular: (
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        size: number,
        color: string,
        rotation: number,
        wobble: number,
      ) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);

        // Create irregular taro-like shape with wobble
        ctx.beginPath();
        const points = 8 + Math.floor(Math.random() * 4);

        for (let i = 0; i < points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const wobbleAmount = Math.sin(wobble + i * 2) * 0.2;
          const radius = size * (0.8 + wobbleAmount);

          if (i === 0) {
            ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
          } else {
            ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
          }
        }

        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        // Add white speckles characteristic of taro
        for (let i = 0; i < 12; i++) {
          ctx.beginPath();
          const speckleSize = size * (0.05 + Math.random() * 0.1);
          const angle = Math.random() * Math.PI * 2;
          const distance = Math.random() * size * 0.7;
          ctx.arc(
            Math.cos(angle) * distance,
            Math.sin(angle) * distance,
            speckleSize,
            0,
            Math.PI * 2,
          );
          ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
          ctx.fill();
        }

        ctx.restore();
      },

      // Mango slices - curved, yellow-orange pieces
      slice: (
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        size: number,
        color: string,
        rotation: number,
        textureScale: number,
      ) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);

        // Create mango slice shape
        ctx.beginPath();

        // Draw a crescent shape for the mango slice
        ctx.moveTo(size * 0.8, 0);
        ctx.quadraticCurveTo(size * 0.5, -size, -size * 0.8, 0);
        ctx.quadraticCurveTo(size * 0.5, size, size * 0.8, 0);

        // Fill with gradient for more realistic look
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, color.replace(/[\d.]+\)$/g, "0.7)"));
        ctx.fillStyle = gradient;
        ctx.fill();

        // Add texture lines to represent mango fibers
        const lineCount = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < lineCount; i++) {
          ctx.beginPath();
          const offset = (i - lineCount / 2) * (size * 0.3);
          ctx.moveTo(-size * 0.5 + Math.abs(offset * 0.5), offset);
          ctx.quadraticCurveTo(
            0,
            offset * 1.2,
            size * 0.5 - Math.abs(offset * 0.5),
            offset,
          );
          ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
          ctx.lineWidth = size * 0.05 * textureScale;
          ctx.stroke();
        }

        ctx.restore();
      },

      // Grass jelly - dark, translucent cubes with glossy surface
      jelly: (
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        size: number,
        color: string,
        rotation: number,
      ) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);

        // Draw a slightly wobbling cube shape
        ctx.beginPath();
        const cubeSize = size * 0.8;

        // Create a slightly irregular cube shape
        const corners = (
          [
            [-cubeSize, -cubeSize],
            [cubeSize, -cubeSize],
            [cubeSize, cubeSize],
            [-cubeSize, cubeSize],
          ] as [number, number][]
        ).map(([cx, cy]) => [
          cx + (Math.random() - 0.5) * size * 0.2,
          cy + (Math.random() - 0.5) * size * 0.2,
        ]);

        if (
          corners.length > 0 &&
          corners[0] &&
          corners[0][0] &&
          corners[0][1]
        ) {
          ctx.moveTo(corners[0][0], corners[0][1]);
          for (let i = 1; i < corners.length; i++) {
            const corner = corners[i];
            if (corner) {
              const [x, y] = corner;
              if (x && y) {
                ctx.lineTo(x, y);
              }
            }
          }
          ctx.closePath();
        }

        // Fill with semi-transparent dark color
        ctx.fillStyle = color;
        ctx.fill();

        // Add glossy highlights characteristic of jelly
        ctx.beginPath();
        if (
          corners[0] &&
          corners[1] &&
          corners[2] &&
          corners[0][0] &&
          corners[0][1] &&
          corners[1][0] &&
          corners[1][1] &&
          corners[2][0] &&
          corners[2][1]
        ) {
          ctx.moveTo(corners[0][0] * 0.7, corners[0][1] * 0.7);
          ctx.lineTo(corners[1][0] * 0.7, corners[1][1] * 0.7);
          ctx.lineTo(corners[2][0] * 0.3, corners[2][1] * 0.3);
        }
        ctx.closePath();
        ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
        ctx.fill();

        // Add a second highlight
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.fill();

        ctx.restore();
      },

      // Red bean - kidney-shaped with texture
      bean: (
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        size: number,
        color: string,
        rotation: number,
        scaleX: number,
        scaleY: number,
      ) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.scale(scaleX, scaleY); // Make beans kidney-shaped

        // Draw the bean shape
        ctx.beginPath();

        // Create a kidney bean shape using bezier curves
        const beanWidth = size * 1.2;
        const beanHeight = size;
        const indentDepth = size * 0.3;

        ctx.moveTo(-beanWidth / 2, 0);
        // Top curve
        ctx.bezierCurveTo(
          -beanWidth / 2,
          -beanHeight / 2,
          beanWidth / 2,
          -beanHeight / 2,
          beanWidth / 2,
          0,
        );
        // Bottom curve
        ctx.bezierCurveTo(
          beanWidth / 2,
          beanHeight / 2,
          -beanWidth / 2,
          beanHeight / 2,
          -beanWidth / 2,
          0,
        );
        // Indent (kidney shape)
        ctx.bezierCurveTo(
          -beanWidth / 2 + indentDepth,
          0,
          -beanWidth / 2 + indentDepth,
          0,
          -beanWidth / 2,
          0,
        );

        // Fill with gradient for more realistic look
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, beanWidth / 2);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, color.replace(/[\d.]+\)$/g, "0.8)"));
        ctx.fillStyle = gradient;
        ctx.fill();

        // Add subtle texture to the bean
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          const dotSize = size * 0.05;
          const angle = Math.random() * Math.PI * 2;
          const distance = Math.random() * size * 0.6;
          ctx.arc(
            Math.cos(angle) * distance,
            Math.sin(angle) * distance,
            dotSize,
            0,
            Math.PI * 2,
          );
          ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
          ctx.fill();
        }

        // Add highlight
        ctx.beginPath();
        ctx.ellipse(
          -beanWidth / 4,
          -beanHeight / 4,
          beanWidth / 4,
          beanHeight / 6,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.fill();

        ctx.restore();
      },
    };

    // Animation loop
    let animationFrameId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle) => {
        // Update wobble for organic movement
        particle.wobble += particle.wobbleSpeed;

        // Draw the particle based on its shape
        switch (config.shape) {
          case "circle":
            drawFunctions.circle(
              ctx,
              particle.x,
              particle.y,
              particle.size,
              particle.color,
            );
            break;
          case "mochi":
            drawFunctions.mochi(
              ctx,
              particle.x,
              particle.y,
              particle.size,
              particle.color,
              particle.rotation,
              particle.textureScale,
            );
            break;
          case "irregular":
            drawFunctions.irregular(
              ctx,
              particle.x,
              particle.y,
              particle.size,
              particle.color,
              particle.rotation,
              particle.wobble,
            );
            break;
          case "slice":
            drawFunctions.slice(
              ctx,
              particle.x,
              particle.y,
              particle.size,
              particle.color,
              particle.rotation,
              particle.textureScale,
            );
            break;
          case "jelly":
            drawFunctions.jelly(
              ctx,
              particle.x,
              particle.y,
              particle.size,
              particle.color,
              particle.rotation,
            );
            break;
          case "bean":
            drawFunctions.bean(
              ctx,
              particle.x,
              particle.y,
              particle.size,
              particle.color,
              particle.rotation,
              particle.scaleX,
              particle.scaleY,
            );
            break;
          case "square":
            drawFunctions.square(
              ctx,
              particle.x,
              particle.y,
              particle.size,
              particle.color,
              particle.rotation,
            );
            break;
        }

        // Update position with more natural movement
        particle.y += particle.speed;
        particle.swing += particle.swingSpeed;
        particle.x += Math.sin(particle.swing) * 0.5;
        particle.rotation += particle.rotationSpeed;

        // Add slight wobble to vertical movement for more natural falling
        particle.y += Math.sin(particle.wobble) * 0.3;

        // Reset if out of bounds
        if (particle.y > canvas.height + 50) {
          particle.y = -20 - Math.random() * 10;
          particle.x = Math.random() * canvas.width;
        }

        if (particle.x > canvas.width + 50) {
          particle.x = -20;
        } else if (particle.x < -50) {
          particle.x = canvas.width + 20;
        }
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [dessertType, density, speed]);

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${containerClassName}`}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
