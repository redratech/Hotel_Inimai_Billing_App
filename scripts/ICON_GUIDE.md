# App Icon Generation Guide

## Automatic Icon Generation

Run the following command to generate app icons from the logo:

```bash
npm run generate-icons
```

This command copies `public/logo.jpeg` to all Android mipmap directories with the filename `ic_launcher.png`.

## Manual Icon Generation (Recommended for Production)

For production-quality icons, use ImageMagick to resize the logo to the appropriate dimensions for each Android density:

```bash
# For different Android densities:

# MDPI (160 dpi) - 48x48
convert public/logo.jpeg -resize 48x48 android/app/src/main/res/mipmap-mdpi/ic_launcher.png

# HDPI (240 dpi) - 72x72
convert public/logo.jpeg -resize 72x72 android/app/src/main/res/mipmap-hdpi/ic_launcher.png

# XHDPI (320 dpi) - 96x96
convert public/logo.jpeg -resize 96x96 android/app/src/main/res/mipmap-xhdpi/ic_launcher.png

# XXHDPI (480 dpi) - 144x144
convert public/logo.jpeg -resize 144x144 android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png

# XXXHDPI (640 dpi) - 192x192
convert public/logo.jpeg -resize 192x192 android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png
```

## On Codemagic CI/CD

The build pipeline automatically runs `npm run generate-icons` before building the APK, ensuring your logo is used as the app icon.

## File Locations

- **Source Logo**: `public/logo.jpeg`
- **Android Icons**: `android/app/src/main/res/mipmap-*/ic_launcher.png`
- **Generation Script**: `scripts/generate-icons.js`

## What Happens During Build

1. ✅ App is built (`npm run build`)
2. ✅ Capacitor syncs Android project (`npx cap sync android`)
3. ✅ Icon generation script runs (`npm run generate-icons`)
4. ✅ Android APK is compiled with the new icons

Your logo will appear as the app icon in the Play Store and on user devices!
