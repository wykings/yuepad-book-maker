export type Azw3Book = {
  title: string;
  author: string;
  language: string;
  chapters: Array<{ title: string; content: string }>;
  cover: Uint8Array<ArrayBuffer>;
};

export type Azw3Progress = {
  progress: number;
  message: string;
};

let requestSequence = 0;

export function createAzw3InWorker(
  book: Azw3Book,
  onProgress?: (state: Azw3Progress) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  return new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
    const worker = new Worker(
      new URL("./azw3.worker.ts", import.meta.url),
      { type: "module", name: "yuedu-azw3" },
    );
    const id = ++requestSequence;

    const close = () => worker.terminate();
    worker.addEventListener("message", (event) => {
      const message = event.data as
        | {
            id: number;
            type: "progress";
            progress: number;
            message: string;
          }
        | { id: number; type: "done"; buffer: ArrayBuffer; size: number }
        | { id: number; type: "error"; message: string };
      if (message.id !== id) return;
      if (message.type === "progress") {
        onProgress?.({
          progress: message.progress,
          message: message.message,
        });
        return;
      }
      close();
      if (message.type === "error") {
        reject(new Error(message.message));
        return;
      }
      resolve(new Uint8Array(message.buffer));
    });
    worker.addEventListener("error", (event) => {
      close();
      reject(new Error(event.message || "AZW3 工作线程启动失败。"));
    });
    worker.postMessage({ id, book }, [book.cover.buffer]);
  });
}
