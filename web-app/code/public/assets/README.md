# BuildInLime Assets

This directory contains static assets used throughout the BuildInLime application.

## Images

### brick-pattern.png
- **Usage**: BuildInLime logo decoration, brand identity
- **Original Figma ID**: `044683d680bab81b91974a32f614f0acede8855d.png`
- **Dimensions**: 38px × 24px (as used in header)
- **Format**: PNG
- **Used in**:
  - `/src/app/pages/LandingPage2.tsx` - Header logo
  - `/src/app/pages/LoginPage2.tsx` - Header logo
  - `/src/app/components/design-system/BrickPattern.tsx` - Logo component

### container-background.png
- **Usage**: Login page decorative background
- **Original Figma ID**: `13cc1b46743448ada3aae63702e1e3d1c6ae379d.png`
- **Dimensions**: 631px × 789px
- **Format**: PNG
- **Attribution**: © borrowed from: Symphony in Bricks - Remembering Laurie Bakers Legacy by Sushila Murmu
- **Used in**:
  - `/src/app/pages/LoginPage2.tsx` - Left side decorative image

## Migration from Figma Assets

These assets were originally imported using the `figma:asset` scheme, which is a transient import method. They have been migrated to concrete files in `/public/assets/` for the following reasons:

1. **Portability**: Concrete files can be version-controlled and deployed
2. **Performance**: Direct file references load faster than virtual module imports
3. **Maintainability**: Easier to manage, replace, and optimize static assets
4. **Download Support**: Users can download and use these assets offline

## Usage

To use these assets in components:

```tsx
// Import from public directory
import brickPattern from "/assets/brick-pattern.png";
import containerBg from "/assets/container-background.png";

// Use in JSX
<img src={brickPattern} alt="BuildInLime" />
```

## Adding New Assets

When adding new assets:

1. Place the file in `/public/assets/`
2. Use descriptive kebab-case naming (e.g., `brick-pattern.png`)
3. Update this README with:
   - File name and purpose
   - Dimensions and format
   - Attribution (if applicable)
   - Components where it's used
4. Update component imports to use the new path

## Optimization

All images should be optimized for web:

- **PNG**: Use tools like TinyPNG or ImageOptim
- **JPG**: Quality 85-90 for photography
- **SVG**: Minify with SVGO
- Use appropriate dimensions (no oversized images)

## License & Attribution

- **brick-pattern.png**: BuildInLime brand asset
- **container-background.png**: © Symphony in Bricks - Remembering Laurie Bakers Legacy by Sushila Murmu

All BuildInLime brand assets are proprietary and should not be used outside of the BuildInLime application without permission.
