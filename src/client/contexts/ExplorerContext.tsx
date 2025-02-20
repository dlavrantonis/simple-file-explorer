import * as React from "react";
import { useState, createContext, useContext, useRef, useEffect } from "react";
import { FileEvent } from "../../shared/types/FileEvent";
import { TreeNode } from "../types/TreeNode";
import type { FileInfo } from '../types/FileInfo';
import ReactPlayer from 'react-player'



const ExplorerContext = createContext({ getChildren: (path: string[]): null | FileInfo[] => null, open: (path: string[]) => { }, close: (path: string[]) => { }, roots: new Array<string>() });

const ExplorerProvider = ({ children }: React.PropsWithChildren<{}>) => {
    const [tree, setTree] = useState<TreeNode>({});
    const [opened, setOpened] = useState(new Map<string, number>());
    const [roots, setRoots] = useState<string[]>([]);
    const [status, setStatus] = useState(-1);
    const [videoFilePath, setVideoFilePath] = useState(null);

    const handleVideoUpload = (event:any) => {
        console.log("file"+event.target.files[0])
        setVideoFilePath(URL.createObjectURL(event.target.files[0]));
        };
    
        

    const wsRef = useRef<WebSocket>(null);
    const ws = wsRef.current;

    function connect() {
        if (!ws || ws.readyState == WebSocket.CLOSED) {
            wsRef.current = new WebSocket(location.protocol.replace("http", "ws") + '//' + location.host);
            setStatus(WebSocket.CONNECTING);
            wsRef.current.onclose = () => {
                // clear state
                setTree({});
                setRoots([]);
                setOpened(new Map());
                setStatus(WebSocket.CLOSED);
            };
            wsRef.current.onopen = () => setStatus(WebSocket.OPEN);
        }
    }

    useEffect(() => {
        connect();
        return () => ws.close();
    }, []);

    switch (status) {
        case WebSocket.CLOSED: return <h2 onClick={connect}>Connection Closed. Click to Reconnect.</h2>;
        case WebSocket.CONNECTING: return <h2>Connecting...</h2>;
        case WebSocket.OPEN: break;
        default: return <h2>Not Connected Yet</h2>;
    }

    function handleFileEvent(fileEvent: FileEvent) {
        const { eventType, filename, pathname } = fileEvent;
        const path = [...pathname.split("/").filter(p => p), filename];
        let pointer = tree;
        while (path.length > 1) {
            let nextChild = path.shift();
            let next = pointer[nextChild];
            if (!next) {
                pointer[nextChild] = {};
                next = pointer[nextChild];
            }
            if (next == "FILE") throw new Error("File nested in file. Impossible.");
            pointer = next;
        }

        switch (eventType) {
            case "file":
                pointer[path.shift()] = "FILE";
                break;
            case "root":
                roots.push(pathname);
                setRoots([...roots]);
                break;
            case "folder":
                let name = path.shift();
                pointer[name] = pointer[name] || {};
                break;
            case "unlink":
                close(path);
                delete pointer[path.shift()];
                break;
            // Folder is empty, nothing to do
            case "empty":
                break;
        }

        setTree({ ...tree });
    }
    ws.onmessage = (messageJson) => {
        const message = JSON.parse(messageJson.data) as FileEvent | FileEvent[];
        if (Array.isArray(message)) {
            for (let m of message) {
                handleFileEvent(m);
            }
        } else {
            handleFileEvent(message);
        }
    };




    const getChildren = (path: Readonly<string[]>) => {
        const pathname = "/" + path.join("/");
        if (!opened.has(pathname)) {
            return null;
        }
        let pointer: TreeNode = tree;
        let directions = [...path];
        while (directions.length) {
            const next = pointer[directions.shift()];
            if (next == "FILE" || next == null) return null;
            pointer = next;
        }
        return Object.entries(pointer).map(([name, value]): FileInfo => {
            return {
                name,
                isFolder: value !== "FILE"
            };
        }).sort((a, b) => a.name.toLocaleLowerCase().localeCompare(b.name.toLowerCase()));
    };
    const close = (path: string[]) => {
        const pathname = "/" + path.join("/");
        if (!opened.has(pathname)) {
            return;
        }
        const watchers = opened.get(pathname);
        opened.set(pathname, watchers - 1);

        if (watchers > 1) return;
        ws.send(JSON.stringify({
            type: "close",
            pathname: pathname
        }));
        opened.delete(pathname);
        setOpened(new Map(opened));
    };
    const open = (path: string[]) => {
        const pathname = "/" + path.join("/");
        const watchers = opened.get(pathname) || 0;
        opened.set(pathname, watchers + 1);
        setOpened(new Map(opened));

        // Subscribe, but only if first watcher
        if (watchers == 0)
            ws.send(JSON.stringify({
                type: "open",
                pathname: pathname
            }));
    };
    
    var videoPlayer



    return (
    <div>
        <input type="file" onChange={handleVideoUpload} />
        <ReactPlayer playing url={['/Users/dionisislavrantonis/Downloads/DimKiposFraxtis_20220409_191319.mp4', 'Users/dionisislavrantonis/Downloads/DimKiposFraxtis_20220409_191319.mp4']} />
        <ReactPlayer   ref={player => { videoPlayer = player }}  url={'file:///Users/dionisislavrantonis/Downloads/DimKiposFraxtis_20220409_191319.mp4' } playing={false} controls={true}  config={{ file: { attributes: {crossorigin: 'anonymous' }}}}/>
        <ExplorerContext.Provider value={{ getChildren, open, close, roots }}>
            {children}
        </ExplorerContext.Provider>
    </div>
)
    
    ;
};

export { ExplorerContext, ExplorerProvider };