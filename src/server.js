import http from "http";
import "dotenv/config";
import fs from "fs";

const HOST = process.env.HOST || "localhost";
const PORT = process.env.PORT || 3000;

const serverHandler = async (req, res) => {
  const requestURL = new URL(req.url, `http://${req.headers.host}`);

  let tokenSpotify = "";

  // GET http://HOST:PORT/get-token-hash
  if (req.method === "GET" && requestURL.pathname === "/get-token-hash") {
    console.log("accessed GET /get-token-hash");

    tokenSpotify = requestURL.searchParams.get("code");
    console.log(`spotify auth token : ${tokenSpotify}`);

    res.writeHead(201, {
      "Content-Type": "text/plain",
    });

    res.write(tokenSpotify);
    res.end();
  }
};

const server = http.createServer(serverHandler);
server.listen(PORT, HOST, () => {
  console.log(`Server is running at ${HOST}:${PORT}`);
});
