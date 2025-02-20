import FileWatcher, { getFileType } from "./FileWatcher";
import { WebSocketServer } from "ws";
import http from "http";
import fs from "fs";
import path from "path";

interface FolderOperation {
  type: "open" | "close" | "ping";
  pathname: string;
}

export function registerWebSocketServer(server: http.Server, roots: string[]) {
  const wss = new WebSocketServer({ noServer: true });

  const fileWatcher = new FileWatcher();

  function isUnderRoot(pathname: string): boolean {
    return roots.some((r) => path.resolve(pathname).startsWith(r));
  }

  wss.on("connection", (ws) => {
    const subscriptions = new Map<string, () => void>();

    console.log("Sending root folders", roots);

    setTimeout(()=>{
      ws.send(
        JSON.stringify(
          roots.map((root) => ({
            eventType: "root",
            pathname: root,
          }))
        )
      );
    },1000)


    ws.on("close", () => {
      for (let [pathname, unsub] of subscriptions) {
        console.log("onClose")
        unsub();
        subscriptions.delete(pathname);
      }
    });
    ws.on("message", async (message: string) => {
      console.log(`INCOMING message:`+message);

      const { type, pathname } = JSON.parse(message) as FolderOperation;
      switch (type) {
        case "ping":
          ws.send("{\"type\":\"pong\",\"filename\":\"\",\"pathname\":\"\"}")
          break;
        case "open":
          // Can only open folders
          if ((await getFileType(pathname)) != "folder") return;
          // Can only open folders that are under an expose root
          if (!isUnderRoot(pathname)) return;

          if (!subscriptions.get(pathname)) {
            subscriptions.set(
              pathname,
              fileWatcher.subscribe(pathname, (fileEvent) =>
              {
                console.log("Sending fileEvent", JSON.stringify(fileEvent));
                ws.send(JSON.stringify(fileEvent))
              }
              )
            );

            // Send full listing when subscribing
            // Batching for better performance
            const files = await fs.promises.readdir(pathname);
            const batch = await Promise.all(
              files.map(async (filename) => {
                return {
                  eventType: await getFileType(path.join(pathname, filename)),
                  filename,
                  pathname,
                };
              })
            );
            console.log("Sending batch", JSON.stringify(batch));
  
            ws.send(JSON.stringify(batch));

            // Informing the front-end that a folder is empty
            if (!files.length) {
              console.log(pathname, "is empty, sending empty");
              ws.send(
                JSON.stringify({
                  eventType: "empty",
                  filename: "",
                  pathname,
                })
              );
            } else {
              console.log(pathname, "has", files.length, "files");
            }
          }
          break;
        case "close":
          const unsub = subscriptions.get(pathname);
          if (!unsub) return;
          subscriptions.delete(pathname);
          unsub();
          break;
      }
    });
  });

  server.on("upgrade", (request, socket, head) =>
    // @ts-ignore
    wss.handleUpgrade(request, socket, head, (ws) =>
      wss.emit("connection", ws, request)
    )
  );
}
