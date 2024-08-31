import {
  getAP40csv,
  parseAP40csv,
  startServer,
  automateSpotifyToken,
  getSpotifyAccessToken,
  removeSpotifyPlaylistSongs,
  searchSpotifySongURIs,
  addSpotifyPlaylistSongs,
  updateSpotifyPlaylistTitle,
} from "./ap40.js";
import fs from "fs";

/**
 * NOTES :
 * how do you kill server child process not through timeout?
 * dynamic redirectURL inside getSpotifyToken
 * parallel search spotify track's URI
 */

(async () => {
  let chartList, authToken, accessToken, songsURI;

  // await getAP40csv();
  chartList = await parseAP40csv();

  startServer();
  authToken = await automateSpotifyToken();
  accessToken = await getSpotifyAccessToken(authToken);

  removeSpotifyPlaylistSongs(accessToken);

  songsURI = await searchSpotifySongURIs(accessToken, chartList);

  // // now the current problem is not being able to send post addSpotifyPlaylistSongs
  // songsURI = fs.readFileSync(process.cwd() + "/src/temp/uris.json", "utf8");
  // const songsURIs = JSON.parse(songsURI);
  // addSpotifyPlaylistSongs(accessToken, songsURIs);

  addSpotifyPlaylistSongs(accessToken, songsURI);

  updateSpotifyPlaylistTitle(accessToken);

})();
