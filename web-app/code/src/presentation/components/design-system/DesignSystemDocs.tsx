import { Heading, Text, Card, CardHeader, CardBody, CardTitle, CardDescription } from "./index";

export function DesignSystemDocs() {
  return (
    <div className="space-y-12">
      {/* Introduction */}
      <section>
        <Heading level={1} className="mb-4">BuildInLime Design System</Heading>
        <Text variant="body" className="mb-4">
          A comprehensive design system for construction documentation and project management.
          Built with React, TypeScript, and Tailwind CSS v4.
        </Text>
        <Text variant="body" className="mb-4">
          This design system combines the professional aesthetic of BuildInLime with modern 
          UI patterns inspired by Linear and other leading project management tools.
        </Text>
        <Text variant="body">
          <strong>Version:</strong> 1.0 | <strong>Last Updated:</strong> February 20, 2026
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

      {/* BuildInLime Component Library */}
      <section>
        <Heading level={2} className="mb-6">BuildInLime Component Library</Heading>
        <Card variant="bordered">
          <CardBody>
            <Text variant="body" className="mb-4">
              The buildInLime component library provides application-specific components built on top of the design system primitives.
            </Text>
            <div className="space-y-4">
              <div>
                <Text variant="small" className="font-semibold mb-2">Layout Components</Text>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li className="text-sm">Sidebar - Main navigation sidebar with collapsible sections</li>
                  <li className="text-sm">PropertiesRightPanel - Right panel for displaying properties</li>
                  <li className="text-sm">ActivityPanel - Activity feed display</li>
                  <li className="text-sm">TasksRightPanel - Task list panel</li>
                </ul>
              </div>
              <div>
                <Text variant="small" className="font-semibold mb-2">Content Components</Text>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li className="text-sm">TaskDetailContent - Task detail view with icon, title, and description</li>
                  <li className="text-sm">ChannelHeader - Channel header with breadcrumb navigation</li>
                  <li className="text-sm">ProjectHeader - Project header with title and description</li>
                  <li className="text-sm">ResourcesSection - File and resource management</li>
                </ul>
              </div>
              <div>
                <Text variant="small" className="font-semibold mb-2">Navigation Components</Text>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li className="text-sm">BuildUnitsNav - BuildUnits navigation item</li>
                  <li className="text-sm">InboxNav - Inbox navigation item</li>
                  <li className="text-sm">MyTasksNav - My Tasks navigation item</li>
                  <li className="text-sm">ViewsNav - Views navigation item</li>
                  <li className="text-sm">TeamSection - Team section with avatar</li>
                </ul>
              </div>
              <div>
                <Text variant="small" className="font-semibold mb-2">Data Display Components</Text>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li className="text-sm">BuildUnitsTable - Table view for BuildUnits</li>
                  <li className="text-sm">ChannelsSection - Grid of channel cards</li>
                  <li className="text-sm">PropertiesInline - Inline property display</li>
                  <li className="text-sm">PropertiesPanel - Detailed properties panel</li>
                </ul>
              </div>
              <div>
                <Text variant="small" className="font-semibold mb-2">Action Components</Text>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li className="text-sm">NewBuildUnitButton - Create new BuildUnit button</li>
                  <li className="text-sm">AddTaskButton - Add task action button</li>
                  <li className="text-sm">DisplayButton - Display options button</li>
                  <li className="text-sm">FilterButton - Filter options button</li>
                  <li className="text-sm">CommentInput - Comment input with user avatar</li>
                </ul>
              </div>
            </div>
            <div className="mt-6 p-4 bg-[#fdf8f2] rounded-lg border border-[#e5d4c1]">
              <Text variant="small" className="font-semibold mb-2">Import Pattern</Text>
              <pre className="bg-white p-3 rounded text-xs overflow-x-auto">
                <code>{`import { 
  Sidebar, 
  PropertiesRightPanel, 
  TaskDetailContent,
  type BuildUnitInfo 
} from "../components/buildInlime";`}</code>
              </pre>
            </div>
          </CardBody>
        </Card>
      </section>

      {/* Terminology */}
      <section>
        <Heading level={2} className="mb-6">Construction Terminology</Heading>
        <Card variant="bordered">
          <CardBody>
            <Text variant="body" className="mb-4">
              BuildInLime uses construction-specific terminology throughout the application:
            </Text>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e5d4c1]">
                    <th className="text-left py-2 px-3 font-semibold">Generic Term</th>
                    <th className="text-left py-2 px-3 font-semibold">BuildInLime Term</th>
                    <th className="text-left py-2 px-3 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[#e5d4c1]">
                    <td className="py-2 px-3">Projects</td>
                    <td className="py-2 px-3 font-semibold text-[#976623]">BuildUnits</td>
                    <td className="py-2 px-3">Individual construction units or projects</td>
                  </tr>
                  <tr className="border-b border-[#e5d4c1]">
                    <td className="py-2 px-3">Issues</td>
                    <td className="py-2 px-3 font-semibold text-[#976623]">Tasks</td>
                    <td className="py-2 px-3">Work items within a BuildUnit</td>
                  </tr>
                  <tr className="border-b border-[#e5d4c1]">
                    <td className="py-2 px-3">Workspaces</td>
                    <td className="py-2 px-3 font-semibold text-[#976623]">ProjectSpace</td>
                    <td className="py-2 px-3">Organizational workspace container</td>
                  </tr>
                  <tr className="border-b border-[#e5d4c1]">
                    <td className="py-2 px-3">Teams</td>
                    <td className="py-2 px-3 font-semibold text-[#976623]">MasonryTeam</td>
                    <td className="py-2 px-3">Collaborative construction teams</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Boards</td>
                    <td className="py-2 px-3 font-semibold text-[#976623]">BuildUnit Views</td>
                    <td className="py-2 px-3">Different views of BuildUnit data</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}