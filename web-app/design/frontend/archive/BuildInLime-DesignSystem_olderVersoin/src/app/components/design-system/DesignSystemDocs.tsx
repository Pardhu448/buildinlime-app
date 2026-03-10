import { Heading, Text, Card, CardHeader, CardBody, CardTitle, CardDescription } from "./index";

export function DesignSystemDocs() {
  return (
    <div className="space-y-12">
      {/* Introduction */}
      <section>
        <Heading level={1} className="mb-4">BuildInLime Design System</Heading>
        <Text variant="body" className="mb-4">
          A comprehensive design system for construction documentation and project management.
          Built with React, TypeScript, and Tailwind CSS.
        </Text>
        <Text variant="body">
          This design system combines the professional aesthetic of BuildInLime with modern 
          UI patterns inspired by Linear and other leading project management tools.
        </Text>
      </section>

      {/* Design Principles */}
      <section>
        <Heading level={2} className="mb-6">Design Principles</Heading>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Clarity</CardTitle>
              <CardDescription>
                Clean, minimal interfaces that prioritize content and functionality
              </CardDescription>
            </CardHeader>
          </Card>
          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Consistency</CardTitle>
              <CardDescription>
                Unified design language across all components and pages
              </CardDescription>
            </CardHeader>
          </Card>
          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Accessibility</CardTitle>
              <CardDescription>
                Components built with accessibility standards in mind
              </CardDescription>
            </CardHeader>
          </Card>
          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Professional</CardTitle>
              <CardDescription>
                Warm, earthy tones that convey trust and stability
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Typography System */}
      <section>
        <Heading level={2} className="mb-6">Typography</Heading>
        <Card variant="bordered">
          <CardBody>
            <div className="space-y-4">
              <div>
                <Text variant="small" className="font-semibold mb-2">Brand Font</Text>
                <Text variant="body">
                  <span className="font-['Inria_Sans',sans-serif] font-bold text-xl">
                    Inria Sans Bold
                  </span> - Used for logo and brand elements
                </Text>
              </div>
              <div>
                <Text variant="small" className="font-semibold mb-2">Body Font</Text>
                <Text variant="body">
                  <span className="font-['Instrument_Sans',sans-serif]">
                    Instrument Sans
                  </span> - Used for all interface text and content
                </Text>
              </div>
            </div>
          </CardBody>
        </Card>
      </section>

      {/* Color System */}
      <section>
        <Heading level={2} className="mb-6">Color System</Heading>
        <Card variant="bordered">
          <CardBody>
            <div className="space-y-6">
              <div>
                <Text variant="small" className="font-semibold mb-3">Primary Colors</Text>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg bg-[#976623] border border-[#ac7f5e]" />
                    <div>
                      <Text variant="body" className="font-semibold">#976623</Text>
                      <Text variant="small">Primary</Text>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg bg-[#ac7f5e] border border-[#ac7f5e]" />
                    <div>
                      <Text variant="body" className="font-semibold">#ac7f5e</Text>
                      <Text variant="small">Secondary</Text>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <Text variant="small" className="font-semibold mb-3">Neutral Colors</Text>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg bg-white border border-[#ac7f5e]" />
                    <div>
                      <Text variant="body" className="font-semibold">#ffffff</Text>
                      <Text variant="small">White</Text>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg bg-[#f5f5f5] border border-[#ac7f5e]" />
                    <div>
                      <Text variant="body" className="font-semibold">#f5f5f5</Text>
                      <Text variant="small">Muted</Text>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg bg-[#1e1e1e] border border-[#ac7f5e]" />
                    <div>
                      <Text variant="body" className="font-semibold">#1e1e1e</Text>
                      <Text variant="small">Black</Text>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </section>

      {/* Spacing System */}
      <section>
        <Heading level={2} className="mb-6">Spacing System</Heading>
        <Card variant="bordered">
          <CardBody>
            <Text variant="body" className="mb-4">
              The design system uses Tailwind's default spacing scale (based on 0.25rem = 4px):
            </Text>
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 bg-[#976623] rounded" />
                <Text variant="small">2 (8px) - Tight spacing</Text>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-4 h-4 bg-[#976623] rounded" />
                <Text variant="small">4 (16px) - Standard spacing</Text>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-6 h-6 bg-[#976623] rounded" />
                <Text variant="small">6 (24px) - Medium spacing</Text>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-[#976623] rounded" />
                <Text variant="small">8 (32px) - Large spacing</Text>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#976623] rounded" />
                <Text variant="small">12 (48px) - Section spacing</Text>
              </div>
            </div>
          </CardBody>
        </Card>
      </section>

      {/* Component Usage */}
      <section>
        <Heading level={2} className="mb-6">Component Usage</Heading>
        <div className="space-y-4">
          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Installation</CardTitle>
              <CardDescription>Import components from the design system</CardDescription>
            </CardHeader>
            <CardBody>
              <pre className="bg-[#f5f5f5] p-4 rounded-lg overflow-x-auto">
                <code className="text-sm font-mono">
{`import {
  Header,
  Footer,
  Button,
  Card,
  Container,
  Heading,
  Text,
  Input,
} from "./components/design-system";`}
                </code>
              </pre>
            </CardBody>
          </Card>

          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Example Usage</CardTitle>
              <CardDescription>Basic component composition</CardDescription>
            </CardHeader>
            <CardBody>
              <pre className="bg-[#f5f5f5] p-4 rounded-lg overflow-x-auto">
                <code className="text-sm font-mono">
{`<Container>
  <Heading level={1}>Welcome</Heading>
  <Text variant="body">Get started with BuildInLime</Text>
  <Button variant="primary">Start Building</Button>
</Container>`}
                </code>
              </pre>
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}
