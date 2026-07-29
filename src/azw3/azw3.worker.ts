import { createAzw3 } from "./writer.js";

type WorkerRequest = {
  id: number;
  book: {
    title: string;
    author: string;
    language: string;
    chapters: Array<{ title: string; content: string }>;
    cover: Uint8Array;
  };
};

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const { id, book } = event.data;
  try {
    const bytes = createAzw3(book, (progress: number, message: string) => {
      self.postMessage({ id, type: "progress", progress, message });
    });
    self.postMessage(
      {
        id,
        type: "done",
        buffer: bytes.buffer,
        size: bytes.byteLength,
      },
      { transfer: [bytes.buffer] },
    );
  } catch (problem) {
    self.postMessage({
      id,
      type: "error",
      message:
        problem instanceof Error ? problem.message : "AZW3 生成失败。",
    });
  }
});

