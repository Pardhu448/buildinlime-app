# BuildInLime Design System

A comprehensive design system for construction documentation and project management applications.

## Overview

The BuildInLime Design System combines professional construction industry aesthetics with modern UI patterns inspired by leading project management tools like Linear. Built with React, TypeScript, and Tailwind CSS.

## Design Philosophy

### Color Palette

- **Primary (#976623)**: Rich brown/gold - conveys warmth, stability, and professionalism
- **Secondary (#ac7f5e)**: Lighter brown - complements primary, used for borders and accents
- **Background (#ffffff)**: Clean white background for clarity
- **Foreground (#1e1e1e)**: Near-black for optimal readability
- **Muted (#f5f5f5)**: Subtle background variations

### Typography

- **Brand Font**: Inria Sans Bold - Used for logo and brand elements
- **Interface Font**: Instrument Sans - Used for all interface text and content
  - Regular (400): Body text
  - Medium (500): Labels and emphasis
  - Semibold (600): Headings
  - Bold (700): Strong emphasis

### Spacing

Uses Tailwind's default spacing scale (4px base unit):
- 2 (8px): Tight spacing
- 4 (16px): Standard spacing
- 6 (24px): Medium spacing
- 8 (32px): Large spacing
- 12 (48px): Section spacing
- 16 (64px): Major section spacing

## Components

### Layout Components

#### Header
Professional header with logo and navigation.

```tsx
import { Header } from "./components/design-system";

<Header>
  <a href="#">Features</a>
  <a href="#">Pricing</a>
  <Button variant="primary">Get Started</Button>
</Header>
```

#### Footer
Organized footer with multiple sections.

```tsx
import { Footer } from "./components/design-system";

<Footer sections={[
  {
    title: "Resources",
    links: [
      { label: "Blog", href: "#" },
      { label: "Documentation", href: "#" },
    ],
  },
]} />
```

#### Container
Responsive container with max-width variants.

```tsx
import { Container } from "./components/design-system";

<Container maxWidth="2xl" variant="bordered">
  {/* Content */}
</Container>
```

### UI Components

#### Button
Multi-variant button component.

```tsx
import { Button } from "./components/design-system";

<Button variant="primary" size="md">Click Me</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
```

**Variants**: primary, secondary, outline, ghost
**Sizes**: sm, md, lg

#### Card
Flexible card component with variants.

```tsx
import { Card, CardHeader, CardTitle, CardDescription } from "./components/design-system";

<Card variant="bordered">
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description text</CardDescription>
  </CardHeader>
</Card>
```

**Variants**: default, bordered, elevated

#### Carousel
Interactive carousel for showcasing features.

```tsx
import { Carousel } from "./components/design-system";

<Carousel items={[
  {
    title: "Feature 1",
    description: "Description",
    content: <div>Custom content</div>
  },
]} />
```

### Typography Components

#### Heading
Semantic heading component with levels.

```tsx
import { Heading } from "./components/design-system";

<Heading level={1} variant="brand">Page Title</Heading>
<Heading level={2}>Section Title</Heading>
```

**Levels**: 1, 2, 3, 4
**Variants**: default, brand

#### Text
Body text with variants.

```tsx
import { Text } from "./components/design-system";

<Text variant="body">Regular paragraph text</Text>
<Text variant="small">Small text for captions</Text>
<Text variant="caption">Caption text</Text>
```

### Form Components

#### Input
Styled input with label and error states.

```tsx
import { Input } from "./components/design-system";

<Input 
  label="Email" 
  type="email"
  placeholder="you@example.com"
  error="Invalid email"
/>
```

#### Textarea
Multi-line text input.

```tsx
import { Textarea } from "./components/design-system";

<Textarea 
  label="Description" 
  placeholder="Enter description..."
/>
```

### Brand Components

#### Logo
BuildInLime logo with brick pattern.

```tsx
import { Logo } from "./components/design-system";

<Logo size="md" />
```

**Sizes**: sm, md, lg

#### BrickPattern
Decorative brick pattern element.

```tsx
import { BrickPattern } from "./components/design-system";

<BrickPattern className="h-[34px] w-[54px]" />
```

## Design Tokens

### Colors

```css
--lime-primary: #976623
--lime-secondary: #ac7f5e
--lime-border: #ac7f5e
--lime-shadow: #976623
```

### Border Radius

```css
--radius: 0.625rem (10px)
```

## Usage

### Installation

All components are available from the design system index:

```tsx
import {
  Header,
  Footer,
  Button,
  Card,
  Container,
  Heading,
  Text,
  Input,
  Logo,
} from "./components/design-system";
```

### Best Practices

1. **Consistency**: Use design system components for all UI elements
2. **Accessibility**: Components include proper ARIA labels and semantic HTML
3. **Responsiveness**: All components are responsive by default
4. **Theming**: Use CSS variables for easy theme customization

## Design Inspirations

This design system draws inspiration from:
- **Linear**: Clean, minimal interface design
- **Construction Industry**: Warm, earthy tones that convey trust
- **Modern SaaS**: Professional, accessible components

## File Structure

```
/src/app/components/design-system/
├── index.ts                    # Main export file
├── BrickPattern.tsx            # Brand brick pattern
├── Logo.tsx                    # BuildInLime logo
├── Header.tsx                  # Page header
├── Footer.tsx                  # Page footer
├── Button.tsx                  # Button component
├── Card.tsx                    # Card components
├── Container.tsx               # Layout container
├── Typography.tsx              # Heading and Text
├── Input.tsx                   # Form inputs
├── Carousel.tsx                # Feature carousel
└── DesignSystemDocs.tsx        # Documentation component
```

## Support

For questions or issues with the design system, please refer to the component documentation or contact the design team.
