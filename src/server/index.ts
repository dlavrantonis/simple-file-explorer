import Koa from "koa";
import http from "http";
import { registerWebSocketServer } from "./WSService";
import serve from "koa-static";
import path from "path";
import { AddressInfo } from "net";
import { getFileType } from "./FileWatcher";
import open from "open";

const app = new Koa();

const server = http.createServer(app.callback());

const roots = process.argv.slice(2).map((p) => path.resolve(p));
for (let root of roots) {
  getFileType(root).then((type) => {
    if (type != "folder") {
      throw new Error(`${root} is not a folder.`);
    }
  });
}

registerWebSocketServer(server, roots);
app.use(serve(path.join(__dirname, "..", "public")));

server.listen(process.env.PORT, function listening() {
  const port = (server.address() as AddressInfo).port;
  console.log("Listening on", port);
  if (process.env.OPEN) open("http://localhost:" + port);
});
