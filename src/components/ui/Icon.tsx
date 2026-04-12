type IconName =
  | "search"
  | "settings"
  | "spark"
  | "palette"
  | "command"
  | "clipboard"
  | "close"
  | "check"
  | "warning";

type IconProps = {
  name: IconName;
  className?: string;
};

export function Icon({ name, className = "h-4 w-4" }: IconProps) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />
          <path d="m19.4 15 .8 1.4-1.7 3-1.6-.2a7.9 7.9 0 0 1-1.6.9L14.9 22h-3.8l-.4-1.9a7.9 7.9 0 0 1-1.6-.9l-1.6.2-1.7-3 .8-1.4a8.4 8.4 0 0 1 0-2l-.8-1.4 1.7-3 1.6.2a7.9 7.9 0 0 1 1.6-.9L11.1 2h3.8l.4 1.9a7.9 7.9 0 0 1 1.6.9l1.6-.2 1.7 3-.8 1.4c.2.7.3 1.3.3 2s-.1 1.3-.3 2Z" />
        </svg>
      );
    case "spark":
      return (
        <svg {...common}>
          <path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z" />
          <path d="m5 16 .9 2.1L8 19l-2.1.9L5 22l-.9-2.1L2 19l2.1-.9L5 16Z" />
          <path d="m19 14 .7 1.6L21.3 16l-1.6.7L19 18.3l-.7-1.6-1.6-.7 1.6-.4L19 14Z" />
        </svg>
      );
    case "palette":
      return (
        <svg {...common}>
          <path d="M12 3a9 9 0 0 0 0 18h1.4a2.6 2.6 0 0 0 2.6-2.6c0-.9-.3-1.4-.8-1.9a1.8 1.8 0 0 1-.5-1.3 2 2 0 0 1 2-2h.8A4.5 4.5 0 0 0 22 8.8C21.4 5.4 17.2 3 12 3Z" />
          <circle cx="6.5" cy="10" r="1" />
          <circle cx="9.5" cy="7.2" r="1" />
          <circle cx="13.2" cy="6.5" r="1" />
          <circle cx="16.2" cy="8.2" r="1" />
        </svg>
      );
    case "command":
      return (
        <svg {...common}>
          <path d="M9 5.5a2.5 2.5 0 1 0-5 0V9h5V5.5Z" />
          <path d="M9 15H4v3.5a2.5 2.5 0 1 0 5 0V15Z" />
          <path d="M15 9h5V5.5a2.5 2.5 0 1 0-5 0V9Z" />
          <path d="M15 15v3.5a2.5 2.5 0 1 0 5 0V15h-5Z" />
          <path d="M9 9h6v6H9z" />
        </svg>
      );
    case "clipboard":
      return (
        <svg {...common}>
          <rect x="7" y="4" width="10" height="16" rx="2" />
          <path d="M9.5 4.5h5a1.5 1.5 0 0 0-1.5-1.5h-2a1.5 1.5 0 0 0-1.5 1.5Z" />
          <path d="M9 10h6" />
          <path d="M9 14h6" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="m6 6 12 12" />
          <path d="M18 6 6 18" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="m5 12 4 4 10-10" />
        </svg>
      );
    case "warning":
      return (
        <svg {...common}>
          <path d="M12 3 2.4 20.2h19.2L12 3Z" />
          <path d="M12 9v5" />
          <path d="M12 17.2h.01" />
        </svg>
      );
    default:
      return null;
  }
}
