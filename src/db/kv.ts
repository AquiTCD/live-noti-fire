/// <reference lib="deno.unstable" />
import type { SampleData } from "../types/sample.ts";

// KVインスタンスの初期化
export const kv = await Deno.openKv();

export const sampleStore = {
  async create(data: SampleData): Promise<boolean> {
    const result = await kv.set(["samples", data.id], data);
    return result.ok;
  },

  async get(id: string): Promise<SampleData | null> {
    const result = await kv.get<SampleData>(["samples", id]);
    return result.value;
  },

  async list(limit = 10): Promise<SampleData[]> {
    const samples: SampleData[] = [];
    const entries = kv.list<SampleData>({ prefix: ["samples"] }, { limit });

    for await (const entry of entries) {
      samples.push(entry.value);
    }

    return samples;
  }
};
