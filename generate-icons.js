// Node.js script to generate PWA icons using Canvas API
// Run with: node generate-icons.js

const fs = require('fs');
const { createCanvas } = require('canvas');

function createIcon(size, text, filename) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#2196F3');
    gradient.addColorStop(1, '#1976D2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    // Add medical cross or TCI symbol
    ctx.fillStyle = 'white';
    ctx.lineWidth = size / 20;
    
    if (size >= 192) {
        // Draw TCI text for larger icons
        ctx.font = `bold ${size/5}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TCI', size/2, size/2 - size/8);
        
        // Draw smaller "PROP" text
        ctx.font = `${size/8}px Arial`;
        ctx.fillText('PROP', size/2, size/2 + size/8);
    } else {
        // Draw simple "P" for small icons
        ctx.font = `bold ${size/2}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('P', size/2, size/2);
    }
    
    // Add border
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = size / 40;
    ctx.strokeRect(0, 0, size, size);
    
    // Save to file
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(`./images/${filename}`, buffer);
    console.log(`Generated ${filename}`);
}

// Generate icons
try {
    createIcon(32, 'P', 'icon-32.png');
    createIcon(192, 'TCI', 'icon-192.png');
    createIcon(512, 'TCI', 'icon-512.png');
    console.log('All icons generated successfully!');
} catch (error) {
    console.log('Canvas module not available, using simplified approach...');
    
    // Create placeholder SVG files that can be converted to PNG
    const createSVGIcon = (size, text, filename) => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#2196F3;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1976D2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#grad)" />
  <text x="${size/2}" y="${size/2}" font-family="Arial, sans-serif" font-size="${size/4}" font-weight="bold" text-anchor="middle" dominant-baseline="central" fill="white">${text}</text>
</svg>`;
        
        fs.writeFileSync(`./images/${filename.replace('.png', '.svg')}`, svg);
        console.log(`Generated SVG: ${filename.replace('.png', '.svg')}`);
    };
    
    createSVGIcon(32, 'P', 'icon-32.png');
    createSVGIcon(192, 'TCI', 'icon-192.png');
    createSVGIcon(512, 'TCI', 'icon-512.png');
    
    console.log('SVG icons generated. Convert to PNG using online tools or image editor.');
}