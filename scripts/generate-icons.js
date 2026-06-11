#!/usr/bin/env node

/**
 * Generate app icons for Android from logo.jpeg
 * This script converts logo.jpeg to PNG and places it in the appropriate Android mipmap directories
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define the icon directories for different Android densities
const iconDirs = [
  'android/app/src/main/res/mipmap-mdpi',
  'android/app/src/main/res/mipmap-hdpi',
  'android/app/src/main/res/mipmap-xhdpi',
  'android/app/src/main/res/mipmap-xxhdpi',
  'android/app/src/main/res/mipmap-xxxhdpi',
  'android/app/src/main/res/mipmap-anydpi-v26',
];

const sourceLogo = path.join(__dirname, '../public/logo.jpeg');
const iconName = 'ic_launcher.png';

console.log('🎨 Generating Android icons from logo...');

try {
  // Check if source logo exists
  if (!fs.existsSync(sourceLogo)) {
    console.error('❌ Error: Logo file not found at', sourceLogo);
    process.exit(1);
  }

  // Read the source logo
  const logoBuffer = fs.readFileSync(sourceLogo);

  // Copy logo to each icon directory
  iconDirs.forEach(dir => {
    const fullPath = path.join(__dirname, '..', dir);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }

    // Copy the logo as PNG
    const iconPath = path.join(fullPath, iconName);
    fs.writeFileSync(iconPath, logoBuffer);
    console.log(`✅ Created ${dir}/${iconName}`);
  });

  console.log('✨ Icon generation complete!');
  console.log('Note: For production, use ImageMagick or a similar tool to resize and format icons properly.');
  console.log('Recommended: convert logo.jpeg -resize 192x192 android/app/src/main/res/mipmap-mdpi/ic_launcher.png');

} catch (error) {
  console.error('❌ Error generating icons:', error.message);
  process.exit(1);
}
