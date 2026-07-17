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
          <span className="text-foreground">{activity.user}</span>
          <span className="text-muted-foreground"> {activity.action} </span>
          <span className="text-foreground">{activity.target}</span>
          <span className="text-muted-foreground"> · {activity.date}</span>
        </div>
      );
    }

    return (
      <div>
        <span className="text-foreground">{activity.user}</span>
        <span className="text-muted-foreground">
          {" "}
          {activity.action} · {activity.date}
        </span>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">Activity</h3>
        <button
          onClick={onSeeAll}
          className="text-sm text-primary hover:underline"
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
