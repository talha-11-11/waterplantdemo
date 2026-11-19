import type { Pool } from "pg";
export const DEMO_USERNAME: string;
export const DEMO_PASSWORD: string;
export function isDemo(): boolean;
export function seedDemo(pool: Pool): Promise<{ customers: number; deliveries: number }>;
