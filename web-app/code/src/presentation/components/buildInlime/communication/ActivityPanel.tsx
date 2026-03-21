import { Circle } from "lucide-react";

export interface ActivityItem {
  id: string;
  user: string;
  action: string;
  target?: string;
  date: string;
}

interface ActivityPanelProps {
  activities: ActivityItem[];
  onSeeAll?: () => void;
}

export function ActivityPanel({ activities, onSeeAll }: ActivityPanelProps) {
  const renderActivity = (activity: ActivityItem) => {
    if (activity.target) {
      return (
        <div>
          <span className="text-[#1e1e1e]">{activity.user}</span>
          <span className="text-[#717182]"> {activity.action} </span>
          <span className="text-[#1e1e1e]">{activity.target}</span>
          <span className="text-[#717182]"> · {activity.date}</span>
        </div>
      );
    }

    return (
      <div>
        <span className="text-[#1e1e1e]">{activity.user}</span>
        <span className="text-[#717182]">
          {" "}
          {activity.action} · {activity.date}
        </span>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[#717182]">Activity</h3>
        <button
          onClick={onSeeAll}
          className="text-sm text-[#976623] hover:underline"
        >
          See all
        </button>
      </div>
      <div className="space-y-3">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-2 text-sm">
            <Circle
              className="w-1.5 h-1.5 text-blue-500 mt-1.5"
              fill="currentColor"
            />
            {renderActivity(activity)}
          </div>
        ))}
      </div>
    </div>
  );
}
