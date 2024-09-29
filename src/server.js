import http from "http";
import "dotenv/config";

const HOST = process.env.HOST || "localhost";
const PORT = process.env.PORT || 3000;

/**
 * simple http server to get the token from the spotify auth
 *
 * GET /get-token-hash?code=code_token
 */
const server = http.createServer(async (req, res) => {
  const requestURL = new URL(req.url, `http://${req.headers.host}`);

  let tokenSpotify = "";

  // GET http://HOST:PORT/get-token-hash
  if (req.method === "GET" && requestURL.pathname === "/get-token-hash") {
    console.log("accessed GET /get-token-hash");

    tokenSpotify = requestURL.searchParams.get("code");
    console.log(`spotify auth token : ${tokenSpotify}`);

    res.writeHead(200, {
      "Content-Type": "text/plain",
    });

    res.write(tokenSpotify);
    res.end();

    stopServer();
  }
});

/**
 * Start the server
 *
 * @returns {Promise<void>}
 */
const startServer = async () => {
  server.listen(PORT, HOST, () => {
    console.log(`Server is running at ${HOST}:${PORT}`);
  });
};

/**
 * Stop the server
 *
 * @returns {Promise<void>}
 */
const stopServer = async () => {
  console.log("closing server");
  server.close();
}

export { 
  startServer,
};
