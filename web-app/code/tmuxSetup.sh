#!/bin/bash

# Tmux session launcher for BuildInLime project
# This script creates a tmux session with 3 panes in a specific layout

SESSION_NAME="BuildInLime"

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo "Error: tmux is not installed. Please install it first."
    exit 1
fi

# Kill existing session if it exists
tmux has-session -t $SESSION_NAME 2>/dev/null
if [ $? -eq 0 ]; then
    echo "Killing existing session: $SESSION_NAME"
    tmux kill-session -t $SESSION_NAME
fi

# Create new tmux session with first pane
echo "Creating tmux session: $SESSION_NAME"
tmux new-session -d -s $SESSION_NAME -n "BuildInLime-App"

# Split vertically to create the second pane (Backend)
tmux split-window -h -t $SESSION_NAME:0

# Select the right pane (Backend) and rename it
tmux select-pane -t $SESSION_NAME:0.1
tmux send-keys -t $SESSION_NAME:0.1 "printf '\033]2;Backend\033\\'" C-m

# Split the Backend pane horizontally to create Debugging pane
tmux split-window -v -t $SESSION_NAME:0.1

# Rename the debugging pane
tmux select-pane -t $SESSION_NAME:0.2
tmux send-keys -t $SESSION_NAME:0.2 "printf '\033]2;Debugging\033\\'" C-m

# Set pane titles display (optional - shows better identification)
tmux set-option -t $SESSION_NAME pane-border-status top
tmux set-option -t $SESSION_NAME pane-border-format "#{pane_index}: #{pane_title}"

# Rename the first pane
tmux select-pane -t $SESSION_NAME:0.0
tmux send-keys -t $SESSION_NAME:0.0 "printf '\033]2;BuildInLime-App\033\\'" C-m

# Optional: Set starting directories or commands for each pane
# Uncomment and modify as needed:
# tmux send-keys -t $SESSION_NAME:0.0 "cd /path/to/app && clear" C-m
# tmux send-keys -t $SESSION_NAME:0.1 "cd /path/to/backend && clear" C-m
# tmux send-keys -t $SESSION_NAME:0.2 "cd /path/to/debug && clear" C-m

# Select the first pane
tmux select-pane -t $SESSION_NAME:0.0

# Attach to the session
echo "Attaching to tmux session: $SESSION_NAME"
tmux attach-session -t $SESSION_NAME
