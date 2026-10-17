type IconName =
  | "home"
  | "book"
  | "badge"
  | "guide"
  | "arrow"
  | "mail"
  | "lock"
  | "check"
  | "school"
  | "calendar"
  | "shield"
  | "logout"
  | "close"
  | "target"
  | "star";
const paths: Record<IconName, string> = {
  home: "m3 10 9-7 9 7v11h-6v-7H9v7H3z",
  book: "M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Zm0 0v15",
  badge: "m12 2 3 5 6 1-4 5 1 7-6-3-6 3 1-7-4-5 6-1z",
  guide: "M8 4H5v18h14V4h-3M8 2h8v5H8zM8 12h8M8 16h6",
  arrow: "m9 5 7 7-7 7",
  mail: "M3 5h18v14H3zM3 5l9 8 9-8",
  lock: "M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4",
  check: "m5 12 4 4L19 6",
  school: "m2 9 10-6 10 6-10 6zM5 11v8h14v-8M12 15v6",
  calendar: "M4 5h16v16H4zM8 2v6M16 2v6M4 10h16",
  shield: "M12 2 3 6v7c0 5 9 9 9 9s9-4 9-9V6zM7 12l3 3 7-7",
  logout: "M10 3H4v18h6M10 12h12m-5-5 5 5-5 5",
  close: "m6 6 12 12M6 18 18 6",
  target: "M21 12a9 9 0 1 1-9-9M16 3l-4 9 9-4M12 7a5 5 0 1 0 5 5",
  star: "m12 2 3 6 6 1-4.5 5 1 7-5.5-3-5.5 3 1-7L3 9l6-1z",
};
export default function Icon({
  name,
  size = 22,
}: {
  name: IconName;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
