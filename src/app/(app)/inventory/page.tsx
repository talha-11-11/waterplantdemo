import { notFound } from "next/navigation";

// Removed feature (kept as an empty page so old uploads do not break the build).
export default function Removed() {
  notFound();
}
