import { createBrowserRouter } from "react-router";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { BrickPatternDisplay } from "./pages/BrickPatternDisplay";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ProjectDetailsPage } from "./pages/ProjectDetailsPage";
import { RequirementsChannelPage } from "./pages/RequirementsChannelPage";
import { TaskPage } from "./pages/TaskPage";

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <h1 className="font-['Inria_Sans',sans-serif] font-bold text-4xl text-[#976623] mb-4">
          404 - Page Not Found
        </h1>
        <p className="font-['Instrument_Sans',sans-serif] text-[#717182] mb-6">
          The page you're looking for doesn't exist.
        </p>
        <a 
          href="/" 
          className="inline-block px-6 py-3 bg-[#976623] text-white rounded-lg hover:bg-[#7d5419] transition-colors"
        >
          Go Home
        </a>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/brick",
    element: <BrickPatternDisplay />,
  },
  {
    path: "/projects",
    element: <ProjectsPage />,
  },
  {
    path: "/projects/buildinlime",
    element: <ProjectDetailsPage />,
  },
  {
    path: "/requirements",
    element: <RequirementsChannelPage />,
  },
  {
    path: "/tasks",
    element: <TaskPage />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);