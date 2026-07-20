// organization/
export { BuildUnitsNav, type BuildUnitsNavProps } from "./organization/BuildUnitsNav";
export { BuildUnitsTable, type BuildUnit } from "./organization/BuildUnitsTable";
export { BuildUnitCard } from "./organization/BuildUnitCard";
export { BuildUnitsGrid } from "./organization/BuildUnitsGrid";
export {
  BuildUnitsFilterPanel,
  applyBuildUnitFilters,
  EMPTY_BUILD_UNIT_FILTERS,
  type BuildUnitFilters,
} from "./organization/BuildUnitsFilterPanel";
export { BuildUnitsTeamNav } from "./organization/BuildUnitsTeamNav";
export { ChannelCard } from "./organization/ChannelCard";
export { ChannelHeader, type ChannelHeaderProps } from "./organization/ChannelHeader";
export { ChannelsSection, type Channel, type ChannelsSectionProps } from "./organization/ChannelsSection";
export { NewBuildUnitButton } from "./organization/NewBuildUnitButton";
export { NewChannelButton } from "./organization/NewChannelButton";
export { NewProjectButton } from "./organization/NewProjectButton";
export { ProjectHeader, type ProjectHeaderProps } from "./organization/ProjectHeader";
export { ProjectsTable } from "./organization/ProjectsTable";

// communication/
export { ActivityPanel, type ActivityItem, type ActivityPanelProps } from "./communication/ActivityPanel";
export { AddTaskButton, type AddTaskButtonProps } from "./communication/AddTaskButton";
export { AssignedToSection } from "./communication/AssignedToSection";
export { TaskStatusSection } from "./communication/TaskStatusSection";
export { CommentInput } from "./communication/CommentInput";
export type { CommentInputProps } from "./communication/CommentInput";
export { CommentsSection, type CommentsSectionProps } from "./communication/CommentsSection";
export { MessageResourceDisplay, MessageAttachmentPicker, PendingAttachmentChips, parseTextArray, type PendingAttachment } from "./communication/MessageResourceSection";
export { PropertiesInline, type PropertiesInlineProps } from "./communication/PropertiesInline";
export { PropertiesPanel, type PropertiesPanelProps } from "./communication/PropertiesPanel";
export { PropertiesRightPanel, type BuildUnitInfo, type PropertiesRightPanelProps } from "./communication/PropertiesRightPanel";
export { ResourceDisplay, type ResourceDisplayProps } from "./communication/ResourceDisplay";
export { ResourcesSection, type ResourcesSectionProps } from "./communication/ResourcesSection";
export { TaskDetailContent, type TaskDetailContentProps } from "./communication/TaskDetailContent";
export { TasksRightPanel, type Task, type TasksRightPanelProps } from "./communication/TasksRightPanel";
export { TasksTeamNav } from "./communication/TasksTeamNav";
export { ViewsNav } from "./communication/ViewsNav";
export { ViewsTeamNav } from "./communication/ViewsTeamNav";

// admin/
export { HeaderLoggedIn } from "./admin/HeaderLoggedIn";
export { InboxNav } from "./admin/InboxNav";
export { MyTasksNav } from "./admin/MyTasksNav";
export { PageTopBar } from "./admin/PageTopBar";
export { Sidebar, type SidebarProps } from "./admin/Sidebar";
export { SidebarProjects } from "./admin/SidebarProjects";
export { TeamSection } from "./admin/TeamSection";
export { UserInfo } from "./admin/UserInfo";

// shared / landing / login (remain flat in buildInlime/)
export { ArticleList, type ArticleListProps } from "./ArticleList";
export { BottomSection } from "./BottomSection";
export { CategoryChip } from "./CategoryChip";
export { PageHeading } from "./PageHeading";
export { DisplayButton } from "./DisplayButton";
export { FeatureSection } from "./FeatureSection";
export { FeaturesCarousel } from "./FeaturesCarousel";
export { FilterButton } from "./FilterButton";
export { Footer } from "./Footer";
export { Header } from "./Header";
export { Hero } from "./Hero";
export { LoginCard } from "./LoginCard";
export { LoginDecorativeImage } from "./LoginDecorativeImage";
// LoginForm takes no props — it reads its mode from the route search.
export { LoginForm } from "./LoginForm";
export { LoginHeader } from "./LoginHeader";
export { LoginTerms } from "./LoginTerms";
export { NavButton } from "./NavButton";
export { ProseSection } from "./ProseSection";
export { ResourceSection, type Article, type ResourceSectionProps } from "./ResourceSection";
export { RoutePendingComponent } from "./RoutePendingComponent";
export { StepSection, type Step, type StepSectionProps } from "./StepSection";
export { ToolbarButton } from "./ToolbarButton";
export { TrySection } from "./TrySection";
