export function formatTestedAt(date: Date) {
  return date.toLocaleString("ko-KR", { hour12: false });
}
