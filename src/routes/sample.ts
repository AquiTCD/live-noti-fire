import type { Context } from "https://deno.land/x/hono@v3.12.0/mod.ts";
import { sampleStore } from "../db/kv.ts";
import type { SampleData, ApiResponse } from "../types/sample.ts";

export const createSampleHandler = async (c: Context) => {
  const key = crypto.randomUUID();
  const sampleData: SampleData = {
    id: key,
    content: "サンプルデータ",
    createdAt: new Date().toISOString(),
  };

  try {
    const success = await sampleStore.create(sampleData);
    if (!success) {
      throw new Error("データの保存に失敗しました");
    }

    const response: ApiResponse<SampleData> = {
      message: "データを保存しました",
      data: sampleData,
    };
    return c.json(response, 201);
  } catch (error: unknown) {
    const response: ApiResponse<never> = {
      error: "データの保存に失敗しました",
      details: error instanceof Error ? error.message : "Unknown error",
    };
    return c.json(response, 500);
  }
};

export const getSampleHandler = async (c: Context) => {
  const id = c.req.param("id");
  try {
    const data = await sampleStore.get(id);
    if (!data) {
      const response: ApiResponse<never> = {
        error: "データが見つかりませんでした",
      };
      return c.json(response, 404);
    }
    return c.json(data);
  } catch (error: unknown) {
    const response: ApiResponse<never> = {
      error: "データの取得に失敗しました",
      details: error instanceof Error ? error.message : "Unknown error",
    };
    return c.json(response, 500);
  }
};

export const listSamplesHandler = async (c: Context) => {
  try {
    const samples = await sampleStore.list();
    return c.json({ data: samples });
  } catch (error: unknown) {
    const response: ApiResponse<never> = {
      error: "データの取得に失敗しました",
      details: error instanceof Error ? error.message : "Unknown error",
    };
    return c.json(response, 500);
  }
};
