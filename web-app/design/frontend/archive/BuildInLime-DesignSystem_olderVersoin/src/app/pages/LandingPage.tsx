import { 
  Header, 
  Footer, 
  Container, 
  Button, 
  Card, 
  CardHeader, 
  CardBody, 
  CardTitle, 
  CardDescription,
  Heading,
  Text,
  Input,
  Textarea,
  Carousel,
} from "../components/design-system";
import imgLinearMain from "figma:asset/287b4d031b021ae2450abbc50674baa62ebe443e.png";
import imgLinearFootnote from "figma:asset/f4fe1af1f84f1bcb6c005c189fc4d5407c674fb2.png";
import { useNavigate } from "react-router";

export function LandingPage() {
  const navigate = useNavigate();

  const footerSections = [
    {
      title: "Resources",
      links: [
        { label: "Blog", href: "#" },
        { label: "Documentation", href: "#" },
      ],
    },
    {
      title: "Product",
      links: [
        { label: "Features", href: "#" },
        { label: "Pricing", href: "#" },
        { label: "Support", href: "#" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About", href: "#" },
        { label: "Careers", href: "#" },
        { label: "Contact", href: "#" },
      ],
    },
  ];

  const carouselItems = [
    {
      title: "Seamless Documentation",
      description: "Organize all your project documents in one place with intuitive categorization and search.",
      content: (
        <div className="grid grid-cols-2 gap-4 mt-6">
          <Card variant="bordered" className="p-4">
            <Text variant="small" className="font-semibold mb-2">Upload</Text>
            <Text variant="caption">Drag and drop files or browse</Text>
          </Card>
          <Card variant="bordered" className="p-4">
            <Text variant="small" className="font-semibold mb-2">Organize</Text>
            <Text variant="caption">Smart categorization</Text>
          </Card>
        </div>
      ),
    },
    {
      title: "Real-time Collaboration",
      description: "Work together with your team, clients, and contractors in real-time.",
      content: (
        <div className="space-y-4 mt-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#976623] flex items-center justify-center text-white font-semibold">
              JD
            </div>
            <div>
              <Text variant="small" className="font-semibold">John Doe</Text>
              <Text variant="caption">Updated blueprints • 2 min ago</Text>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#ac7f5e] flex items-center justify-center text-white font-semibold">
              SM
            </div>
            <div>
              <Text variant="small" className="font-semibold">Sarah Miller</Text>
              <Text variant="caption">Approved changes • 5 min ago</Text>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Progress Tracking",
      description: "Monitor project milestones and keep everyone updated on construction progress.",
      content: (
        <div className="mt-6 space-y-3">
          {[
            { label: "Foundation", progress: 100 },
            { label: "Framing", progress: 75 },
            { label: "Electrical", progress: 40 },
            { label: "Plumbing", progress: 20 },
          ].map((item) => (
            <div key={item.label}>
              <div className="flex justify-between mb-1">
                <Text variant="small">{item.label}</Text>
                <Text variant="caption">{item.progress}%</Text>
              </div>
              <div className="w-full h-2 bg-[#f5f5f5] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#976623] rounded-full transition-all duration-500"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <Header>
        <a href="#" className="font-['Instrument_Sans',sans-serif] text-sm text-black hover:text-[#976623] transition-colors">
          Features
        </a>
        <a href="#" className="font-['Instrument_Sans',sans-serif] text-sm text-black hover:text-[#976623] transition-colors">
          Pricing
        </a>
        <a href="#" className="font-['Instrument_Sans',sans-serif] text-sm text-black hover:text-[#976623] transition-colors">
          About
        </a>
        <Button variant="primary" size="sm" onClick={() => navigate("/login")}>Get Started</Button>
      </Header>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-b from-white to-[#f5f5f5]">
        <Container>
          <div className="text-center max-w-4xl mx-auto">
            <Heading level={1} variant="brand" className="mb-6">
              Seamless Documentation for Modern Construction
            </Heading>
            <Text variant="body" className="text-xl mb-8 text-[#717182]">
              Easy collaboration among clients, architects and site-supervisors. 
              Built for the future of construction management.
            </Text>
            <div className="flex gap-4 justify-center">
              <Button variant="primary" size="lg" onClick={() => navigate("/login")}>Start Building</Button>
              <Button variant="outline" size="lg">Learn More</Button>
            </div>
          </div>
        </Container>
      </section>

      {/* Inspiration Section - Linear References */}
      <section className="py-16 bg-white">
        <Container>
          <Heading level={2} className="mb-12 text-center">
            Design Inspiration
          </Heading>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            <Card variant="bordered" className="overflow-hidden">
              <img 
                src={imgLinearMain} 
                alt="Linear landing page inspiration" 
                className="w-full h-auto"
              />
              <CardHeader>
                <CardTitle>Modern Interface Design</CardTitle>
                <CardDescription>
                  Clean, minimal interface inspired by leading project management tools
                </CardDescription>
              </CardHeader>
            </Card>
            <Card variant="bordered" className="overflow-hidden">
              <img 
                src={imgLinearFootnote} 
                alt="Linear footer inspiration" 
                className="w-full h-auto"
              />
              <CardHeader>
                <CardTitle>Comprehensive Navigation</CardTitle>
                <CardDescription>
                  Organized information architecture for easy access
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </Container>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-[#f5f5f5]">
        <Container>
          <Heading level={2} className="mb-12 text-center">
            Features
          </Heading>
          <Carousel items={carouselItems} className="mb-12" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card variant="elevated" className="p-6">
              <Heading level={3} className="mb-4">Real-time Collaboration</Heading>
              <Text variant="body">
                Work together seamlessly with your team, clients, and contractors in real-time.
              </Text>
            </Card>
            <Card variant="elevated" className="p-6">
              <Heading level={3} className="mb-4">Document Management</Heading>
              <Text variant="body">
                Organize and access all your construction documents in one secure location.
              </Text>
            </Card>
            <Card variant="elevated" className="p-6">
              <Heading level={3} className="mb-4">Progress Tracking</Heading>
              <Text variant="body">
                Monitor project milestones and keep everyone updated on construction progress.
              </Text>
            </Card>
          </div>
        </Container>
      </section>

      {/* Component Showcase */}
      <section className="py-16 bg-white">
        <Container>
          <Heading level={2} className="mb-12 text-center">
            Design System Components
          </Heading>

          {/* Buttons */}
          <div className="mb-12">
            <Heading level={3} className="mb-6">Buttons</Heading>
            <div className="flex flex-wrap gap-4">
              <Button variant="primary">Primary Button</Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="outline">Outline Button</Button>
              <Button variant="ghost">Ghost Button</Button>
            </div>
            <div className="flex flex-wrap gap-4 mt-4">
              <Button variant="primary" size="sm">Small</Button>
              <Button variant="primary" size="md">Medium</Button>
              <Button variant="primary" size="lg">Large</Button>
            </div>
          </div>

          {/* Cards */}
          <div className="mb-12">
            <Heading level={3} className="mb-6">Cards</Heading>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card variant="default">
                <CardHeader>
                  <CardTitle>Default Card</CardTitle>
                  <CardDescription>A simple card component</CardDescription>
                </CardHeader>
              </Card>
              <Card variant="bordered">
                <CardHeader>
                  <CardTitle>Bordered Card</CardTitle>
                  <CardDescription>Card with border styling</CardDescription>
                </CardHeader>
              </Card>
              <Card variant="elevated">
                <CardHeader>
                  <CardTitle>Elevated Card</CardTitle>
                  <CardDescription>Card with shadow effect</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>

          {/* Typography */}
          <div className="mb-12">
            <Heading level={3} className="mb-6">Typography</Heading>
            <div className="space-y-4">
              <Heading level={1}>Heading Level 1</Heading>
              <Heading level={2}>Heading Level 2</Heading>
              <Heading level={3}>Heading Level 3</Heading>
              <Heading level={4}>Heading Level 4</Heading>
              <Text variant="body">Body text with default styling</Text>
              <Text variant="small">Small text for captions and labels</Text>
              <Text variant="caption">Caption text for additional details</Text>
            </div>
          </div>

          {/* Form Elements */}
          <div className="mb-12">
            <Heading level={3} className="mb-6">Form Elements</Heading>
            <div className="max-w-md space-y-6">
              <Input 
                label="Project Name" 
                placeholder="Enter project name" 
              />
              <Input 
                label="Email Address" 
                type="email"
                placeholder="your@email.com" 
              />
              <Textarea 
                label="Project Description" 
                placeholder="Describe your project..."
              />
              <Button variant="primary" className="w-full">Submit</Button>
            </div>
          </div>

          {/* Color Palette */}
          <div className="mb-12">
            <Heading level={3} className="mb-6">Color Palette</Heading>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex flex-col items-center gap-2">
                <div className="w-24 h-24 rounded-lg bg-[#976623] border border-[#ac7f5e]" />
                <Text variant="small">Primary</Text>
                <Text variant="caption">#976623</Text>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-24 h-24 rounded-lg bg-[#ac7f5e] border border-[#ac7f5e]" />
                <Text variant="small">Secondary</Text>
                <Text variant="caption">#ac7f5e</Text>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-24 h-24 rounded-lg bg-white border border-[#ac7f5e]" />
                <Text variant="small">Background</Text>
                <Text variant="caption">#ffffff</Text>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-24 h-24 rounded-lg bg-[#1e1e1e] border border-[#ac7f5e]" />
                <Text variant="small">Foreground</Text>
                <Text variant="caption">#1e1e1e</Text>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Footer */}
      <Footer sections={footerSections} className="mt-auto" />
    </div>
  );
}
