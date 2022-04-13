import * as React from "react";

interface FileProps {
    name: string;
}

const File = ({ name }: FileProps) => {
    return <li onClick={()=>{console.log("click:"+name)}}>{name}</li>;
};

export default File;