import { ArrowLeft, CheckSquare, Square, ChevronRight } from "lucide-react";
import { useLiveQuery, eq } from "@tanstack/react-db";
import { useNavigate } from "@tanstack/react-router";
import { useSession } from "%/infrastructure/auth/client";
import {
  tasksCollection,
  channelsCollection,
  buildUnitsCollection,
  projectsCollection,
} from "%/infrastructure/database/tanstack-db-electric/admincollections";
import { Sidebar } from "../components/buildInlime";
import { unwrapJsonb } from "%/presentation/lib/utils";

export function MyTasksPage() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const currentUserId = session?.user?.id ?? "";

  const { data: myTasks } = useLiveQuery(
    (q) => q.from({ tasksCollection }).where(({ tasksCollection: t }) => eq(t.assignee_id, currentUserId)),
    [currentUserId]
  );

  const { data: allChannels } = useLiveQuery((q) => q.from({ channelsCollection }), []);
  const { data: allBuildUnits } = useLiveQuery((q) => q.from({ buildUnitsCollection }), []);
  const { data: allProjects } = useLiveQuery((q) => q.from({ projectsCollection }), []);

  const getChannel = (channelId: string) => (allChannels ?? []).find((c) => c.id === channelId);
  const getBuildUnit = (buildunitId: string) => (allBuildUnits ?? []).find((b) => b.id === buildunitId);
  const getProject = (projectId: string) => (allProjects ?? []).find((p) => p.id === projectId);

  const handleTaskClick = (task: NonNullable<typeof myTasks>[number]) => {
    const channel = getChannel(task.channel_id);
    const buildUnit = getBuildUnit(task.buildunit_id);
    if (!channel || !buildUnit) return;
    const channelName = unwrapJsonb(channel.name);
    navigate({
      to: "/projects/$projectId/$buildUnitName/$channelName/$taskName",
      params: {
        projectId: buildUnit.project_id,
        buildUnitName: buildUnit.name,
        channelName,
        taskName: task.name,
      },
    });
  };

  const sorted = (myTasks ?? []).slice().sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return 0;
  });

  const openCount = sorted.filter((t) => !t.completed).length;
  const doneCount = sorted.filter((t) => t.completed).length;

  return (
    <div className="flex h-screen bg-white font-['Instrument_Sans',sans-serif]">
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top nav */}
        <header className="h-12 bg-white border-b border-[#e5d4c1] flex items-center gap-3 px-6">
          <button
            onClick={() => window.history.back()}
            className="p-1 text-[#717182] hover:text-[#1e1e1e] hover:bg-[#f0e5d8] rounded transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="font-semibold text-[16px] text-[#1e1e1e]">My Tasks</h1>
          {currentUserId && (
            <span className="ml-auto text-xs text-[#717182]">
              {openCount} open · {doneCount} done
            </span>
          )}
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {!currentUserId ? (
            <p className="text-sm text-[#717182]">Loading…</p>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <CheckSquare className="w-10 h-10 text-[#e5d4c1] mb-3" />
              <p className="text-sm font-medium text-[#717182]">No tasks assigned to you</p>
              <p className="text-xs text-[#717182] mt-1">Tasks assigned to you will appear here.</p>
            </div>
          ) : (
            <div className="space-y-1 max-w-2xl">
              {sorted.map((task) => {
                const channel = getChannel(task.channel_id);
                const buildUnit = getBuildUnit(task.buildunit_id);
                const project = buildUnit ? getProject(buildUnit.project_id) : null;
                const channelName = channel ? unwrapJsonb(channel.name) : null;

                return (
                  <button
                    key={task.id}
                    onClick={() => handleTaskClick(task)}
                    className={`w-full flex items-start gap-3 px-4 py-3 rounded-lg border transition-colors text-left ${
                      task.completed
                        ? "bg-white border-[#e5d4c1] opacity-60 hover:opacity-80"
                        : "bg-[#fdf8f2] border-[#e5d4c1] hover:border-[#ac7f5e] hover:bg-[#f5ece0]"
                    }`}
                  >
                    <div className="mt-0.5 flex-shrink-0 text-[#976623]">
                      {task.completed ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${task.completed ? "line-through text-[#717182]" : "text-[#1e1e1e]"}`}>
                        {task.name}
                      </p>
                      {task.description && (
                        <p className="text-xs text-[#717182] mt-0.5 truncate">{task.description}</p>
                      )}
                      {/* Breadcrumb: Project > Build Unit > Channel */}
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        {project && (
                          <>
                            <span className="text-xs text-[#ac7f5e]">{project.name}</span>
                            <ChevronRight className="w-3 h-3 text-[#ac7f5e]" />
                          </>
                        )}
                        {buildUnit && (
                          <>
                            <span className="text-xs text-[#ac7f5e]">{buildUnit.name}</span>
                            <ChevronRight className="w-3 h-3 text-[#ac7f5e]" />
                          </>
                        )}
                        {channelName && (
                          <span className="text-xs text-[#ac7f5e]">#{channelName}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
