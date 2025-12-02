// Blueprint/Constellation overlay module
// Creates an animated blueprint-style grid with nodes and connections

class BlueprintOverlay {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.nodes = [];
    this.mouseX = 0;
    this.mouseY = 0;
    this.animationId = null;
    this.time = 0;
    this.intensity = 0; // 0-1, controls density/noise
    this.progress = 0; // 0-1, environmental progress (for color changes)
    this.baseNodeCount = 20;
    this.baseGridOpacity = 0.08;
    this.baseConnectionOpacity = 0.18;
    
    this.init();
  }

  init() {
    // Create or get canvas element
    this.canvas = document.getElementById('blueprint');
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'blueprint';
      document.body.appendChild(this.canvas);
    }

    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Mouse tracking
    document.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });

    // Initialize nodes
    this.createNodes();
    
    // Start animation
    this.animate();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  createNodes() {
    // Node count scales with intensity (20 -> 60)
    const nodeCount = Math.round(this.baseNodeCount + (this.baseNodeCount * 2) * this.intensity);
    this.nodes = [];

    for (let i = 0; i < nodeCount; i++) {
      this.nodes.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: 2 + Math.random() * 2,
        pulse: Math.random() * Math.PI * 2,
      });
    }
  }

  updateNodes() {
    const mouseInfluence = 0.0001; // Subtle mouse influence
    // Movement speed increases with intensity
    const speedMultiplier = 1 + this.intensity * 1.5;

    this.nodes.forEach((node) => {
      // Update position (faster at high intensity)
      node.x += node.vx * speedMultiplier;
      node.y += node.vy * speedMultiplier;

      // Bounce off edges
      if (node.x < 0 || node.x > this.canvas.width) {
        node.vx *= -1;
        node.x = Math.max(0, Math.min(this.canvas.width, node.x));
      }
      if (node.y < 0 || node.y > this.canvas.height) {
        node.vy *= -1;
        node.y = Math.max(0, Math.min(this.canvas.height, node.y));
      }

      // Subtle mouse attraction/repulsion
      const dx = this.mouseX - node.x;
      const dy = this.mouseY - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0 && dist < 200) {
        const force = (200 - dist) * mouseInfluence;
        node.vx += (dx / dist) * force;
        node.vy += (dy / dist) * force;
      }

      // Damping
      node.vx *= 0.98;
      node.vy *= 0.98;

      // Update pulse
      node.pulse += 0.05;
    });
  }

  drawGrid() {
    const gridSize = 90;
    // Grid opacity increases with intensity
    const gridOpacity = this.baseGridOpacity + (0.15 - this.baseGridOpacity) * this.intensity;
    
    // Color shifts along a blue/cyan gradient (healthy bright cyan -> deeper blue)
    const r = Math.round(60 - 25 * this.progress);   // 60 -> 35
    const g = Math.round(190 - 70 * this.progress);  // 190 -> 120
    const b = Math.round(255 - 60 * this.progress);  // 255 -> 195
    const gridColor = `rgba(${r}, ${g}, ${b}, ${gridOpacity})`;

    this.ctx.strokeStyle = gridColor;
    this.ctx.lineWidth = 0.5;

    // Vertical lines
    for (let x = 0; x < this.canvas.width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y < this.canvas.height; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }

  drawConnections() {
    const maxDistance = 150;
    // Connection opacity increases with intensity
    const connectionOpacity = this.baseConnectionOpacity + (0.4 - this.baseConnectionOpacity) * this.intensity;
    
    // Color shifts along the same blue/cyan gradient
    const r = Math.round(60 - 25 * this.progress);
    const g = Math.round(190 - 70 * this.progress);
    const b = Math.round(255 - 60 * this.progress);
    const connectionColor = `rgba(${r}, ${g}, ${b}, ${connectionOpacity})`;

    this.ctx.strokeStyle = connectionColor;
    this.ctx.lineWidth = 0.5;

    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const dx = this.nodes[i].x - this.nodes[j].x;
        const dy = this.nodes[i].y - this.nodes[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < maxDistance) {
          const baseOpacity = (1 - distance / maxDistance) * 0.3;
          const opacity = baseOpacity * (1 + this.intensity * 0.5); // brighter at high intensity
          const rConn = Math.round(60 - 25 * this.progress);
          const gConn = Math.round(190 - 70 * this.progress);
          const bConn = Math.round(255 - 60 * this.progress);
          this.ctx.strokeStyle = `rgba(${rConn}, ${gConn}, ${bConn}, ${opacity})`;
          
          this.ctx.beginPath();
          this.ctx.moveTo(this.nodes[i].x, this.nodes[i].y);
          this.ctx.lineTo(this.nodes[j].x, this.nodes[j].y);
          this.ctx.stroke();
        }
      }
    }
  }

  drawNodes() {
    // Color shifts with progress along blue/cyan gradient
    const r = Math.round(60 - 25 * this.progress);
    const g = Math.round(190 - 70 * this.progress);
    const b = Math.round(255 - 60 * this.progress);
    
    this.nodes.forEach((node) => {
      const pulseSize = Math.sin(node.pulse) * 0.5 + 1;
      const radius = node.radius * pulseSize;

      // Outer glow
      const gradient = this.ctx.createRadialGradient(
        node.x, node.y, 0,
        node.x, node.y, radius * 3
      );
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.45)`);
      gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.22)`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, radius * 3, 0, Math.PI * 2);
      this.ctx.fill();

      // Node center
      this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.5)`;
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  draw() {
    // Clear canvas with slight transparency for overlay effect
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw grid
    this.drawGrid();

    // Draw connections
    this.drawConnections();

    // Draw nodes
    this.drawNodes();
    
    // Add environmental overlay effect (darkens/desaturates as pollution increases)
    if (this.progress > 0) {
      // Delay darkening until progress ~0.3, then ease in gently
      const eased = Math.max(0, this.progress - 0.3) / 0.7; // 0 until 0.3, then 0->1
      const overlayOpacity = eased * 0.25; // softer darkening
      this.ctx.fillStyle = `rgba(5, 8, 12, ${overlayOpacity})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  animate() {
    this.time += 0.016; // ~60fps
    this.updateNodes();
    this.draw();
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  setIntensity(level) {
    // Clamp level to 0-1
    this.intensity = Math.max(0, Math.min(1, level));
    
    // Recreate nodes if intensity changed significantly (to adjust count)
    // Only recreate if node count would change by more than 5
    const currentCount = this.nodes.length;
    const targetCount = Math.round(this.baseNodeCount + (this.baseNodeCount * 2) * this.intensity);
    if (Math.abs(currentCount - targetCount) > 5) {
      this.createNodes();
    }
  }
  
  setProgress(level) {
    // Update environmental progress (0 = healthy, 1 = polluted)
    // This affects color scheme and overlay
    this.progress = Math.max(0, Math.min(1, level));
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}

export default BlueprintOverlay;
