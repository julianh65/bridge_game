type GameScreenSidebarToggleProps = {
  isCollapsed: boolean;
  onExpand: () => void;
};

export const GameScreenSidebarToggle = ({
  isCollapsed,
  onExpand
}: GameScreenSidebarToggleProps) => {
  if (!isCollapsed) {
    return null;
  }

  return (
    <button
      type="button"
      className="btn btn-tertiary game-screen__sidebar-toggle"
      onClick={onExpand}
    >
      Show Command Center
    </button>
  );
};
